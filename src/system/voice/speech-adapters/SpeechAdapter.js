// system/voice/SpeechAdapter.js

export class SpeechAdapter {
  constructor(options = {}) {
    this.options = options;
    this.isListening = false;
    this._onTranscript = null;
    this._onError = null;
    this._onListeningChange = null;
  }

  async initialize() {
    throw new Error("initialize() must be implemented");
  }

  start() {
    throw new Error("start() must be implemented");
  }

  stop() {
    throw new Error("stop() must be implemented");
  }

  destroy() {
    throw new Error("destroy() must be implemented");
  }

  onTranscript(callback) {
    this._onTranscript = callback;
  }

  onError(callback) {
    this._onError = callback;
  }

  onListeningChange(callback) {
    this._onListeningChange = callback;
  }

  emitTranscript(text) {
    if (this._onTranscript) this._onTranscript(text);
  }

  emitError(err) {
    if (this._onError) this._onError(err);
  }

  emitListeningChange(value) {
    if (this._onListeningChange) {
      this._onListeningChange(value);
    }
  }
}