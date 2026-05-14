export class MessageRenderer {
  constructor(methods) {
    this.methods = methods;
  }

  appendMessage(...args) {
    return this.methods.appendMessage(...args);
  }

  appendStoredMessage(...args) {
    return this.methods.appendStoredMessage(...args);
  }

  updateRenderedMessage(...args) {
    return this.methods.updateRenderedMessage(...args);
  }

  renderSentenceEvaluationOnLastAssistant(...args) {
    return this.methods.renderSentenceEvaluationOnLastAssistant(...args);
  }
}
