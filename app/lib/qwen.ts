/**
 * Qwen API client — OpenAI-compatible format via DashScope.
 * Supports both qwen-plus (Pass 1: text-to-SQL) and
 * qwen-turbo (Pass 2: response formatting).
 */

const QWEN_API_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

// Per-call timeout: 15 seconds (total budget: 2 calls × 15s = 30s < Vercel 60s limit)
const CALL_TIMEOUT_MS = 15000;

// Max retries on transient failures
const MAX_RETRIES = 2;

interface QwenMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface QwenResponse {
  choices: { message: { content: string } }[];
}

/**
 * Call Qwen API with retry logic and timeout.
 * Uses OpenAI-compatible chat completions endpoint.
 */
export async function callQwen(
  model: "qwen-plus" | "qwen-turbo",
  messages: QwenMessage[]
): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new Error("QWEN_API_KEY environment variable is not set");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);

      const response = await fetch(QWEN_API_URL, {
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
          `Qwen API error ${response.status}: ${errorBody.slice(0, 200)}`
        );
      }

      const data = (await response.json()) as QwenResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Qwen API returned empty response");
      }
      return content.trim();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Don't retry on abort (timeout) — it's unlikely to succeed faster
      if (lastError.name === "AbortError") {
        throw new Error("Qwen API 回應逾時，請稍後再試");
      }
      // Wait briefly before retry
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw lastError ?? new Error("Qwen API call failed");
}

/**
 * Extract pure SQL from Qwen's response.
 * The model might wrap SQL in markdown code blocks — strip them.
 */
export function extractSql(response: string): string {
  let sql = response.trim();

  // Remove ```sql ... ``` wrapper if present
  const codeBlockMatch = sql.match(/```(?:sql)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    sql = codeBlockMatch[1].trim();
  }

  return sql;
}
