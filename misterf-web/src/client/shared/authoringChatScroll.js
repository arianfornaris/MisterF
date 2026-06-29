export function initializeAuthoringChatScroll(root = document) {
  const historyEl = root.querySelector('[data-authoring-chat-history]');
  if (!(historyEl instanceof HTMLElement)) {
    return;
  }

  const scrollToLatestMessage = () => {
    historyEl.scrollTop = historyEl.scrollHeight;
  };

  requestAnimationFrame(() => {
    scrollToLatestMessage();
    requestAnimationFrame(scrollToLatestMessage);
  });
}
