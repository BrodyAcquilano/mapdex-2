export const AgesSection = {
  key: "ages",
  label: "Ages",

  buildSection() {
    return {
      id: Date.now() + 10,
      name: "Ages",
      systemKey: "ages",
      inputs: [
        {
          id: Date.now() + 11,
          label: "Age Range",
          type: "ageRange",
          isRequired: false,
          isFilter: true,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 3,
          minValue: 0,
          maxValue: 150,
          ageModeOptions: [
            "All Ages",
            "Min-Max Range",
            "Min Only",
            "Max Only",
          ],
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
          "ageModeOptions",
        ],
      },
    ],
  },
};