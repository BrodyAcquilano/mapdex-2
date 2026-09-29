export const FinancialAccessSection = {
  key: "financialAccess",
  label: "Financial Access",

  buildSection() {
    return {
      id: Date.now() + 10,
      name: "Financial Access",
      systemKey: "financialAccess",
      inputs: [
        {
          id: Date.now() + 11,
          label: "Prices",
          type: "priceRangeArray",
          isRequired: false,
          isFilter: true,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 30,
          minValue: "0.00",
          maxValue: "100000.00",
          maxTotalPriceItems: 1000,
          maxItemsPerCategory: 50,
          maxCategories: 20,
          maxUnitsPerCategory: 10,
          allowCustomCategoriesAndUnits: true,
          defaultCategoryOptions: [
            "Entry Fee",
            "Rental Fee",
            "Ticket",
            "Donation",
            "Item",
            "Service",
            "Food",
            "Merch",
            "Exercise Class",
            "Photography",
            "Membership",
          ],
          customCategoryOptions: [],
          priceModeOptions: [
            "Free",
            "Fixed Price",
            "Min-Max Range",
            "Min Only",
            "Max Only",
          ],
          defaultPriceUnitOptionsByCategory: {
            "Entry Fee": ["One-time", "Per Person", "Per Group"],
            "Rental Fee": ["One-time", "Per Person", "Per Group", "Per Hour"],
            Ticket: ["Per Person", "Per Group"],
            Donation: ["One-time", "Per Person"],
            Item: ["Per Item"],
            Service: ["Per Hour", "Per Session", "One-time"],
            Food: ["Per Item"],
            Merch: ["Per Item"],
            "Exercise Class": ["Per Class"],
            Photography: ["Per Session", "Per Hour"],
            Membership: ["Per Month", "Per Year"],
          },
          customUnitOptionsByCategory: {},
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
          "maxTotalPriceItems",
          "maxItemsPerCategory",
          "maxCategories",
          "maxUnitsPerCategory",
        ],
      },
    ],
  },
};