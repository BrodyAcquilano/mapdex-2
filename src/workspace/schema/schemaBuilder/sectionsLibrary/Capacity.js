export const CapacitySection = {
  key: "capacity",
  label: "Capacity",

  buildSection() {
    return {
      id: Date.now() + 10,
      name: "Capacity",
      systemKey: "capacity",
      inputs: [
        {
          id: Date.now() + 11,
          label: "Capacity",
          type: "capacity",
          isRequired: false,
          isFilter: true,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 9,
          minValue: 0,
          maxValue: 999999999,
          modeOptions: ["Single Value", "Min-Max Range"],
        },
      ],
    };
  },

  schemaRules: {
    lockedSectionFields: [],
    lockedInputs: [
      {
        inputIndex: 0,
        lockedFields: [
          "label",
          "type",
          "maxLength",
          "minValue",
          "maxValue",
          "modeOptions",
        ],
      },
    ],
  },
};