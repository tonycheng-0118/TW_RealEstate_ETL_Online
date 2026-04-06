/**
 * Supabase PostgreSQL query executor.
 * Uses the app_reader role (read-only) with a 10s statement timeout.
 * Connection pooling via pg.Pool — reuses connections across requests
 * within the same serverless instance.
 */

import { Pool, type QueryResult } from "pg";

// Singleton pool — created once per serverless instance
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.SUPABASE_DB_URL;
    if (!connectionString) {
      throw new Error("SUPABASE_DB_URL environment variable is not set");
    }
    pool = new Pool({
      connectionString,
      max: 5, // Max connections per instance (serverless = low)
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

/**
 * Execute a read-only SQL query with a 10-second timeout.
 * Returns the query result rows.
 * Throws on connection error, timeout, or permission denied.
 */
export async function executeQuery(sql: string): Promise<QueryResult> {
  const client = await getPool().connect();
  try {
    // Set 10s timeout for this session — prevents runaway queries
    await client.query("SET statement_timeout = '10s'");
    const result = await client.query(sql);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Check the latest ETL import status.
 * Used when a query returns empty results to inform the user
 * about data freshness.
 */
/**
 * Get the date range of transaction data in the database.
 * Used to inform users about available data when queries return empty.
 */
export async function getDataDateRange(): Promise<{
  earliest: string;
  latest: string;
} | null> {
  const result = await executeQuery(
    `SELECT
       MIN(transaction_date_ad) as earliest,
       MAX(transaction_date_ad) as latest
     FROM transactions
     WHERE transaction_date_ad IS NOT NULL`
  );
  if (result.rows.length === 0 || !result.rows[0].earliest) return null;
  return {
    earliest: result.rows[0].earliest,
    latest: result.rows[0].latest,
  };
}

export async function getLatestEtlStatus(): Promise<{
  season: string;
  finishedAt: string;
} | null> {
  const result = await executeQuery(
    `SELECT season, finished_at
     FROM etl_log
     WHERE status = 'success'
     ORDER BY finished_at DESC
     LIMIT 1`
  );
  if (result.rows.length === 0) return null;
  return {
    season: result.rows[0].season,
    finishedAt: result.rows[0].finished_at,
  };
}
