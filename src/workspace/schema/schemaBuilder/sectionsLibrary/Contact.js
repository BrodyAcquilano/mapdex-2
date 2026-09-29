export const ContactSection = {
  key: "contact",
  label: "Contact Details",

  buildSection() {
    return {
        id: Date.now() + 10,
      name: "Contact Details",
      systemKey: "contact",
      inputs: [
        {
            id: Date.now() + 11,
          label: "Website",
          type: "website",
          isRequired: false,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 150,
        },
        {
            id: Date.now() + 12,
          label: "Phone",
          type: "phoneNumber",
          isRequired: false,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 25,
        },
          {
          id: Date.now() + 13,
          label: "Extension",
          type: "text",
          isRequired: false,
          isFilter: false,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 20,
        },
        {
            id: Date.now() + 14,
          label: "Email",
          type: "email",
          isRequired: false,
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
      { inputIndex: 0, lockedFields: [] },
      { inputIndex: 1, lockedFields: [] },
      { inputIndex: 2, lockedFields: [] },
      { inputIndex: 3, lockedFields: [] },
    ],
  },
};