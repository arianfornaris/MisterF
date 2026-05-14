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
