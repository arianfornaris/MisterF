import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireSessionSecret } from './session.js';

/**
 * Two cheap, frictionless checks on the signup form, added after the
 * 2026-08-29 log review found 378 scripted registrations (roadmap v3 §2.7).
 *
 * They are deliberately not a bot *identification* system. The measured
 * attacker spreads over 231 IPs at a median of an hour apart behind a single
 * ordinary Chrome user agent, so neither reputation nor fingerprinting was a
 * usable signal. What the attacker does do is drive the form as a script: it
 * fetches `GET /signup`, parses out the CSRF token, and posts the fields back.
 * Both checks target that behaviour rather than the identity behind it.
 *
 * Neither check adds a step for a real person, which is why they can ship
 * ahead of a decision on Turnstile.
 */

/**
 * Name of the decoy input on the signup form. It is positioned off-screen and
 * removed from the tab order, so a person never sees it and cannot reach it —
 * only a script that fills every input it finds will populate it.
 *
 * The name matters: it has to look meaningful enough for a script to fill, yet
 * be something no password manager would ever autofill. `website` satisfies
 * both, and autofill is the only realistic source of a false positive here.
 */
export const signupHoneypotField = 'website';

/**
 * Signup asks for a name, an email address and two copies of a password.
 * Nobody produces all four in under two seconds, so a faster submission is a
 * script replaying a parsed form rather than a person filling one. The bound
 * is deliberately far below human speed: it costs a real user nothing, and
 * re-rendering the form issues a fresh stamp, so a rejected person who simply
 * submits again passes.
 */
const minimumFillMs = 2_000;

export type SignupBotSignal =
  | 'honeypot_filled'
  | 'invalid_stamp'
  | 'missing_stamp'
  | 'submitted_too_fast';

export type SignupSubmissionVerdict =
  | { accepted: true }
  | { accepted: false; signal: SignupBotSignal };

/**
 * Issues the "this form was rendered at" stamp embedded in the signup form.
 *
 * It is signed rather than trusted because the age it carries is exactly what
 * the timing check reads. It carries no nonce and never expires: replaying an
 * old stamp only makes a submission look slower, which is never an advantage,
 * and an unbounded lifetime means a form left open in a tab is never rejected
 * for being stale. The CSRF token already bounds how long the form stays
 * postable.
 */
export function createSignupFormStamp(now = Date.now()): string {
  const renderedAt = String(now);
  return `${renderedAt}.${sign(renderedAt)}`;
}

/**
 * Decides whether a signup submission came from the rendered form or from a
 * script driving it. Returns the signal that fired so the caller can log which
 * check is actually earning its place.
 */
export function evaluateSignupSubmission(input: {
  honeypotValue: string;
  now?: number;
  stamp: string;
}): SignupSubmissionVerdict {
  if (input.honeypotValue.trim()) {
    return { accepted: false, signal: 'honeypot_filled' };
  }

  if (!input.stamp) {
    return { accepted: false, signal: 'missing_stamp' };
  }

  const [renderedAt, signature, extra] = input.stamp.split('.');
  if (!renderedAt || !signature || extra) {
    return { accepted: false, signal: 'invalid_stamp' };
  }

  if (!safeEquals(signature, sign(renderedAt))) {
    return { accepted: false, signal: 'invalid_stamp' };
  }

  const renderedAtMs = Number.parseInt(renderedAt, 10);
  if (!Number.isFinite(renderedAtMs)) {
    return { accepted: false, signal: 'invalid_stamp' };
  }

  const now = input.now ?? Date.now();
  if (now - renderedAtMs < minimumFillMs) {
    return { accepted: false, signal: 'submitted_too_fast' };
  }

  return { accepted: true };
}

function sign(value: string): string {
  return createHmac('sha256', requireSessionSecret())
    .update(`signup-form:${value}`)
    .digest('base64url');
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
