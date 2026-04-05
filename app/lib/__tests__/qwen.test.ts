import { describe, it, expect } from "vitest";
import { extractSql, stripThinking } from "../qwen";

describe("extractSql", () => {
  it("returns plain SQL as-is", () => {
    const sql = "SELECT * FROM transactions";
    expect(extractSql(sql)).toBe(sql);
  });

  it("strips ```sql code block wrapper", () => {
    const input = "```sql\nSELECT * FROM transactions\n```";
    expect(extractSql(input)).toBe("SELECT * FROM transactions");
  });

  it("strips ``` code block without sql tag", () => {
    const input = "```\nSELECT 1\n```";
    expect(extractSql(input)).toBe("SELECT 1");
  });

  it("strips <think> tags before extracting SQL", () => {
    const input =
      "<think>\nsome reasoning\n</think>\nSELECT * FROM transactions";
    expect(extractSql(input)).toBe("SELECT * FROM transactions");
  });

  it("handles <think> tags + code block together", () => {
    const input =
      "<think>\nreasoning here\n</think>\n```sql\nSELECT 1\n```";
    expect(extractSql(input)).toBe("SELECT 1");
  });

  it("trims whitespace", () => {
    expect(extractSql("  SELECT 1  ")).toBe("SELECT 1");
  });
});

describe("stripThinking", () => {
  it("removes <think> blocks", () => {
    const input = "<think>\nlong reasoning\n</think>\n\nHello world";
    expect(stripThinking(input)).toBe("Hello world");
  });

  it("removes multiple <think> blocks", () => {
    const input =
      "<think>first</think>A<think>second</think>B";
    expect(stripThinking(input)).toBe("AB");
  });

  it("returns text as-is when no think tags", () => {
    expect(stripThinking("Hello world")).toBe("Hello world");
  });

  it("handles empty think blocks", () => {
    expect(stripThinking("<think></think>OK")).toBe("OK");
  });
});
