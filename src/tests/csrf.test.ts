import { describe, expect, it } from "vitest";

import { createCsrfToken, verifyCsrfToken } from "@/lib/csrf";

describe("CSRF Token", () => {
  it("generates and verifies token for session", () => {
    const sessionId = "user-123";
    const { token } = createCsrfToken(sessionId);
    expect(verifyCsrfToken(sessionId, token, token)).toBe(true);
  });

  it("rejects mismatched tokens", () => {
    const sessionId = "user-456";
    const { token } = createCsrfToken(sessionId);
    expect(verifyCsrfToken(sessionId, token, token + "x")).toBe(false);
    expect(verifyCsrfToken(sessionId, token + "y", token)).toBe(false);
  });
});
