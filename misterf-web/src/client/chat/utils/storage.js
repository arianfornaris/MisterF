export const guestDraftStorageKey = 'misterf.guestDraft';

export function preserveGuestDraft(content) {
  sessionStorage.setItem(guestDraftStorageKey, content);
}

export function getGuestDraft() {
  return sessionStorage.getItem(guestDraftStorageKey) || '';
}

export function consumeGuestDraft() {
  const draft = getGuestDraft();
  sessionStorage.removeItem(guestDraftStorageKey);
  return draft;
}

/*
 * The learning home's "Ask Mr. F" box hands its text and its accepted
 * attachments to the chat through sessionStorage rather than the URL, so what a
 * learner typed never lands in a query string, the server log, or the browser
 * history. Attachments travel as summaries (staged id + display metadata); the
 * extracted text stays on the server until the chat claims the ids on send.
 *
 * Unlike the guest draft it is only placed in the composer, never sent: the
 * learner presses send, so opening the chat from the home never spends credit
 * on its own.
 */
export const homeDraftStorageKey = 'misterf.homeDraft';

export function preserveHomeDraft({ attachments, text }) {
  sessionStorage.setItem(homeDraftStorageKey, JSON.stringify({ attachments, text }));
}

export function consumeHomeDraft() {
  const raw = sessionStorage.getItem(homeDraftStorageKey);
  sessionStorage.removeItem(homeDraftStorageKey);

  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  return {
    attachments: Array.isArray(parsed?.attachments) ? parsed.attachments : [],
    text: typeof parsed?.text === 'string' ? parsed.text : '',
  };
}
