/**
 * SQL Guard — validates AI-generated SQL before execution.
 *
 * Four-layer security (this module handles layer 1):
 * 1. Application-layer whitelist (this file)
 * 2. DB read-only role (app_reader, SELECT only)
 * 3. Query timeout (10s, set in db.ts)
 * 4. Rate limiting (rate-limit.ts)
 */

// Dangerous SQL keywords that should never appear in AI-generated queries
const DANGEROUS_KEYWORDS = [
  "DROP",
  "ALTER",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "EXECUTE",
  "EXEC",
  "CREATE",
  "GRANT",
  "REVOKE",
  "COPY",
  "\\\\", // psql meta-commands
];

// Build a single regex that matches any dangerous keyword as a whole word
const DANGEROUS_REGEX = new RegExp(
  `\\b(${DANGEROUS_KEYWORDS.join("|")})\\b`,
  "i"
);

export interface SqlGuardResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an AI-generated SQL string.
 * Returns { valid: true } if safe to execute, or
 * { valid: false, error: "reason" } if rejected.
 */
export function validateSql(sql: string): SqlGuardResult {
  const trimmed = sql.trim();

  // Rule 1: Must not be empty
  if (!trimmed) {
    return { valid: false, error: "SQL 為空" };
  }

  // Rule 2: Must start with SELECT (case-insensitive)
  if (!/^SELECT\b/i.test(trimmed)) {
    return { valid: false, error: "僅允許 SELECT 查詢" };
  }

  // Rule 3: No semicolons (prevent multi-statement injection)
  if (trimmed.includes(";")) {
    return { valid: false, error: "不允許多條 SQL 語句" };
  }

  // Rule 4: No dangerous keywords
  const match = DANGEROUS_REGEX.exec(trimmed);
  if (match) {
    return { valid: false, error: `不允許使用 ${match[1].toUpperCase()} 語句` };
  }

  // Rule 5: Reject obvious comment-based injection attempts
  if (trimmed.includes("--") || trimmed.includes("/*")) {
    return { valid: false, error: "不允許 SQL 註解" };
  }

  return { valid: true };
}
