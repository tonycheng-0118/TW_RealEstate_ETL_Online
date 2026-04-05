import { describe, it, expect } from "vitest";
import { validateSql } from "../sql-guard";

describe("validateSql", () => {
  // --- Valid queries ---
  it("allows simple SELECT", () => {
    expect(validateSql("SELECT * FROM transactions")).toEqual({ valid: true });
  });

  it("allows SELECT with WHERE, GROUP BY, ORDER BY", () => {
    const sql =
      "SELECT district, AVG(unit_price) FROM transactions WHERE city_code = 'A' GROUP BY district ORDER BY district";
    expect(validateSql(sql)).toEqual({ valid: true });
  });

  it("allows case-insensitive SELECT", () => {
    expect(validateSql("select district from transactions")).toEqual({
      valid: true,
    });
  });

  // --- Blocked: not SELECT ---
  it("rejects empty SQL", () => {
    const r = validateSql("");
    expect(r.valid).toBe(false);
  });

  it("rejects non-SELECT statements", () => {
    const r = validateSql("INSERT INTO transactions VALUES (1)");
    expect(r.valid).toBe(false);
  });

  // --- Blocked: dangerous keywords ---
  it("rejects DROP", () => {
    const r = validateSql("SELECT 1; DROP TABLE transactions");
    expect(r.valid).toBe(false);
  });

  it("rejects DELETE", () => {
    const r = validateSql("DELETE FROM transactions");
    expect(r.valid).toBe(false);
  });

  it("rejects ALTER", () => {
    const r = validateSql("ALTER TABLE transactions ADD COLUMN x TEXT");
    expect(r.valid).toBe(false);
  });

  it("rejects TRUNCATE", () => {
    const r = validateSql("TRUNCATE transactions");
    expect(r.valid).toBe(false);
  });

  it("rejects UPDATE", () => {
    const r = validateSql("UPDATE transactions SET district = 'x'");
    expect(r.valid).toBe(false);
  });

  // --- Blocked: semicolons ---
  it("rejects semicolons (multi-statement)", () => {
    const r = validateSql("SELECT 1; SELECT 2");
    expect(r.valid).toBe(false);
  });

  // --- Blocked: comments ---
  it("rejects -- comments", () => {
    const r = validateSql("SELECT * FROM transactions -- drop table");
    expect(r.valid).toBe(false);
  });

  it("rejects /* */ comments", () => {
    const r = validateSql("SELECT * FROM transactions /* malicious */");
    expect(r.valid).toBe(false);
  });
});
