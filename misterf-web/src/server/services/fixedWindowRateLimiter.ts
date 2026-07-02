type RateLimitBucket = {
  count: number;
  limitLogged: boolean;
  windowStartedAt: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  /** True only for the first rejected action in a window, so callers log once. */
  shouldLogLimit: boolean;
};

/**
 * In-memory fixed-window rate limiter for anonymous/guest actions. State is
 * per-process and resets on restart, which is enough to stop scripted flooding
 * of free write endpoints; it is not an account-level quota.
 */
export function createFixedWindowRateLimiter(input: {
  maxActions: number;
  windowMs: number;
}) {
  const buckets = new Map<string, RateLimitBucket>();

  return {
    allow(key: string, now = Date.now()): RateLimitDecision {
      const bucket = buckets.get(key);
      if (!bucket || now - bucket.windowStartedAt >= input.windowMs) {
        buckets.set(key, {
          count: 1,
          limitLogged: false,
          windowStartedAt: now,
        });
        return { allowed: true, shouldLogLimit: false };
      }

      if (bucket.count >= input.maxActions) {
        if (bucket.limitLogged) {
          return { allowed: false, shouldLogLimit: false };
        }

        bucket.limitLogged = true;
        return { allowed: false, shouldLogLimit: true };
      }

      bucket.count += 1;
      return { allowed: true, shouldLogLimit: false };
    },
  };
}
