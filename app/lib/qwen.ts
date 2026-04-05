/**
 * LLM API client — OpenAI-compatible format via Hugging Face Inference API.
 * Supports configurable models for Pass 1 (text-to-SQL) and Pass 2 (response formatting).
 * API URL, token, and model names are all configurable via environment variables.
 */

// All configurable via .env — change models anytime without touching code
const API_URL =
  process.env.LLM_API_URL ||
  "https://router.huggingface.co/v1/chat/completions";

// Per-call timeout: 25 seconds (total budget: 2 calls × 25s = 50s < Vercel 60s limit)
const CALL_TIMEOUT_MS = 25000;

// Max retries on transient failures
const MAX_RETRIES = 2;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  choices: { message: { content: string } }[];
}

/**
 * Resolve the actual model ID for a given pass.
 * "pass1" uses LLM_MODEL_PASS1 env (default: Qwen3-235B MoE, strong SQL).
 * "pass2" uses LLM_MODEL_PASS2 env (default: Qwen3-8B, fast formatting).
 */
function getModel(pass: "pass1" | "pass2"): string {
  if (pass === "pass1") {
    return process.env.LLM_MODEL_PASS1 || "Qwen/Qwen2.5-72B-Instruct";
  }
  return process.env.LLM_MODEL_PASS2 || "Qwen/Qwen3-8B";
}

/**
 * Call LLM API with retry logic and timeout.
 * Uses OpenAI-compatible chat completions endpoint.
 */
export async function callLLM(
  pass: "pass1" | "pass2",
  messages: ChatMessage[]
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_API_KEY environment variable is not set");
  }

  const model = getModel(pass);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0, // Deterministic output for SQL generation
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `LLM API error ${response.status}: ${errorBody.slice(0, 200)}`
        );
      }

      const data = (await response.json()) as ChatResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("LLM API returned empty response");
      }
      return content.trim();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Don't retry on abort (timeout) — it's unlikely to succeed faster
      if (lastError.name === "AbortError") {
        throw new Error("AI 回應逾時，請稍後再試");
      }
      // Wait briefly before retry
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw lastError ?? new Error("LLM API call failed");
}

/**
 * Extract pure SQL from LLM's response.
 * The model might wrap SQL in markdown code blocks or
 * include thinking tags — strip them all.
 */
export function extractSql(response: string): string {
  let sql = response.trim();

  // Remove <think>...</think> blocks (Qwen3 thinking mode)
  sql = sql.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Remove ```sql ... ``` wrapper if present
  const codeBlockMatch = sql.match(/```(?:sql)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    sql = codeBlockMatch[1].trim();
  }

  return sql;
}

/**
 * Strip <think>...</think> blocks from LLM response.
 * Used for Pass 2 where the model might include reasoning.
 */
export function stripThinking(response: string): string {
  return response.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
