/**
 * Dev logger — writes structured JSON logs to a file.
 * A new log file is created each time the server starts.
 * File: logs/dev-{timestamp}.log
 *
 * Only active in development (NODE_ENV !== 'production').
 * In production, falls back to console.log (Vercel captures these).
 */

import { appendFileSync, writeFileSync } from "fs";
import { join } from "path";

const IS_DEV = process.env.NODE_ENV !== "production";

// Generate log file path once per server start (cold start)
const LOG_FILE = IS_DEV
  ? join(
      process.cwd(),
      "logs",
      `dev-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.log`
    )
  : "";

// Write a header line on cold start
if (IS_DEV && LOG_FILE) {
  try {
    writeFileSync(
      LOG_FILE,
      `=== TW_RealEstate_ETL_Online Dev Log ===\n` +
        `=== Started: ${new Date().toISOString()} ===\n\n`
    );
  } catch {
    // logs/ directory might not exist in some environments
  }
}

/**
 * Log a structured entry to both file and console.
 * Each entry is a single JSON line for easy parsing.
 */
export function devLog(step: string, data: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    step,
    ...data,
  };

  const line = JSON.stringify(entry);

  // Always log to console (visible in terminal / Vercel logs)
  console.log(`[${entry.timestamp}] [${step}]`, JSON.stringify(data));

  // In dev, also append to file
  if (IS_DEV && LOG_FILE) {
    try {
      appendFileSync(LOG_FILE, line + "\n");
    } catch {
      // Silently fail — don't break the app for logging issues
    }
  }
}
