/**
 * Programmatic unit conversion layer for DB query results.
 *
 * Runs BETWEEN the SQL query (Pass 1) and the LLM formatter (Pass 2)
 * so that Pass 2 never has to do any math — it just uses the
 * pre-computed values directly.
 *
 * Conversion rules:
 *   - Area fields (m²)  → _ping  (坪 = m² ÷ 3.306)
 *   - Price fields (元)  → _wan   (萬元 = 元 ÷ 10000)
 *   - Unit price (元/m²) → _wan_ping (萬元/坪 = 元/m² × 3.306 ÷ 10000)
 *   - Rent fields        → NOT converted to 萬 (kept as 元)
 *   - Unit rent (元/m²)  → _ping  (元/坪 = 元/m² × 3.306)
 *   - Zero-area anomaly  → _note annotation when building_area=0 but unit_price>0
 *
 * Column detection works on both English column names (building_area,
 * total_price) and Chinese SQL aliases (平均面積, 最高總價).
 */

// 1 坪 = 3.306 m²
const PING_PER_SQM = 3.306;
const WAN_DIVISOR = 10000;

// ---------------------------------------------------------------------------
// Column classification helpers
// ---------------------------------------------------------------------------

/** Rent-related columns — must be checked BEFORE price/unit-price patterns. */
function isRentColumn(key: string): boolean {
  // English: total_rent
  if (key === "total_rent") return true;
  // Chinese aliases containing 租金 or 月租
  return /租金|月租/.test(key);
}

/** Unit rent — convert to 元/坪, NOT 萬元/坪. */
function isUnitRentColumn(key: string): boolean {
  if (key === "unit_rent") return true;
  // Chinese alias with both 單 and 租 (e.g. 平均單位租金)
  return /單.*租|租.*單/.test(key);
}

/** Unit price columns (元/m²) — e.g. unit_price, 平均單價. */
function isUnitPriceColumn(key: string): boolean {
  if (key === "unit_price") return true;
  return /單價/.test(key);
}

/** Area columns (m²) — e.g. building_area, land_area, 平均面積. */
function isAreaColumn(key: string): boolean {
  if (key.endsWith("_area")) return true;
  return /面積/.test(key);
}

/** Price columns (元) — e.g. total_price, parking_price, 最高總價. */
function isPriceColumn(key: string): boolean {
  if (key === "total_price" || key === "parking_price") return true;
  return /總價|房價|金額/.test(key);
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/** Round to N decimal places (avoids floating-point drift). */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Safely extract a finite positive number from an unknown DB value.
 * Returns null for null, undefined, non-numeric, zero, or negative values.
 */
function toPositiveNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

// ---------------------------------------------------------------------------
// Core conversion for a single row
// ---------------------------------------------------------------------------

/**
 * Enrich a single DB row with pre-computed conversion fields.
 * Scans each key, classifies it, and appends the converted value.
 *
 * Classification priority (checked in order, first match wins):
 *   1. Rent columns      → skip (no _wan conversion)
 *   2. Unit rent columns → _ping (元/坪)
 *   3. Unit price columns → _wan_ping (萬元/坪)
 *   4. Area columns      → _ping (坪)
 *   5. Price columns     → _wan (萬元)
 */
function enrichRow(row: Record<string, unknown>): Record<string, unknown> {
  const enriched: Record<string, unknown> = { ...row };

  for (const key of Object.keys(row)) {
    const positiveVal = toPositiveNumber(row[key]);

    // --- Classification (order matters!) ---

    // 1. Rent columns: no conversion at all
    if (isRentColumn(key)) {
      continue;
    }

    // 2. Unit rent → 元/坪 (not 萬/坪)
    if (isUnitRentColumn(key)) {
      enriched[`${key}_ping`] = positiveVal
        ? round(positiveVal * PING_PER_SQM, 2)
        : null;
      continue;
    }

    // 3. Unit price → 萬元/坪
    if (isUnitPriceColumn(key)) {
      enriched[`${key}_wan_ping`] = positiveVal
        ? round((positiveVal * PING_PER_SQM) / WAN_DIVISOR, 2)
        : null;
      continue;
    }

    // 4. Area → 坪
    if (isAreaColumn(key)) {
      enriched[`${key}_ping`] = positiveVal
        ? round(positiveVal / PING_PER_SQM, 2)
        : null;
      continue;
    }

    // 5. Price → 萬元
    if (isPriceColumn(key)) {
      enriched[`${key}_wan`] = positiveVal
        ? round(positiveVal / WAN_DIVISOR, 2)
        : null;
      continue;
    }
  }

  // --- Zero-area anomaly annotation ---
  // building_area is 0/null but unit_price exists → likely land-only transaction
  const buildingArea = toPositiveNumber(row["building_area"]);
  const unitPrice = toPositiveNumber(row["unit_price"]);
  if (!buildingArea && unitPrice) {
    enriched["building_area_note"] = "僅土地交易，無建物面積";
  }

  return enriched;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pre-process an array of DB result rows by appending programmatically
 * converted fields (_ping, _wan, _wan_ping) so that Pass 2 LLM never
 * needs to do any math.
 *
 * @param rows - Raw DB query result rows
 * @returns Enriched rows with conversion fields appended
 */
export function formatResultRows(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return rows.map(enrichRow);
}
