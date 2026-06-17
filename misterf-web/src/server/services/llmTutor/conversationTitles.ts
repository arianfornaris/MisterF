export function normalizeConversationTitle(title?: string): string {
  return title?.replace(/\s+/g, ' ').trim().slice(0, 90) ?? '';
}

export function isGenericConversationTitle(title: string): boolean {
  const normalized = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return (
    normalized === '' ||
    normalized === 'nueva conversacion' ||
    normalized === 'new conversation' ||
    normalized === 'conversacion' ||
    normalized === 'conversation'
  );
}
