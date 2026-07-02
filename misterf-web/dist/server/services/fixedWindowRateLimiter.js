/**
 * In-memory fixed-window rate limiter for anonymous/guest actions. State is
 * per-process and resets on restart, which is enough to stop scripted flooding
 * of free write endpoints; it is not an account-level quota.
 */
export function createFixedWindowRateLimiter(input) {
    const buckets = new Map();
    return {
        allow(key, now = Date.now()) {
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
//# sourceMappingURL=fixedWindowRateLimiter.js.map