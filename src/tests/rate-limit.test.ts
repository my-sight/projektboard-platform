import { describe, expect, it } from "vitest";

import { assertRateLimit } from "@/lib/rate-limit";

describe("Rate Limiter", () => {
  it("allows requests within the limit", () => {
    expect(() => {
      for (let i = 0; i < 5; i += 1) {
        assertRateLimit("test-user");
      }
    }).not.toThrow();
  });

  it("blocks when exceeding limit", () => {
    const key = `limit-${Date.now()}`;
    let thrown = false;
    try {
      for (let i = 0; i < 100; i += 1) {
        assertRateLimit(key);
      }
    } catch (error) {
      thrown = true;
      expect((error as { status?: number }).status).toBe(429);
    }
    expect(thrown).toBe(true);
  });
});
