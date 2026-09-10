import { formatRelativeTime } from '../../shared/relativeTime.js';

export function formatConversationDates(root = document) {
  for (const date of root.querySelectorAll('.conversation-date, .practice-guide-chat-date')) {
    const rawValue = date.getAttribute('datetime') || date.textContent || '';
    date.textContent = formatConversationDate(rawValue.trim());
    date.title = rawValue.trim();
  }
}

export function formatConversationDate(value) {
  const date = parseConversationDate(value);
  if (!date) {
    return value;
  }

  return formatRelativeTime(date);
}

export function parseConversationDate(value) {
  if (!value) {
    return null;
  }

  // SQLite `CURRENT_TIMESTAMP` values carry no zone but are UTC; read them the
  // way the server does, or the label shifts by the viewer's UTC offset.
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
