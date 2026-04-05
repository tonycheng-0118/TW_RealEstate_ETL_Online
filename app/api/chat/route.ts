/**
 * POST /api/chat — AI-powered real estate query endpoint.
 *
 * Flow:
 * 1. Rate limit check (10 req/min/IP)
 * 2. Pass 1: LLM converts natural language → SQL
 * 3. SQL Guard validates the generated SQL
 * 4. Execute SQL against Supabase (10s timeout)
 * 5. Error handling (DB error → friendly message, empty → check etl_log)
 * 6. Pass 2: LLM formats results → Traditional Chinese
 * 7. Return response
 *
 * All steps are logged to console for debugging during development.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { validateSql } from "@/app/lib/sql-guard";
import { executeQuery, getLatestEtlStatus } from "@/app/lib/db";
import { callLLM, extractSql } from "@/app/lib/qwen";
import { PASS1_SYSTEM_PROMPT, PASS2_SYSTEM_PROMPT } from "@/app/lib/prompts";
import { devLog } from "@/app/lib/logger";

// Friendly error message shown when SQL generation or execution fails
const FRIENDLY_ERROR =
  "目前的查詢條件過於複雜，系統無法精確解析。請嘗試簡化您的問題，例如指定明確的行政區、房型或時間範圍。";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // --- Parse request body ---
    const body = await request.json();
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json(
        { error: "請輸入查詢內容" },
        { status: 400 }
      );
    }

    devLog("REQUEST", { requestId, userMessage: message });

    // --- Step 1: Rate limit ---
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      devLog("RATE_LIMIT", { requestId, ip, retryAfterMs: rateCheck.retryAfterMs });
      return NextResponse.json(
        {
          error: `查詢過於頻繁，請 ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)} 秒後再試`,
        },
        { status: 429 }
      );
    }

    // --- Step 2: Pass 1 — text-to-SQL ---
    let sqlRaw: string;
    const pass1Start = Date.now();
    try {
      sqlRaw = await callLLM("pass1", [
        { role: "system", content: PASS1_SYSTEM_PROMPT },
        { role: "user", content: message },
      ]);
    } catch (e) {
      devLog("PASS1_ERROR", {
        requestId,
        error: e instanceof Error ? e.message : String(e),
        elapsedMs: Date.now() - pass1Start,
      });
      return NextResponse.json({
        reply: "系統暫時無法提供服務，請稍後再試。",
        metadata: { error: "pass1_failed" },
      });
    }

    const sql = extractSql(sqlRaw);
    devLog("PASS1_OK", {
      requestId,
      rawResponse: sqlRaw.slice(0, 500),
      extractedSql: sql,
      elapsedMs: Date.now() - pass1Start,
    });

    // --- Step 2.5: Intent check — reject non-related queries ---
    if (sql.trim().toUpperCase() === "NOT_RELATED") {
      devLog("NOT_RELATED", { requestId, userMessage: message });
      return NextResponse.json({
        reply: "本系統僅提供台灣不動產實價登錄相關查詢。請嘗試詢問房價、租金、成交行情等問題。",
        metadata: { error: "not_related" },
      });
    }

    // --- Step 3: SQL Guard ---
    const guardResult = validateSql(sql);
    if (!guardResult.valid) {
      devLog("SQL_GUARD_REJECTED", { requestId, reason: guardResult.error, sql });
      return NextResponse.json({
        reply: FRIENDLY_ERROR,
        metadata: { error: "sql_guard_rejected", reason: guardResult.error },
      });
    }
    devLog("SQL_GUARD_OK", { requestId });

    // --- Step 4: Execute SQL ---
    let queryResult;
    const dbStart = Date.now();
    try {
      queryResult = await executeQuery(sql);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      devLog("DB_ERROR", { requestId, error: errMsg, sql, elapsedMs: Date.now() - dbStart });
      return NextResponse.json({
        reply: FRIENDLY_ERROR,
        metadata: { error: "db_query_failed" },
      });
    }
    devLog("DB_OK", {
      requestId,
      rowCount: queryResult.rows.length,
      sampleRows: queryResult.rows.slice(0, 3),
      elapsedMs: Date.now() - dbStart,
    });

    // --- Step 5: Empty results → check etl_log ---
    if (queryResult.rows.length === 0) {
      let freshness = "";
      try {
        const etlStatus = await getLatestEtlStatus();
        if (etlStatus) {
          const date = new Date(etlStatus.finishedAt).toLocaleDateString(
            "zh-TW"
          );
          freshness = `（資料最後更新：${date}，季度：${etlStatus.season}）`;
        }
      } catch {
        // etl_log query failed — not critical
      }
      const reply = `查無符合條件的資料${freshness}。您可以嘗試放寬搜尋條件，例如擴大時間範圍或調整行政區。`;
      devLog("EMPTY_RESULT", { requestId, sql, freshness });
      return NextResponse.json({
        reply,
        metadata: { sql, rowCount: 0 },
      });
    }

    // --- Step 6: Pass 2 — format results ---
    const rowsFormatted = JSON.stringify(queryResult.rows.slice(0, 100));
    let reply: string;
    const pass2Start = Date.now();
    try {
      reply = await callLLM("pass2", [
        { role: "system", content: PASS2_SYSTEM_PROMPT },
        {
          role: "user",
          content: `使用者問題：${message}\n\n查詢結果（共 ${queryResult.rows.length} 筆）：\n${rowsFormatted}`,
        },
      ]);
      devLog("PASS2_OK", {
        requestId,
        replyPreview: reply.slice(0, 200),
        elapsedMs: Date.now() - pass2Start,
      });
    } catch (e) {
      devLog("PASS2_ERROR", {
        requestId,
        error: e instanceof Error ? e.message : String(e),
        elapsedMs: Date.now() - pass2Start,
      });
      reply = `查詢到 ${queryResult.rows.length} 筆資料，但 AI 整理功能暫時無法使用。請稍後再試。`;
    }

    // --- Step 7: Return response ---
    devLog("RESPONSE", { requestId, rowCount: queryResult.rows.length });
    return NextResponse.json({
      reply,
      metadata: { sql, rowCount: queryResult.rows.length },
    });
  } catch (err) {
    devLog("UNEXPECTED_ERROR", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "系統發生錯誤，請稍後再試" },
      { status: 500 }
    );
  }
}
