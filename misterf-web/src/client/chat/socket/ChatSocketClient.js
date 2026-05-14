export class ChatSocketClient {
  constructor(socket) {
    this.socket = socket;
  }

  on(eventName, handler) {
    this.socket?.on(eventName, handler);
  }

  emit(eventName, payload) {
    this.socket?.emit(eventName, payload);
  }

  get raw() {
    return this.socket;
  }
}
