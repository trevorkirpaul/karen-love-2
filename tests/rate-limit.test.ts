import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clearRateLimitStore } from "@/lib/contact/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it("allows requests up to the configured limit and blocks subsequent ones", () => {
    const options = { maxRequests: 3, windowMs: 60_000 };
    const now = 1_000_000;

    expect(checkRateLimit("1.2.3.4", options, now)).toEqual({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0,
    });
    expect(checkRateLimit("1.2.3.4", options, now + 1000)).toEqual({
      allowed: true,
      remaining: 1,
      retryAfterSeconds: 0,
    });
    expect(checkRateLimit("1.2.3.4", options, now + 2000)).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterSeconds: 0,
    });

    const blocked = checkRateLimit("1.2.3.4", options, now + 3000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(57);
  });

  it("resets once the window expires", () => {
    const options = { maxRequests: 1, windowMs: 10_000 };
    const now = 1_000_000;

    expect(checkRateLimit("1.2.3.4", options, now).allowed).toBe(true);
    expect(checkRateLimit("1.2.3.4", options, now + 5000).allowed).toBe(false);
    expect(checkRateLimit("1.2.3.4", options, now + 10_001).allowed).toBe(true);
  });

  it("tracks different IP keys independently", () => {
    const options = { maxRequests: 1, windowMs: 60_000 };
    const now = 1_000_000;

    expect(checkRateLimit("10.0.0.1", options, now).allowed).toBe(true);
    expect(checkRateLimit("10.0.0.2", options, now).allowed).toBe(true);
    expect(checkRateLimit("10.0.0.1", options, now + 100).allowed).toBe(false);
  });
});
