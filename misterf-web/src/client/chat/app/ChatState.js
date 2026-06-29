export class ChatState {
  constructor(initial = {}) {
    this.conversationId = initial.conversationId ?? '';
    this.streamingBubble = null;
    this.isAssistantBusy = false;
    this.pendingDeleteTarget = null;
    this.pendingPracticeGuideStart = false;
    this.isAssistantStopping = false;
    this.isGuestPromptPending = false;
    this.guestPromptTimerId = 0;
    this.disconnectNoticeTimerId = 0;
    this.pendingTranslatorSelection = '';
    this.userInputHistory = [];
    this.userInputHistoryIndex = -1;
    this.userInputDraftBeforeHistory = '';
    this.pendingBootGuestDraft = '';
    this.hasHandledInitialConversationReady = false;
    this.toolStatusRow = null;
    this.matchingExerciseStates = new Map();
  }
}
