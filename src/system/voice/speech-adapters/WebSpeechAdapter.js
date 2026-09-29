// system/voice/WebSpeechAdapter.js

import { SpeechAdapter } from "./SpeechAdapter";

/*const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-CA", label: "English (Canada)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-AU", label: "English (Australia)" },
  { value: "fr-CA", label: "French (Canada)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "es-US", label: "Spanish (US)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "it-IT", label: "Italian (Italy)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "nl-NL", label: "Dutch (Netherlands)" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
];*/

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-CA", label: "English (Canada)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-AU", label: "English (Australia)" },
];



export class WebSpeechAdapter extends SpeechAdapter {
  constructor(options = {}) {
    super(options);

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error("Web Speech API not supported in this browser.");
    }

    this.recognition = new SpeechRecognition();

    this.language =
      !options.language || options.language === "auto"
        ? "en-US"
        : options.language;

    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = this.language;

    this.shouldKeepListening = false;

    this.recognition.onresult = (event) => {
      if (!event.results || !event.results[0]) return;

      const result = event.results[event.resultIndex];
      if (!result || !result[0]) return;

      const text = result[0].transcript.trim();

      if (text.length > 0) {
        this.emitTranscript(text);
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      if (event.error === "aborted") return;

      console.error("WebSpeech error:", {
        error: event.error,
        message: event.message,
        lang: this.recognition.lang,
      });

      this.emitError(
        event.message
          ? `${event.error}: ${event.message}`
          : event.error
      );
    };

    this.recognition.onend = () => {
      if (this.shouldKeepListening) {
        try {
          this.recognition.start();
        } catch {
          setTimeout(() => {
            try {
              this.recognition.start();
            } catch {}
          }, 250);
        }
      } else {
        this.isListening = false;
        this.emitListeningChange(false);
      }
    };
  }

  setLanguage(lang) {
    this.language = !lang || lang === "auto" ? "en-US" : lang;
    this.recognition.lang = this.language;
  }

  getLanguageOptions() {
    return LANGUAGE_OPTIONS;
  }

  getAutoDetectLanguages() {
  return [];
}

  async initialize() {
    return true;
  }

  start() {
    if (this.isListening) return;

    this.shouldKeepListening = true;
    this.isListening = true;
    this.emitListeningChange(true);

    try {
      this.recognition.start();
    } catch (err) {
      this.isListening = false;
      this.emitListeningChange(false);
      this.emitError(err?.message || "Failed to start speech recognition.");
    }
  }

  stop() {
    this.shouldKeepListening = false;

    if (!this.isListening) return;

    this.recognition.stop();
    this.isListening = false;
    this.emitListeningChange(false);
  }

  destroy() {
    this.stop();
  }
}