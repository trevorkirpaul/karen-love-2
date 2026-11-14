export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
};

const requestLog = new Map<string, number[]>();

/**
 * Checks whether a client key (e.g., IP address) is within the sliding-window rate limit.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = DEFAULT_OPTIONS,
  now: number = Date.now(),
): RateLimitResult {
  const windowStart = now - options.windowMs;
  const timestamps = (requestLog.get(key) ?? []).filter((ts) => ts > windowStart);

  if (timestamps.length >= options.maxRequests) {
    const oldestInWindow = timestamps[0] ?? now;
    const retryAfterMs = Math.max(0, oldestInWindow + options.windowMs - now);
    requestLog.set(key, timestamps);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  timestamps.push(now);
  requestLog.set(key, timestamps);

  return {
    allowed: true,
    remaining: Math.max(0, options.maxRequests - timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function clearRateLimitStore(): void {
  requestLog.clear();
}
