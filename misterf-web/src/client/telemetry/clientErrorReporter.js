const endpoint = '/telemetry/client-error';
const maxReportsPerPage = 5;
const maxReportsPerMinute = 3;
const maxMessageLength = 500;
const maxStackLength = 2500;

const seenFingerprints = new Set();
let reportsSent = 0;
let minuteWindowStartedAt = Date.now();
let reportsSentInMinute = 0;

function truncate(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function getRoute() {
  return window.location.pathname || '/';
}

function getConversationIdFromRoute(route) {
  const tutorMatch = route.match(/^\/c\/([^/?#]+)/);
  if (tutorMatch?.[1]) {
    return decodeURIComponent(tutorMatch[1]);
  }

  const chatRoomMatch = route.match(/^\/chatroom-conversations\/([^/?#]+)/);
  if (chatRoomMatch?.[1]) {
    return decodeURIComponent(chatRoomMatch[1]);
  }

  return '';
}

function hashText(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function buildFingerprint(input) {
  return hashText([
    input.type || 'frontend_error',
    input.message || '',
    (input.stack || '').split('\n').slice(0, 4).join('\n'),
    input.source || '',
    input.route || '',
  ].join('\n'));
}

function canSendReport(fingerprint) {
  const now = Date.now();
  if (now - minuteWindowStartedAt >= 60 * 1000) {
    minuteWindowStartedAt = now;
    reportsSentInMinute = 0;
  }

  if (
    reportsSent >= maxReportsPerPage ||
    reportsSentInMinute >= maxReportsPerMinute ||
    seenFingerprints.has(fingerprint)
  ) {
    return false;
  }

  seenFingerprints.add(fingerprint);
  reportsSent += 1;
  reportsSentInMinute += 1;
  return true;
}

function sendPayload(payload) {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    }

    void fetch(endpoint, {
      body,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      method: 'POST',
    }).catch(() => {
      // Reporting is best-effort. Never create a client error loop.
    });
  } catch {
    // Reporting is best-effort. Never create a client error loop.
  }
}

function normalizeErrorPayload(input) {
  const route = getRoute();
  const message = truncate(input.message || 'Unknown client error.', maxMessageLength);
  const stack = truncate(input.stack || '', maxStackLength);
  const payload = {
    column: Number.isInteger(input.column) ? input.column : null,
    conversationId: getConversationIdFromRoute(route),
    level: input.level === 'warning' ? 'warning' : 'error',
    line: Number.isInteger(input.line) ? input.line : null,
    message,
    route,
    source: truncate(input.source || '', 500),
    stack,
    timestamp: new Date().toISOString(),
    type: truncate(input.type || 'frontend_error', 80),
    userAgent: truncate(window.navigator.userAgent || '', 500),
  };

  return {
    ...payload,
    fingerprint: truncate(input.fingerprint || buildFingerprint(payload), 160),
    repeatCount: 1,
  };
}

function reportClientError(input) {
  try {
    const payload = normalizeErrorPayload(input || {});
    if (!payload.message || !canSendReport(payload.fingerprint)) {
      return false;
    }

    sendPayload(payload);
    return true;
  } catch {
    return false;
  }
}

window.addEventListener('error', (event) => {
  reportClientError({
    column: event.colno,
    line: event.lineno,
    message: event.message,
    source: event.filename,
    stack: event.error?.stack,
    type: 'window_error',
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportClientError({
    message: reason instanceof Error ? reason.message : String(reason || 'Unhandled rejection.'),
    stack: reason instanceof Error ? reason.stack : '',
    type: 'unhandled_rejection',
  });
});

window.MisterFClientTelemetry = {
  ...(window.MisterFClientTelemetry || {}),
  reportError: reportClientError,
};
