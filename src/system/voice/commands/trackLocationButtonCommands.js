// system/voice/commands/trackLocationButtonCommands.js

export default [
  {
    command: "toggle track location",
    aliases: [
      "toggle track location",
      "track location mode",
      "toggle track location mode",
      "show my position",
      "show me",
    ],
    match: /\b(toggle track location|track location mode|toggle track location mode|show my position|show me)\b/i,
    description: "Toggle track location mode, Track location mode, Toggle track location, Show my position, Show me",
    section: "Workspace",
    handler: ({ handleTrackLocationToggle }) => {
      handleTrackLocationToggle?.();
    },
  },
];