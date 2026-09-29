// system/voice/AzureSpeechAdapter.js

import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { SpeechAdapter } from "./SpeechAdapter.js";
import api from "../../api/axios.js";

export class AzureSpeechAdapter extends SpeechAdapter {
  constructor(options = {}) {
    super(options);
    this.recognizer = null;
    this.initializing = false;
    this.language = options.language || "auto";
  }

  // 🔹 Allow runtime language switching
  setLanguage(lang) {
    this.language = lang;

    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }
  }

  async initialize() {
    if (this.recognizer || this.initializing) return;

    this.initializing = true;

    try {
      const res = await api.get("/api/speech/token");
      const { token, region } = res.data;

      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
        token,
        region,
      );

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      // 🔹 AUTO MODE
      if (this.language === "auto") {
        const autoDetectConfig =
          SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages([
            "en-US",
            "fr-CA",
            "es-ES",
            "hi-IN",
          ]);
        this.recognizer = SpeechSDK.SpeechRecognizer.FromConfig(
          speechConfig,
          autoDetectConfig,
          audioConfig,
        );
      }
      // 🔹 FORCED LANGUAGE MODE
      else {
        speechConfig.speechRecognitionLanguage = this.language;

        this.recognizer = new SpeechSDK.SpeechRecognizer(
          speechConfig,
          audioConfig,
        );
      }

      this.recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const text = e.result.text;

          let detectedLang = this.language;

          if (this.language === "auto") {
            const langResult =
              SpeechSDK.AutoDetectSourceLanguageResult.fromResult(e.result);

            detectedLang = langResult.language;
          }

          if (text) {
            this.emitTranscript({
              text,
              language: detectedLang || "en-US",
            });
          }
        }
      };

      this.recognizer.canceled = (s, e) => {
        this.isListening = false;
        this.emitListeningChange(false);

        this.emitError(e.errorDetails || "Speech canceled");

        this.recognizer.close();
        this.recognizer = null;
      };
    } catch (err) {
      console.error("Azure speech init error:", err);
      this.emitError("Failed to initialize speech");
    }

    this.initializing = false;
  }

  async start() {
    if (this.isListening) return;

    if (!this.recognizer) {
      await this.initialize();
    }

    if (!this.recognizer) return;

    this.recognizer.startContinuousRecognitionAsync(
      () => {
        this.isListening = true;
        this.emitListeningChange(true);
      },
      (err) => {
        this.emitError(err);
      },
    );
  }

  stop() {
    if (!this.recognizer || !this.isListening) return;

    this.recognizer.stopContinuousRecognitionAsync(
      () => {
        this.isListening = false;
        this.emitListeningChange(false);
      },
      (err) => {
        this.emitError(err);
      },
    );
  }
}
