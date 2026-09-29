// system/SystemProvider.jsx

import {
  createContext,
  useContext,
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from "react";

import { createVoicePipeline } from "./voice/VoicePipeline";

import { createKeyboardSystem } from "./keyboard/keyboard";
import { getVoiceCommands } from "./voice/commands/index";
import { getKeyboardCommands } from "./keyboard/commands/index";

import { trapFocus } from "./focus/focusUtils";

const SystemContext = createContext();

export function SystemProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [announcementQueue, setAnnouncementQueue] = useState([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [loadingState, setLoadingState] = useState(null);
  const [isVoiceHelpOpen, setIsVoiceHelpOpen] = useState(false);
  const [voicePlan, setVoicePlan] = useState("free");
  const [voiceLanguage, setVoiceLanguage] = useState("en-US");
  const [languageOptions, setLanguageOptions] = useState([]);
  const [autoDetectLanguages, setAutoDetectLanguages] = useState([]);

  const [voiceUiStyle, setVoiceUiStyle] = useState({
  voicePositionOverride: null,
  helpPositionOverride: null,
  hasBottomUI: false,
});

  const warningTimeoutRef = useRef(null);
  const failTimeoutRef = useRef(null);
  const announcementTimerRef = useRef(null);

  // ─────────────────────────────
  // Notify
  // ─────────────────────────────
  const notify = useCallback((message, duration = 10000) => {
    const lines = String(message)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const toastItems = lines.length ? lines : [String(message)];

    const ids = toastItems.map(
      (_, index) => `${Date.now()}-${index}-${Math.random()}`
    );

    setToasts((prev) => [
      ...prev,
      ...toastItems.map((msg, index) => ({
        id: ids[index],
        message: msg,
      })),
    ]);

    // Queue each line for screen-reader announcement
    setAnnouncementQueue((prev) => [...prev, ...toastItems]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => !ids.includes(t.id)));
    }, duration);
  }, []);

  // ─────────────────────────────
  // Screen reader announcement queue
  // ─────────────────────────────
  useEffect(() => {
    if (activeAnnouncement) return;
    if (!announcementQueue.length) return;

    const [next, ...rest] = announcementQueue;
    setActiveAnnouncement(next);
    setAnnouncementQueue(rest);
  }, [announcementQueue, activeAnnouncement]);

  useEffect(() => {
    if (!activeAnnouncement) return;

    if (announcementTimerRef.current) {
      clearTimeout(announcementTimerRef.current);
    }

    // Keep each announcement active long enough to be read
    announcementTimerRef.current = setTimeout(() => {
      setActiveAnnouncement("");
    }, 2000);

    return () => {
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }
    };
  }, [activeAnnouncement]);

  // ─────────────────────────────
  // Confirm
  // ─────────────────────────────
  const confirm = useCallback(
    ({ message, confirmText = "Confirm", cancelText = "Cancel" }) => {
      return new Promise((resolve) => {
        setConfirmState({
          message,
          confirmText,
          cancelText,
          resolve,
        });
      });
    },
    []
  );

  const handleConfirm = useCallback((result) => {
    setConfirmState((prev) => {
      if (prev?.resolve) prev.resolve(result);
      return null;
    });
  }, []);

  // ─────────────────────────────
  // Loading Screen Reader Announcement Helper
  // ─────────────────────────────
  const announce = useCallback((message) => {
  const lines = String(message)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const items = lines.length ? lines : [String(message)];
  setAnnouncementQueue((prev) => [...prev, ...items]);
}, []);
  // ─────────────────────────────
  // Loading
  // ─────────────────────────────
