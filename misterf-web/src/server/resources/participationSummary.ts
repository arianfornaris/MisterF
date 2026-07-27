import { translate, type Locale } from '../i18n/index.js';
import { getCreditExhaustedMessage } from '../services/creditGate.js';

/** Reads a short query-string code defensively (arrays, non-strings, length). */
function readErrorCode(value: unknown): string {
  if (Array.isArray(value)) {
    return readErrorCode(value[0]);
  }
  return typeof value === 'string' ? value.trim().slice(0, 20) : '';
}

/**
 * Identifies what an owner-generated participation summary was built from, so
 * the page can flag it as stale once new participation arrives. Same contract as
 * the quiz responses fingerprint: how many finished items fed the summary, plus
 * the most recent update among them.
 */
export function computeParticipationFingerprint(
  items: Array<{ status?: string; updatedAt: string }>,
  options: { finishedStatus?: string } = {},
): string {
  const finishedStatus = options.finishedStatus ?? 'evaluated';
  let finishedCount = 0;
  let latestUpdatedAt = '';
  for (const item of items) {
    if (item.status !== undefined && item.status !== finishedStatus) {
      continue;
    }
    finishedCount += 1;
    if (item.updatedAt > latestUpdatedAt) {
      latestUpdatedAt = item.updatedAt;
    }
  }
  return `${finishedCount}:${latestUpdatedAt}`;
}

/**
 * Turns the `?summaryError=` code the generate handlers redirect with back into
 * a message. Shared by the roleplay and practice-guide participation pages.
 */
export function readParticipationSummaryError(
  value: unknown,
  locale: Locale,
): { isCredit: boolean; message: string } | null {
  const code = readErrorCode(value);
  if (code === 'credit') {
    return {
      isCredit: true,
      message: getCreditExhaustedMessage(locale),
    };
  }
  if (code === 'empty') {
    return {
      isCredit: false,
      message: translate(locale, 'quizzes.summaryErrorEmpty'),
    };
  }
  if (code === 'generic') {
    return {
      isCredit: false,
      message: translate(locale, 'quizzes.summaryErrorGeneric'),
    };
  }
  return null;
}
