import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit } from "../rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Advance time past any existing windows so all IPs start fresh
    vi.useFakeTimers();
    vi.advanceTimersByTime(120_000);
  });

  it("allows requests within the limit", () => {
    const ip = "test-allow";
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(ip).allowed).toBe(true);
    }
  });

  it("rejects requests over the limit", () => {
    const ip = "test-reject";
    // Use up the 10 allowed requests
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip);
    }
    // 11th should be rejected
    const result = checkRateLimit(ip);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window expires", () => {
    const ip = "test-reset";
    // Use up all requests
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip);
    }
    expect(checkRateLimit(ip).allowed).toBe(false);

    // Advance past the 1-minute window
    vi.advanceTimersByTime(61_000);

    // Should be allowed again
    expect(checkRateLimit(ip).allowed).toBe(true);
  });

  it("tracks IPs independently", () => {
    const ip1 = "test-ip1";
    const ip2 = "test-ip2";
    // Use up ip1's limit
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip1);
    }
    expect(checkRateLimit(ip1).allowed).toBe(false);
    // ip2 should still be allowed
    expect(checkRateLimit(ip2).allowed).toBe(true);
  });
});
