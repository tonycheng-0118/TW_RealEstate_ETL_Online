/**
 * POST /api/chat — AI-powered real estate query endpoint.
 *
 * Flow:
 * 1. Rate limit check (10 req/min/IP)
 * 2. Pass 1: Qwen qwen-plus converts natural language → SQL
 * 3. SQL Guard validates the generated SQL
 * 4. Execute SQL against Supabase (app_reader, 10s timeout)
 * 5. Error handling (DB error → friendly message, empty → check etl_log)
 * 6. Pass 2: Qwen qwen-turbo formats results → Traditional Chinese
 * 7. Return response
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { validateSql } from "@/app/lib/sql-guard";
import { executeQuery, getLatestEtlStatus } from "@/app/lib/db";
import { callQwen, extractSql } from "@/app/lib/qwen";
import { PASS1_SYSTEM_PROMPT, PASS2_SYSTEM_PROMPT } from "@/app/lib/prompts";

// Friendly error message shown when SQL generation or execution fails
const FRIENDLY_ERROR =
  "目前的查詢條件過於複雜，系統無法精確解析。請嘗試簡化您的問題，例如指定明確的行政區、房型或時間範圍。";

export async function POST(request: NextRequest) {
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

    // --- Step 1: Rate limit ---
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `查詢過於頻繁，請 ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)} 秒後再試`,
        },
        { status: 429 }
      );
    }

    // --- Step 2: Pass 1 — text-to-SQL (qwen-plus) ---
    let sqlRaw: string;
    try {
      sqlRaw = await callQwen("qwen-plus", [
        { role: "system", content: PASS1_SYSTEM_PROMPT },
        { role: "user", content: message },
      ]);
    } catch {
      console.error("Pass 1 (text-to-SQL) failed");
      return NextResponse.json({
        reply: "系統暫時無法提供服務，請稍後再試。",
        metadata: { error: "qwen_pass1_failed" },
      });
    }

    const sql = extractSql(sqlRaw);

    // --- Step 3: SQL Guard ---
    const guardResult = validateSql(sql);
    if (!guardResult.valid) {
      console.warn(`SQL Guard rejected: ${guardResult.error} | SQL: ${sql}`);
      return NextResponse.json({
        reply: FRIENDLY_ERROR,
        metadata: { error: "sql_guard_rejected", reason: guardResult.error },
      });
    }

    // --- Step 4: Execute SQL ---
    let queryResult;
    try {
      queryResult = await executeQuery(sql);
    } catch (err) {
      // Step 5a: DB error → friendly message
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`DB query failed: ${errMsg} | SQL: ${sql}`);
      return NextResponse.json({
        reply: FRIENDLY_ERROR,
        metadata: { error: "db_query_failed" },
      });
    }

    // --- Step 5b: Empty results → check etl_log ---
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
        // etl_log query failed — not critical, proceed without freshness info
      }
      return NextResponse.json({
        reply: `查無符合條件的資料${freshness}。您可以嘗試放寬搜尋條件，例如擴大時間範圍或調整行政區。`,
        metadata: { sql, rowCount: 0 },
      });
    }

    // --- Step 6: Pass 2 — format results (qwen-turbo) ---
    // Limit data sent to Pass 2 to avoid token overflow
    const rowsFormatted = JSON.stringify(queryResult.rows.slice(0, 100));
    let reply: string;
    try {
      reply = await callQwen("qwen-turbo", [
        { role: "system", content: PASS2_SYSTEM_PROMPT },
        {
          role: "user",
          content: `使用者問題：${message}\n\n查詢結果（共 ${queryResult.rows.length} 筆）：\n${rowsFormatted}`,
        },
      ]);
    } catch {
      // Pass 2 failed — fall back to raw data summary
      console.error("Pass 2 (formatting) failed, returning raw summary");
      reply = `查詢到 ${queryResult.rows.length} 筆資料，但 AI 整理功能暫時無法使用。請稍後再試。`;
    }

    // --- Step 7: Return response ---
    return NextResponse.json({
      reply,
      metadata: { sql, rowCount: queryResult.rows.length },
    });
  } catch (err) {
    console.error("Unexpected error in /api/chat:", err);
    return NextResponse.json(
      { error: "系統發生錯誤，請稍後再試" },
      { status: 500 }
    );
  }
}
