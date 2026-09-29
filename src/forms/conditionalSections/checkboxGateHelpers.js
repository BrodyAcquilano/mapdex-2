import { daysOfWeek } from "../../../shared/validation/formValueHelpers.js";

export function resetCheckboxGateSecondaryInput(schemaInput) {
  const nextInput = {
    id: schemaInput.id,
  };

  switch (schemaInput.type) {
    case "text":
    case "notes":
    case "website":
    case "phoneNumber":
    case "email":
      nextInput.value = "";
      break;

    case "number":
    case "percentage":
    case "capacity":
      nextInput.mode = "";
      nextInput.singleValue = null;
      nextInput.min = null;
      nextInput.max = null;
      break;

    case "checkbox":
      if (schemaInput.isApplicableOption === true) {
        nextInput.isApplicable = true;
      }
      nextInput.value = false;
      break;

    case "dropdown":
      nextInput.value = "";
      break;

    case "hours":
      nextInput.openHours = Object.fromEntries(
        daysOfWeek.map((day) => [day, []]),
      );
      break;

    case "ageRange":
      nextInput.mode = "";
      nextInput.min = null;
      nextInput.max = null;
      break;

    case "priceRangeArray":
      nextInput.categories = {};
      break;

    case "tagList":
      nextInput.tags = [];
      break;

    default:
      nextInput.value = "";
      break;
  }

  return nextInput;
}

export function initializeCheckboxGateSecondaryInput(schemaInput) {
  const nextInput = {
    id: schemaInput.id,
  };

  switch (schemaInput.type) {
    case "text":
    case "notes":
    case "website":
    case "phoneNumber":
    case "email":
      nextInput.value = "";
      break;

    case "number":
    case "percentage":
    case "capacity": {
      const allowedModes = Array.isArray(schemaInput.modeOptions)
        ? schemaInput.modeOptions
        : [];

      const defaultMode = schemaInput.isRequired
        ? allowedModes[0] || "Single Value"
        : "";

      nextInput.mode = defaultMode;
      nextInput.singleValue =
        defaultMode === "Single Value" ? (schemaInput.minValue ?? 0) : null;
      nextInput.min =
        defaultMode === "Min-Max Range" || defaultMode === "Min Only"
          ? (schemaInput.minValue ?? 0)
          : null;
      nextInput.max =
        defaultMode === "Min-Max Range" || defaultMode === "Max Only"
          ? (schemaInput.maxValue ?? null)
          : null;
      break;
    }

    case "checkbox":
      if (schemaInput.isApplicableOption === true) {
        nextInput.isApplicable = true;
      }
      nextInput.value = false;
      break;

    case "dropdown":
      nextInput.value = schemaInput.isRequired
        ? schemaInput.options?.[0] || ""
        : "";
      break;

    case "hours":
      nextInput.openHours = Object.fromEntries(
        daysOfWeek.map((day) => [day, []]),
      );
      break;

    case "ageRange": {
      const allowedModes = Array.isArray(schemaInput.ageModeOptions)
        ? schemaInput.ageModeOptions
        : [];

      const defaultMode = schemaInput.isRequired
        ? allowedModes[0] || "All Ages"
        : "";

      nextInput.mode = defaultMode;
      nextInput.min =
        defaultMode === "Min-Max Range" || defaultMode === "Min Only"
          ? (schemaInput.minValue ?? 0)
          : null;
      nextInput.max =
        defaultMode === "Min-Max Range" || defaultMode === "Max Only"
          ? (schemaInput.maxValue ?? 150)
          : null;
      break;
    }

    case "priceRangeArray":
      nextInput.categories = {};
      break;

    case "tagList":
      nextInput.tags = [];
      break;

    default:
      nextInput.value = "";
      break;
  }

  return nextInput;
}