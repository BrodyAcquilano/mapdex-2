// global commands

export default [
  {
    command: "close help",
    aliases: ["close help", "hide help", "close voice help", "close commands"],
    match: /\b(close help|hide help|close voice help|close commands)\b/i,
    description: "Close help, Hide help, Close voice help, Close commands",
    section: "Help",
    handler: ({ setIsVoiceHelpOpen }) => {
      setIsVoiceHelpOpen(false);
    },
  },

  {
    command: "open help",
    aliases: ["open help", "show help", "open voice help", "show commands"],
    match: /\b(open help|show help|open voice help|show commands)\b/i,
    description: "Open help, Show help, Open voice help, Show commands",
    section: "Help",
    handler: ({ setIsVoiceHelpOpen }) => {
      setIsVoiceHelpOpen(true);
    },
  },

  {
    command: "stop listening",
    aliases: [
      "stop listening",
      "stop voice",
      "turn off voice",
      "disable voice",
      "toggle voice",
    ],
    match: /\b(stop listening|stop voice|turn off voice|disable voice|toggle voice)\b/i,
    description: "Stop listening, Stop voice, Turn off voice, Disable voice, Toggle voice",
    section: "Help",
    handler: ({ voice }) => {
      voice.stop();
    },
  },

  {
    command: "type",
    aliases: ["type"],
    match: /\btype\s*(.+)/i,
    description: "Type ...",
    section: "Typing",
    handler: ({ transcript }) => {
      const el = window.__voiceFocusedInput;
      if (!el || !transcript) return;

      const setValue = el.__reactSetter;
      if (!setValue) return;

      let text = transcript
        .replace(/\btype\s*/i, "")
        .trim()
        .replace(/^"|"$/g, "")
        .replace(/[.!?]+$/, "");

      text = text
        .replace(/\s+at\s+/gi, "@")
        .replace(/\s+dot\s+/gi, ".");

      if (!text) return;

      text = text.charAt(0).toLowerCase() + text.slice(1);

      const cursor = el.__cursor ?? el.selectionStart ?? el.value.length;

      setValue((prev) => {
        const next = prev.slice(0, cursor) + text + prev.slice(cursor);
        const newPos = cursor + text.length;

        requestAnimationFrame(() => {
          el.focus();
          el.__cursor = newPos;
          try {
            el.setSelectionRange(newPos, newPos);
          } catch {}
        });

        return next;
      });
    },
  },

  {
    command: "space",
    aliases: ["space"],
    match: /\bspace\b/i,
    description: "Space",
    section: "Typing",
    handler: () => {
      const el = window.__voiceFocusedInput;
      if (!el) return;

      const setValue = el.__reactSetter;
      if (!setValue) return;

      const cursor = el.__cursor ?? el.selectionStart ?? el.value.length;

      setValue((prev) => {
        const next = prev.slice(0, cursor) + " " + prev.slice(cursor);
        const newPos = cursor + 1;

        requestAnimationFrame(() => {
          el.focus();
          el.__cursor = newPos;
          try {
            el.setSelectionRange(newPos, newPos);
          } catch {}
        });

        return next;
      });
    },
  },

  {
    command: "backspace",
    aliases: ["backspace"],
    match: /\bbackspace\b/i,
    description: "Backspace",
    section: "Typing",
    handler: () => {
      const el = window.__voiceFocusedInput;
      if (!el) return;

      const setValue = el.__reactSetter;
      if (!setValue) return;

      const cursor = el.__cursor ?? el.selectionStart ?? el.value.length;
      if (cursor === 0) return;

      setValue((prev) => {
        const next = prev.slice(0, cursor - 1) + prev.slice(cursor);
        const newPos = cursor - 1;

        requestAnimationFrame(() => {
          el.focus();
          el.__cursor = newPos;
          try {
            el.setSelectionRange(newPos, newPos);
          } catch {}
        });

        return next;
      });
    },
  },

  {
    command: "delete",
    aliases: ["delete", "clear"],
    match: /\b(delete|clear)\b/i,
    description: "Delete, Clear",
    section: "Typing",
    handler: () => {
      const el = window.__voiceFocusedInput;
      if (!el) return;

      const setValue = el.__reactSetter;
      if (!setValue) return;

      setValue("");

      requestAnimationFrame(() => {
        el.focus();
        el.__cursor = 0;
        try {
          el.setSelectionRange(0, 0);
        } catch {}
      });
    },
  },

  {
    command: "capitalize",
    aliases: ["capitalize"],
    match: /\bcapitalize\b/i,
    description: "Capitalize",
    section: "Typing",
    handler: () => {
      const el = window.__voiceFocusedInput;
      if (!el) return;

      const setValue = el.__reactSetter;
      if (!setValue) return;

      const cursor = el.__cursor ?? el.selectionStart ?? el.value.length;
      if (cursor === 0) return;

      setValue((prev) => {
        const char = prev[cursor - 1]?.toUpperCase();
        if (!char) return prev;

        const next = prev.slice(0, cursor - 1) + char + prev.slice(cursor);

        requestAnimationFrame(() => {
          el.focus();
          el.__cursor = cursor;
          try {
            el.setSelectionRange(cursor, cursor);
          } catch {}
        });

        return next;
      });
    },
  },

  {
    command: "move left",
    aliases: ["move left"],
    match: /\bmove left\b/i,
    description: "Move left",
    section: "Typing",
    handler: () => {
      const el = window.__voiceFocusedInput;
      if (!el) return;

      const pos = el.__cursor ?? el.selectionStart ?? el.value.length;
      const newPos = Math.max(0, pos - 1);

      requestAnimationFrame(() => {
        el.focus();
        el.__cursor = newPos;
        try {
          el.setSelectionRange(newPos, newPos);
        } catch {}
      });
    },
  },

  {
    command: "move right",
    aliases: ["move right"],
    match: /\bmove right\b/i,
    description: "Move right",
    section: "Typing",
    handler: () => {
      const el = window.__voiceFocusedInput;
      if (!el) return;

      const pos = el.__cursor ?? el.selectionStart ?? 0;
      const newPos = Math.min(el.value.length, pos + 1);

      requestAnimationFrame(() => {
        el.focus();
        el.__cursor = newPos;
        try {
          el.setSelectionRange(newPos, newPos);
        } catch {}
      });
    },
  },

  {
    command: "enter",
    aliases: ["enter"],
    match: /\benter\b/i,
    description: "Enter / Exit input",
    section: "Typing",
    handler: () => {
      const el = window.__voiceFocusedInput;
      if (!el) return;
      el.blur();
    },
  },
];