export default [
  {
    command: "close settings",
    aliases: ["close settings", "exit settings", "hide settings"],
    match: /\b(close settings|exit settings|hide settings)\b/i,
    description: "Close settings, Exit settings, Hide settings,",
    section: "Settings",
    handler: ({ setIsSettingsModalOpen }) => {
      if (typeof setIsSettingsModalOpen === "function") {
        setIsSettingsModalOpen(false);
      }
    },
  },
];