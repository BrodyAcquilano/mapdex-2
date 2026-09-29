// system/voice/createVoice.js

import { WebSpeechAdapter } from "./speech-adapters/WebSpeechAdapter";
import { AzureSpeechAdapter } from "./speech-adapters/AzureSpeechAdapter";
import { CommandRegistry } from "./CommandRegistry";

export function createVoice({ system, plan = "free"}) {
  const registry = new CommandRegistry();

  let currentPlan = plan;
  let currentLanguage = "auto";
  let adapter = buildAdapter(currentPlan, currentLanguage);

  let isListening = false;
  let lastTranscript = "";
  let subscribers = [];
  let transcriptHandler = null;

  function buildAdapter(nextPlan, nextLanguage) {
    return nextPlan === "paid"
      ? new AzureSpeechAdapter({ language: nextLanguage })
      : new WebSpeechAdapter({ language: nextLanguage });
  }

  function bindAdapterEvents(targetAdapter) {
    targetAdapter.onTranscript((payload) => {
      lastTranscript = payload;
      if (transcriptHandler) {
        transcriptHandler(payload);
      }
    });

    targetAdapter.onError((err) => {
      system.notify(`Voice error: ${err}`);
    });

    targetAdapter.onListeningChange((value) => {
      isListening = value;
      subscribers.forEach((cb) => cb(value));
    });
  }

  bindAdapterEvents(adapter);

  return {
    async initialize() {
      await adapter.initialize();
    },

    start() {
      adapter.start();
    },

    stop() {
      adapter.stop();
    },

    toggle() {
      isListening ? adapter.stop() : adapter.start();
    },

    isListening() {
      return isListening;
    },

    subscribe(callback) {
      subscribers.push(callback);
      return () => {
        subscribers = subscribers.filter((cb) => cb !== callback);
      };
    },

    registerCommand(command) {
      registry.register(command);
    },

    unregisterCommand(match) {
      registry.unregister(match);
    },

    getLastTranscript() {
      return lastTranscript;
    },

    getCommands() {
      return registry.getCommands();
    },

    setTranscriptHandler(handler) {
      transcriptHandler = handler;
    },

    executeCommand(text) {
      return registry.execute(text);
    },

    setAdapterLanguage(lang) {
      currentLanguage = lang;

      if (adapter.setLanguage) {
        adapter.setLanguage(lang);
      }
    },

    getLanguageOptions() {
  return adapter.getLanguageOptions?.() || [];
},

getAutoDetectLanguages() {
  return adapter.getAutoDetectLanguages?.() || [];
},

    setPlan(nextPlan) {
      if (!nextPlan || nextPlan === currentPlan) return;

      adapter.stop?.();
      adapter.destroy?.();

      currentPlan = nextPlan;
      adapter = buildAdapter(currentPlan, currentLanguage);
      bindAdapterEvents(adapter);
    },
  };
}