const startLoading = useCallback(
  (text = "Loading...") => {
    setLoadingState({ text });
    announce(text);

    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (failTimeoutRef.current) clearTimeout(failTimeoutRef.current);

    warningTimeoutRef.current = setTimeout(() => {
      setLoadingState((prev) => {
        if (!prev) return null;
        const next = { text: "Waking server... this may take a moment." };
        announce(next.text);
        return next;
      });
    }, 30000);

    failTimeoutRef.current = setTimeout(() => {
      setLoadingState(null);
      notify("Failed to connect. Please refresh and try again.");
    }, 120000);
  },
  [announce, notify]
);

  const stopLoading = useCallback(() => {
    setLoadingState(null);

    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (failTimeoutRef.current) clearTimeout(failTimeoutRef.current);
  }, []);

  // ─────────────────────────────
  // Voice Initialization
  // ─────────────────────────────
  const voiceRef = useRef();

  if (!voiceRef.current) {
    voiceRef.current = createVoicePipeline({
      system: { notify },
      plan: voicePlan,
      language: voiceLanguage,
    });
  }

  const voice = voiceRef.current;

  useEffect(() => {
    setLanguageOptions(voice.getLanguageOptions?.() || []);
    setAutoDetectLanguages(voice.getAutoDetectLanguages?.() || []);
  }, [voice]);

  useEffect(() => {
    voice.setPlan?.(voicePlan);

    if (voicePlan === "paid") {
      setVoiceLanguage("auto");
    } else {
      setVoiceLanguage("en-US");
    }

    setLanguageOptions(voice.getLanguageOptions?.() || []);
    setAutoDetectLanguages(voice.getAutoDetectLanguages?.() || []);
  }, [voicePlan, voice]);

  useEffect(() => {
    const wasListening = voice.isListening();

    if (wasListening) voice.stop();

    voice.setLanguage?.(voiceLanguage);
  }, [voiceLanguage, voice]);

  // ─────────────────────────────
  // Keyboard Initialization
  // ─────────────────────────────
  const keyboardRef = useRef();

  if (!keyboardRef.current) {
    keyboardRef.current = createKeyboardSystem();
  }

  const keyboard = keyboardRef.current;

  useEffect(() => {
    keyboard.init();
    return () => keyboard.destroy();
  }, [keyboard]);

  // ─────────────────────────────
  // Store focused element for voice typing
  // ─────────────────────────────
  useEffect(() => {
    const handleFocus = (e) => {
      const el = e.target;

      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el.isContentEditable
      ) {
        window.__voiceFocusedInput = el;
      }
    };

    document.addEventListener("focusin", handleFocus);

    return () => {
      document.removeEventListener("focusin", handleFocus);
    };
  }, []);

  // ─────────────────────────────
  // Cleanup timers
  // ─────────────────────────────
  useEffect(() => {
    return () => {
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }
    };
  }, []);

  // ─────────────────────────────
  // Voice Commands Helper
  // ─────────────────────────────
  const registerVoiceCommands = useCallback(
    (key, context = {}) => {
      const commands = getVoiceCommands(key);

      const commandContext = {
        ...context,
        voice,
        setIsVoiceHelpOpen,
      };

      const registered = commands.map((cmd) => ({
        ...cmd,
        handler: (_match, transcript) =>
          cmd.handler({ ...commandContext, transcript }),
      }));

      registered.forEach((cmd) => voice.registerCommand(cmd));

      return () => {
        registered.forEach((cmd) => voice.unregisterCommand(cmd.match));
      };
    },
    [voice, setIsVoiceHelpOpen]
  );

  // ─────────────────────────────
  // Keyboard Commands Helper
  // ─────────────────────────────
  const registerKeyboardCommands = useCallback(
    (key, context = {}) => {
      const commands = getKeyboardCommands(key);

      commands.forEach((cmd) => {
        keyboard.registerShortcut(cmd.key, () => cmd.handler(context));
      });

      return () => {
        commands.forEach((cmd) => {
          keyboard.unregisterShortcut(cmd.key);
        });
      };
    },
    [keyboard]
  );

   // ─────────────────────────────
  // Move Voice Buttons based on conditional UI settings
  // ─────────────────────────────
const setVoiceLayout = useCallback((updates) => {
  setVoiceUiStyle((prev) => ({
    ...prev,
    ...updates,
  }));
}, []);

const resetVoiceLayout = useCallback(() => {
  setVoiceUiStyle({
    voicePositionOverride: null,
    helpPositionOverride: null,
    hasBottomUI: false,
  });
}, []);

  const value = useMemo(
    () => ({
      notify,
      confirm,
      startLoading,
      stopLoading,
      voice,
      voicePlan,
      setVoicePlan,
      voiceLanguage,
      setVoiceLanguage,
      languageOptions,
      autoDetectLanguages,
      keyboard,
      registerVoiceCommands,
      registerKeyboardCommands,
      trapFocus,
      isVoiceHelpOpen,
      setIsVoiceHelpOpen,
      toasts,
      announce,
      activeAnnouncement,
      confirmState,
      loadingState,
      handleConfirm,
      voiceUiStyle,
      setVoiceLayout,
      resetVoiceLayout,
    }),
    [
      notify,
      confirm,
      startLoading,
      stopLoading,
      voice,
      voicePlan,
      voiceLanguage,
      languageOptions,
      autoDetectLanguages,
      keyboard,
      registerVoiceCommands,
      registerKeyboardCommands,
      isVoiceHelpOpen,
      toasts,
      activeAnnouncement,
      confirmState,
      loadingState,
      voiceUiStyle,
      setVoiceLayout,
resetVoiceLayout,
    ]
  );

  return (
    <SystemContext.Provider value={value}>
      {children}
    </SystemContext.Provider>
  );
}

export function useSystem() {
  return useContext(SystemContext);
}