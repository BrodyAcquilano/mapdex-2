// server/engines/presence/schema.js

export const defaultPresenceSchema = {
  engineKey: "presence",
  projectName: "Live Presence Map",
  projectDescription: "",
  projectTags: [],
  ownerColorTheme: "green",
  previewText: "sections[0].inputs[0].value",

  geometry: {
    label: "Geometry",
    types: ["Point"],
    isFilter: true,
    isDisplayed: true,
  },

  time: {
    label: "Date & Time",
    type: "Event",
    isFilter: false,
    isDisplayed: true,
    defaultDurationMinutes: 0,
    modes: ["Instant"],
  },

  sections: [
    // ─────────────────────────────────────────────
    // Status (LOCKED SECTION)
    // ─────────────────────────────────────────────
    {
      id: Date.now() + 10,
      name: "Status",
      inputs: [
        {
          id: Date.now() + 11,
          label: "User Status",
          type: "text",
          isRequired: false,
          isFilter: false,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 150,
        },
      ],
    },
  ],
  extensions: {
    Gallery: {
      enabled: false,
      perDataItemToggle: false,
      maxImages: 0,
    },
    Bulletin: {
      enabled: false,
      maxMessages: 0,
      messageLength: 0,
    },
    Chat: {
      enabled: true,
      maxMessages: 20,
      messageLength: 1000,
    },
  },
};
