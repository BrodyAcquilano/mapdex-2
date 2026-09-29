export const TimeAccessSection = {
  key: "timeAccess",
  label: "Time Access",

  buildSection() {
    return {
      id: Date.now() + 10,
      name: "Time Access",
      systemKey: "timeAccess",
      conditionalSection: "checkboxGate",

      checkboxGateConfig: {
        primaryInputKeys: ["hoursKnown"],
        secondaryInputMap: {
          hoursKnown: ["hours"],
        },
      },

      inputs: [
        {
          id: Date.now() + 11,
          label: "Hours?",
          type: "checkbox",
          isFilter: true,
          displayWhenTrue: "none",
          displayWhenFalse: "messageOnly",
          trueDisplayText: "",
          falseDisplayText: "Hours Unknown or Not Applicable",
          notes: "",
          isApplicableOption: false,
          inputKey: "hoursKnown",
          secondaryFor: null,
        },
        {
          id: Date.now() + 12,
          label: "Hours",
          type: "hours",
          isRequired: false,
          isFilter: true,
          isDisplayed: true,
          displayIfEmpty: true,
          inputKey: "hours",
          secondaryFor: "hoursKnown",
        },
      ],
    };
  },

  schemaRules: {
    lockedSectionFields: [
      "systemKey",
      "conditionalSection",
      "checkboxGateConfig",
    ],
    lockedInputs: [
      {
        inputIndex: 0,
        lockedFields: [
          "label",
          "type",
          "displayWhenTrue",
          "displayWhenFalse",
          "trueDisplayText",
          "falseDisplayText",
          "isApplicableOption",
          "inputKey",
          "secondaryFor",
        ],
      },
      {
        inputIndex: 1,
        lockedFields: [
          "label",
          "type",
          "displayIfEmpty",
          "inputKey",
          "secondaryFor",
        ],
      },
    ],
  },
};