export default [
  {
    command: "open settings",
    aliases: [
      "open settings",
      "show settings",
      "open settings modal",
    ],
    match: /\b(open settings|show settings|open settings modal)\b/i,
    description: "Open settings, Show settings, Open settings modal",
    section: "Workspace",
    handler: ({ setIsSettingsModalOpen }) => {
      if (typeof setIsSettingsModalOpen === "function") {
        setIsSettingsModalOpen(true);
      }
    },
  },
];