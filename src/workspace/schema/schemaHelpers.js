import {
  AGE_RANGE_LIMITS,
  CAPACITY_LIMITS,
  EMAIL_LIMITS,
  NOTES_LIMITS,
  NUMBER_LIMITS,
  PERCENTAGE_LIMITS,
  PHONE_NUMBER_LIMITS,
  PRICE_RANGE_ARRAY_LIMITS,
  TAG_LIST_LIMITS,
  TEXT_LIMITS,
  WEBSITE_LIMITS,
} from "../../../shared/validation/validationConstants.js";

export const generateNewSection = () => ({
  id: Date.now(),
  name: "New Section",
  inputs: [],
});

export const generateNewInput = (type) => {
  const baseInput = {
    id: Date.now(),
    label: `New ${capitalizeFirstLetter(type)} Input`,
    type,
  };

  if (type === "text") {
    baseInput.isRequired = false;
    baseInput.isFilter = true;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
    baseInput.emptyDisplayText = "";
    baseInput.maxLength = TEXT_LIMITS.maxLength.default;
  }

  if (type === "number") {
    baseInput.isRequired = false;
    baseInput.isFilter = true;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
    baseInput.emptyDisplayText = "";
    baseInput.maxLength = NUMBER_LIMITS.maxLength.default;
    baseInput.minValue = null;
    baseInput.maxValue = null;
    baseInput.modeOptions = [...NUMBER_LIMITS.modeOptions];
  }

  if (type === "percentage") {
    baseInput.isRequired = false;
    baseInput.isFilter = true;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
    baseInput.emptyDisplayText = "";
    baseInput.maxLength = PERCENTAGE_LIMITS.maxLength.default;
    baseInput.minValue = PERCENTAGE_LIMITS.minValue;
    baseInput.maxValue = PERCENTAGE_LIMITS.maxValue;
    baseInput.modeOptions = [...PERCENTAGE_LIMITS.modeOptions];
  }

  if (type === "checkbox") {
    baseInput.isFilter = true;
    baseInput.displayWhenTrue = "labelOnly";
    baseInput.displayWhenFalse = "none";
    baseInput.trueDisplayText = "";
    baseInput.falseDisplayText = "";
    baseInput.isApplicableOption = false;
    baseInput.notes = "";
  }

  if (type === "dropdown") {
    baseInput.isRequired = false;
    baseInput.isFilter = true;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
    baseInput.emptyDisplayText = "";
    baseInput.options = ["Option 1"];
  }

  if (type === "website") {
    baseInput.isRequired = false;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
    baseInput.emptyDisplayText = "";
    baseInput.maxLength = WEBSITE_LIMITS.maxLength.default;
  }

  if (type === "phoneNumber") {
    baseInput.isRequired = false;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
    baseInput.emptyDisplayText = "";
    baseInput.maxLength = PHONE_NUMBER_LIMITS.maxLength.default;
  }

  if (type === "email") {
    baseInput.isRequired = false;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
    baseInput.emptyDisplayText = "";
    baseInput.maxLength = EMAIL_LIMITS.maxLength.default;
  }

  if (type === "notes") {
    baseInput.isRequired = false;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
    baseInput.emptyDisplayText = "";
    baseInput.maxLength = NOTES_LIMITS.maxLength.default;
  }

  if (type === "hours") {
    baseInput.isRequired = false;
    baseInput.isFilter = true;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
  }

  if (type === "capacity") {
    baseInput.isRequired = false;
    baseInput.isFilter = true;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
    baseInput.emptyDisplayText = "";
    baseInput.maxLength = CAPACITY_LIMITS.maxLength.default;
    baseInput.minValue = CAPACITY_LIMITS.minValue;
    baseInput.maxValue = CAPACITY_LIMITS.maxValue;
    baseInput.modeOptions = [...CAPACITY_LIMITS.modeOptions];
  }

  if (type === "ageRange") {
    baseInput.isRequired = false;
    baseInput.isFilter = true;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
    baseInput.emptyDisplayText = "";
    baseInput.maxLength = AGE_RANGE_LIMITS.maxLength.default;
    baseInput.minValue = AGE_RANGE_LIMITS.minValue;
    baseInput.maxValue = AGE_RANGE_LIMITS.maxValue;
    baseInput.ageModeOptions = [...AGE_RANGE_LIMITS.modeOptions];
  }

  if (type === "priceRangeArray") {
    baseInput.isRequired = false;
    baseInput.isFilter = true;
    baseInput.isDisplayed = true;
    baseInput.displayIfEmpty = false;
    baseInput.emptyDisplayText = "";
    baseInput.maxLength = PRICE_RANGE_ARRAY_LIMITS.maxLength.default;
    baseInput.minValue = PRICE_RANGE_ARRAY_LIMITS.minValue;
    baseInput.maxValue = PRICE_RANGE_ARRAY_LIMITS.maxValue;
    baseInput.maxTotalPriceItems = PRICE_RANGE_ARRAY_LIMITS.maxTotalPriceItems.default;
    baseInput.maxItemsPerCategory = PRICE_RANGE_ARRAY_LIMITS.maxItemsPerCategory.default;
    baseInput.maxCategories = PRICE_RANGE_ARRAY_LIMITS.maxCategories.default;
    baseInput.maxUnitsPerCategory = PRICE_RANGE_ARRAY_LIMITS.maxUnitsPerCategory.default;
    baseInput.allowCustomCategoriesAndUnits = true;
    baseInput.defaultCategoryOptions = [];
    baseInput.customCategoryOptions = [];
    baseInput.priceModeOptions = [...PRICE_RANGE_ARRAY_LIMITS.modeOptions];
    baseInput.defaultPriceUnitOptionsByCategory = {};
    baseInput.customUnitOptionsByCategory = {};
  }

if (type === "tagList") {
  baseInput.isRequired = false;
  baseInput.isFilter = true;
  baseInput.isDisplayed = true;
  baseInput.displayIfEmpty = false;
  baseInput.emptyDisplayText = "";
  baseInput.maxLength = TAG_LIST_LIMITS.maxLength.default;
  baseInput.maxItems = TAG_LIST_LIMITS.maxItems.default;
  baseInput.allowCustomTags = true;
  baseInput.defaultTags = [];
  baseInput.customTags = [];
}

  return baseInput;
};

export const capitalizeFirstLetter = (string) =>
  string.charAt(0).toUpperCase() + string.slice(1);
