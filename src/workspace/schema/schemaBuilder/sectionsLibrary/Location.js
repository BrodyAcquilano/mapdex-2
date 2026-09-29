export const LocationSection = {
  key: "location",
  label: "Location",

  buildSection() {
    return {
        id: Date.now() + 10,
      name: "Location",
      systemKey: "location",
      inputs: [
        {
            id: Date.now() + 11,
          label: "Location Name",
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
          label: "Address",
          type: "text",
          isRequired: false,
          isFilter: false,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 150,
        },
      ],
    };
  },

  schemaRules: {
    lockedSectionFields: [],
    lockedInputs: [
      {
        inputIndex: 0,
        lockedFields: ["type", "isRequired"],
      },
      {
        inputIndex: 1,
        lockedFields: ["label", "type"],
      },
    ],
  },
};