import { describe, expect, it } from 'vitest';
import { createFixedWindowRateLimiter } from '../../src/server/services/fixedWindowRateLimiter.js';

describe('createFixedWindowRateLimiter', () => {
  it('allows actions up to the limit and rejects the rest of the window', () => {
    const limiter = createFixedWindowRateLimiter({ maxActions: 3, windowMs: 1000 });
    const now = 1_000_000;

    expect(limiter.allow('ip:a', now).allowed).toBe(true);
    expect(limiter.allow('ip:a', now + 1).allowed).toBe(true);
    expect(limiter.allow('ip:a', now + 2).allowed).toBe(true);
    expect(limiter.allow('ip:a', now + 3).allowed).toBe(false);
    expect(limiter.allow('ip:a', now + 4).allowed).toBe(false);
  });

  it('asks callers to log only the first rejection per window', () => {
    const limiter = createFixedWindowRateLimiter({ maxActions: 1, windowMs: 1000 });
    const now = 1_000_000;

    expect(limiter.allow('ip:a', now)).toEqual({ allowed: true, shouldLogLimit: false });
    expect(limiter.allow('ip:a', now + 1)).toEqual({ allowed: false, shouldLogLimit: true });
    expect(limiter.allow('ip:a', now + 2)).toEqual({ allowed: false, shouldLogLimit: false });
  });

  it('resets the count when the window elapses', () => {
    const limiter = createFixedWindowRateLimiter({ maxActions: 1, windowMs: 1000 });
    const now = 1_000_000;

    expect(limiter.allow('ip:a', now).allowed).toBe(true);
    expect(limiter.allow('ip:a', now + 999).allowed).toBe(false);
    expect(limiter.allow('ip:a', now + 1000).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    const limiter = createFixedWindowRateLimiter({ maxActions: 1, windowMs: 1000 });
    const now = 1_000_000;

    expect(limiter.allow('ip:a', now).allowed).toBe(true);
    expect(limiter.allow('ip:b', now).allowed).toBe(true);
    expect(limiter.allow('ip:a', now + 1).allowed).toBe(false);
    expect(limiter.allow('ip:b', now + 1).allowed).toBe(false);
  });
});
