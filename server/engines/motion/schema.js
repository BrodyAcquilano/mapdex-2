// server/engines/motion/schema.js

export const defaultMotionSchema = {
  engineKey: "motion",
  projectName: "Motion Records",
  projectDescription: "",
  projectTags: [],
  ownerColorTheme: "green",
  previewText: "sections[0].inputs[0].value", // Motion Record Name

  geometry: {
    label: "Geometry",
    types: ["LineString"],
    isFilter: true,
    isDisplayed: false,
  },

  time: {
    label: "Time",
    type: "Motion",
    isFilter: true,
    isDisplayed: false,
  },

  sections: [
    // ─────────────────────────────────────────────
    // Motion Details
    // ─────────────────────────────────────────────
    {
      id: Date.now() + 10,
      name: "Motion Details",
      systemKey: "motionDetails",
      inputs: [
        {
          id: Date.now() + 11,
          label: "Record Name",
          type: "text",
          isRequired: true,
          isFilter: false,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 150,
        },
        {
          id: Date.now() + 12,
          label: "Description",
          type: "notes",
          isRequired: false,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 1000,
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Route Details
    // ─────────────────────────────────────────────
    {
      id: Date.now() + 20,
      name: "Route Details",
      systemKey: "routeDetails",
      inputs: [
        {
          id: Date.now() + 21,
          label: "Travel Mode",
          type: "dropdown",
          isRequired: false,
          isFilter: true,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          options: [
            "Walking",
            "Running",
            "Cycling",
            "Driving",
            "Transit",
            "Other",
          ],
        },
        {
          id: Date.now() + 22,
          label: "Route Purpose",
          type: "dropdown",
          isRequired: false,
          isFilter: true,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          options: [
            "Commute",
            "Errand",
            "Exercise",
            "Delivery",
            "Field Work",
            "Observation",
            "Other",
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Notes
    // ─────────────────────────────────────────────
    {
      id: Date.now() + 40,
      name: "Notes",
      systemKey: "notes",
      inputs: [
        {
          id: Date.now() + 41,
          label: "Notes",
          type: "notes",
          isRequired: false,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 1000,
        },
      ],
    },
  ],

  extensions: {
    Gallery: {
      enabled: true,
      perDataItemToggle: true,
      maxImages: 10,
    },
    Guestbook: {
      enabled: false,
      perDataItemToggle: false,
    },
    Bulletin: {
      enabled: true,
      maxMessages: 20,
      messageLength: 1000,
    },
    Chat: {
      enabled: false,
      maxMessages: 0,
      messageLength: 0,
    },
  },
};
