// src/forms/injectRequiredDefaults.js

import { daysOfWeek } from "../../shared/validation/formValueHelpers.js";

function formatMotionRecordName() {
  const date = new Date();

  if (!Number.isFinite(date.getTime())) {
    return "Motion Record";
  }

  return `Motion Record ${date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function getTextDefault(schema, schemaInput) {
  if (schema?.engineKey === "motion") {
    return formatMotionRecordName();
  }

  const maxLen = schemaInput.maxLength || 64;
  return maxLen >= 16 ? "Quick Add" : "M";
}

// Used ONLY for quick-add / auto-add flows to satisfy required fields.
// Lat/Lng or route geometry should be injected by the caller before payload build.
export function injectRequiredDefaults(formData, schema) {
  if (!formData || !schema || !Array.isArray(schema.sections)) {
    return formData;
  }

  for (let s = 0; s < schema.sections.length; s += 1) {
    const schemaSection = schema.sections[s];
    const formSection = formData.sections?.[s];

    if (!schemaSection || !formSection) continue;
    if (schemaSection.conditionalSection === "checkboxGate") continue;

    for (let i = 0; i < schemaSection.inputs.length; i += 1) {
      const schemaInput = schemaSection.inputs[i];
      const formInput = formSection.inputs?.[i];

      if (!schemaInput || !formInput) continue;
      if (!schemaInput.isRequired) continue;

      switch (schemaInput.type) {
        case "text": {
          formInput.value = getTextDefault(schema, schemaInput);
          break;
        }

        case "notes": {
          formInput.value = getTextDefault(schema, schemaInput);
          break;
        }

        case "phoneNumber":
          formInput.value = "N/A";
          break;

        case "email":
          formInput.value = "N/A";
          break;

        case "number":
        case "percentage":
        case "capacity": {
          const allowedModes = Array.isArray(schemaInput.modeOptions)
            ? schemaInput.modeOptions
            : [];

          const fallbackMode =
            schemaInput.type === "capacity"
              ? allowedModes.includes("Single Value")
                ? "Single Value"
                : allowedModes.includes("Min-Max Range")
                  ? "Min-Max Range"
                  : ""
              : allowedModes.includes("Single Value")
                ? "Single Value"
                : allowedModes.includes("Min-Max Range")
                  ? "Min-Max Range"
                  : allowedModes.includes("Min Only")
                    ? "Min Only"
                    : allowedModes.includes("Max Only")
                      ? "Max Only"
                      : "";

          formInput.mode = fallbackMode;
          formInput.singleValue = null;
          formInput.min = null;
          formInput.max = null;

          if (fallbackMode === "Single Value") {
            if (typeof schemaInput.minValue === "number") {
              formInput.singleValue = schemaInput.minValue;
            } else if (
              schemaInput.type !== "capacity" &&
              typeof schemaInput.maxValue === "number" &&
              schemaInput.maxValue < 0
            ) {
              formInput.singleValue = schemaInput.maxValue;
            } else {
              formInput.singleValue = 0;
            }
          } else if (fallbackMode === "Min-Max Range") {
            formInput.min =
              typeof schemaInput.minValue === "number"
                ? schemaInput.minValue
                : 0;

            formInput.max =
              typeof schemaInput.maxValue === "number"
                ? schemaInput.maxValue
                : schemaInput.type === "percentage"
                  ? 100
                  : schemaInput.type === "capacity"
                    ? 999999999
                    : 0;
          } else if (fallbackMode === "Min Only") {
            formInput.min =
              typeof schemaInput.minValue === "number"
                ? schemaInput.minValue
                : 0;
          } else if (fallbackMode === "Max Only") {
            formInput.max =
              typeof schemaInput.maxValue === "number"
                ? schemaInput.maxValue
                : schemaInput.type === "percentage"
                  ? 100
                  : 0;
          }

          break;
        }

        case "website":
          formInput.value = "https://mapdex.ca";
          break;

        case "dropdown":
          formInput.value = schemaInput.options?.[0] || "";
          break;

        case "hours": {
          const firstDay = daysOfWeek[0] || "Monday";

          formInput.openHours = Object.fromEntries(
            daysOfWeek.map((day) => [
              day,
              day === firstDay
                ? [{ open: "9:00 a.m.", close: "5:00 p.m." }]
                : [],
            ]),
          );

          break;
        }

        case "ageRange": {
          const allowedModes = Array.isArray(schemaInput.ageModeOptions)
            ? schemaInput.ageModeOptions
            : [];

          const fallbackMode = allowedModes.includes("All Ages")
            ? "All Ages"
            : allowedModes.includes("Min-Max Range")
              ? "Min-Max Range"
              : allowedModes.includes("Min Only")
                ? "Min Only"
                : allowedModes.includes("Max Only")
                  ? "Max Only"
                  : "";

          formInput.mode = fallbackMode;

          if (fallbackMode === "All Ages") {
            formInput.min = null;
            formInput.max = null;
          } else if (fallbackMode === "Min-Max Range") {
            formInput.min = schemaInput.minValue ?? 0;
            formInput.max = schemaInput.maxValue ?? 150;
          } else if (fallbackMode === "Min Only") {
            formInput.min = schemaInput.minValue ?? 0;
            formInput.max = null;
          } else if (fallbackMode === "Max Only") {
            formInput.min = null;
            formInput.max = schemaInput.maxValue ?? 150;
          }

          break;
        }

        default:
          // Checkboxes, tagLists, and price ranges are not expected
          // to need required quick-add defaults.
          break;
      }
    }
  }

  return formData;
}