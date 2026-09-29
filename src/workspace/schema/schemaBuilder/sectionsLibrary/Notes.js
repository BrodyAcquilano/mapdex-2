export const NotesSection = {
  key: "notes",
  label: "Notes",

  buildSection() {
    return {
      id: Date.now() + 10,
      name: "Notes",
      systemKey: "notes",
      inputs: [
        {
          id: Date.now() + 11,
          label: "Additional Notes",
          type: "notes",
          isRequired: false,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 1000,
        },
      ],
    };
  },

  schemaRules: {
    lockedSectionFields: [],
    lockedInputs: [
      { inputIndex: 0, lockedFields: [] },
    ],
  },
};