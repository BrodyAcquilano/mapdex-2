// system/voice/AzureSpeechAdapter.js

import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { SpeechAdapter } from "./SpeechAdapter.js";
import api from "../../../api/axios.js";

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto Detect" },
  { value: "en-US", label: "English (US)" },
  { value: "en-CA", label: "English (Canada)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-IN", label: "English (India)" },
  { value: "fr-CA", label: "French (Canada)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "es-MX", label: "Spanish (Mexico)" },
  { value: "es-US", label: "Spanish (US)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "de-AT", label: "German (Austria)" },
  { value: "it-IT", label: "Italian (Italy)" },
  { value: "pt-PT", label: "Portuguese (Portugal)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "nl-NL", label: "Dutch (Netherlands)" },
  { value: "sv-SE", label: "Swedish" },
  { value: "da-DK", label: "Danish" },
  { value: "nb-NO", label: "Norwegian" },
  { value: "pl-PL", label: "Polish" },
  { value: "cs-CZ", label: "Czech" },
  { value: "sk-SK", label: "Slovak" },
  { value: "hu-HU", label: "Hungarian" },
  { value: "ro-RO", label: "Romanian" },
  { value: "uk-UA", label: "Ukrainian" },
  { value: "ru-RU", label: "Russian" },
  { value: "tr-TR", label: "Turkish" },
  { value: "el-GR", label: "Greek" },
  { value: "ar-SA", label: "Arabic (Saudi Arabia)" },
  { value: "ar-AE", label: "Arabic (UAE)" },
  { value: "ar-EG", label: "Arabic (Egypt)" },
  { value: "he-IL", label: "Hebrew" },
  { value: "hi-IN", label: "Hindi" },
  { value: "bn-IN", label: "Bengali (India)" },
  { value: "ta-IN", label: "Tamil (India)" },
  { value: "te-IN", label: "Telugu (India)" },
  { value: "mr-IN", label: "Marathi" },
  { value: "th-TH", label: "Thai" },
  { value: "vi-VN", label: "Vietnamese" },
  { value: "id-ID", label: "Indonesian" },
  { value: "ms-MY", label: "Malay" },
  { value: "zh-CN", label: "Chinese (Mandarin, Simplified)" },
{ value: "zh-TW", label: "Chinese (Taiwanese Mandarin, Traditional)" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
  { value: "af-ZA", label: "Afrikaans" },
  { value: "sw-KE", label: "Swahili (Kenya)" },
  { value: "zu-ZA", label: "Zulu" },
  { value: "xh-ZA", label: "Xhosa" },
  { value: "fil-PH", label: "Filipino" },
];

const AUTO_DETECT_LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "fr-CA", label: "French (Canada)" },
  { value: "zh-CN", label: "Chinese (Mandarin, Simplified)" },
  { value: "hi-IN", label: "Hindi" },
];

export class AzureSpeechAdapter extends SpeechAdapter {
  constructor(options = {}) {
    super(options);
    this.recognizer = null;
    this.initializing = false;
    this.language = options.language || "auto";
  }

  setLanguage(lang) {
    this.language = lang || "auto";

    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }
  }

  getLanguageOptions() {
    return LANGUAGE_OPTIONS;
  }

  getAutoDetectLanguages() {
    return AUTO_DETECT_LANGUAGES;
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

      if (this.language === "auto") {
        const autoDetectConfig =
          SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(
            AUTO_DETECT_LANGUAGES.map((lang) => lang.value)
          );

        this.recognizer = SpeechSDK.SpeechRecognizer.FromConfig(
          speechConfig,
          autoDetectConfig,
          audioConfig,
        );
      } else {
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

  destroy() {
    this.stop();

    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }
  }
}