import {
  daysOfWeek,
  timeAMPMToMinutes,
  getDefaultDurationMinutes,
} from "../../shared/validation/formValueHelpers.js";

import { storage } from "../media/mediaService.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeLabel(value) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) =>
      word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "",
    )
    .join(" ");
}

function truncateString(value, maxLength) {
  const str = typeof value === "string" ? value : "";
  const limit = Number(maxLength);

  if (!Number.isFinite(limit) || limit < 0) return str;

  return str.length > limit ? str.slice(0, limit) : str;
}

function uniqueNormalizedStrings(values, { maxLength = null } = {}) {
  const result = [];
  const seen = new Set();

  for (const value of safeArray(values)) {
    let normalized = normalizeLabel(value);
    if (!normalized) continue;

    normalized = truncateString(normalized, maxLength).trim();
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function getProjectDataType(engineKey) {
  if (engineKey === "places") return "place";
  if (engineKey === "events") return "event";
  if (engineKey === "neighbourhoods") return "neighbourhood";
  if (engineKey === "presence") return "presence";
  if (engineKey === "motion") return "motion";

  return "";
}

function buildSectionMap(sections) {
  const map = new Map();

  for (const section of safeArray(sections)) {
    if (section?.id == null) continue;
    map.set(String(section.id), section);
  }

  return map;
}

function buildInputMap(sectionOrInputs) {
  const inputs = Array.isArray(sectionOrInputs)
    ? sectionOrInputs
    : safeArray(sectionOrInputs?.inputs);

  const map = new Map();

  for (const input of inputs) {
    if (input?.id == null) continue;
    map.set(String(input.id), input);
  }

  return map;
}

function exceedsMaxLength(value, maxLength) {
  const limit = Number(maxLength);
  if (!Number.isFinite(limit)) return false;

  return String(value).length > limit;
}

function clampNumber(value, minValue, maxValue) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;

  const min = Number(minValue);
  const max = Number(maxValue);

  if (Number.isFinite(min) && num < min) return min;
  if (Number.isFinite(max) && num > max) return max;

  return num;
}

function normalizeNumberForSchema(value, schemaInput) {
  const clamped = clampNumber(
    value,
    schemaInput?.minValue,
    schemaInput?.maxValue,
  );

  if (clamped == null) return null;

  if (!exceedsMaxLength(clamped, schemaInput?.maxLength)) {
    return clamped;
  }

  const minFallback = clampNumber(
    schemaInput?.minValue,
    schemaInput?.minValue,
    schemaInput?.maxValue,
  );

  if (
    minFallback != null &&
    !exceedsMaxLength(minFallback, schemaInput?.maxLength)
  ) {
    return minFallback;
  }

  const maxFallback = clampNumber(
    schemaInput?.maxValue,
    schemaInput?.minValue,
    schemaInput?.maxValue,
  );

  if (
    maxFallback != null &&
    !exceedsMaxLength(maxFallback, schemaInput?.maxLength)
  ) {
    return maxFallback;
  }

  const zeroFallback = clampNumber(
    0,
    schemaInput?.minValue,
    schemaInput?.maxValue,
  );

  if (
    zeroFallback != null &&
    !exceedsMaxLength(zeroFallback, schemaInput?.maxLength)
  ) {
    return zeroFallback;
  }

  return null;
}

function clampMoneyString(value, minValue, maxValue) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;

  const min = Number(minValue);
  const max = Number(maxValue);

  let next = num;

  if (Number.isFinite(min) && next < min) next = min;
  if (Number.isFinite(max) && next > max) next = max;

  return next.toFixed(2);
}

function getNumberLikeFallbackMode(schemaInput) {
  const allowedModes = safeArray(schemaInput?.modeOptions);

  if (schemaInput.type === "capacity") {
    if (allowedModes.includes("Single Value")) return "Single Value";
    if (allowedModes.includes("Min-Max Range")) return "Min-Max Range";
    return allowedModes[0] || "";
  }

  if (allowedModes.includes("Single Value")) return "Single Value";
  if (allowedModes.includes("Min-Max Range")) return "Min-Max Range";
  if (allowedModes.includes("Min Only")) return "Min Only";
  if (allowedModes.includes("Max Only")) return "Max Only";

  return allowedModes[0] || "";
}

function buildRequiredTextLikeFallback(schemaInput) {
  const maxLength = Number(schemaInput?.maxLength);

  if (schemaInput.type === "website") {
    return {
      id: schemaInput.id,
      value: "https://mapdex.ca",
    };
  }

  if (schemaInput.type === "phoneNumber") {
    return {
      id: schemaInput.id,
      value: "N/A",
    };
  }

  if (schemaInput.type === "email") {
    return {
      id: schemaInput.id,
      value: "N/A",
    };
  }

  const value =
    Number.isFinite(maxLength) && maxLength < 16 ? "M" : "Quick Add";

  return {
    id: schemaInput.id,
    value,
  };
}

function buildEmptyTextLikeFallback(schemaInput) {
  return {
    id: schemaInput.id,
    value: "",
  };
}

function buildRequiredDropdownFallback(schemaInput) {
  return {
    id: schemaInput.id,
    value: safeArray(schemaInput?.options)[0] || "",
  };
}

function buildEmptyDropdownFallback(schemaInput) {
  return {
    id: schemaInput.id,
    value: "",
  };
}

function buildRequiredNumberLikeFallback(schemaInput, mode) {
  const fallbackMode = mode || getNumberLikeFallbackMode(schemaInput);

  const next = {
    id: schemaInput.id,
    mode: fallbackMode,
    singleValue: null,
    min: null,
    max: null,
  };

  if (fallbackMode === "Single Value") {
    const fallbackValue =
      typeof schemaInput.minValue === "number"
        ? schemaInput.minValue
        : schemaInput.type !== "capacity" &&
            typeof schemaInput.maxValue === "number" &&
            schemaInput.maxValue < 0
          ? schemaInput.maxValue
          : 0;

    const value = normalizeNumberForSchema(fallbackValue, schemaInput);

    if (value == null) return null;

    next.singleValue = value;
  }

  if (fallbackMode === "Min-Max Range") {
    const min = normalizeNumberForSchema(
      typeof schemaInput.minValue === "number" ? schemaInput.minValue : 0,
      schemaInput,
    );

    let max = normalizeNumberForSchema(
      typeof schemaInput.maxValue === "number"
        ? schemaInput.maxValue
        : schemaInput.type === "percentage"
          ? 100
          : schemaInput.type === "capacity"
            ? 999999999
            : 0,
      schemaInput,
    );

    if (min == null || max == null) return null;

    if (max < min) {
      max = min;
    }

    if (exceedsMaxLength(max, schemaInput?.maxLength)) {
      return null;
    }

    next.min = min;
    next.max = max;
  }

  if (fallbackMode === "Min Only") {
    const min = normalizeNumberForSchema(
      typeof schemaInput.minValue === "number" ? schemaInput.minValue : 0,
      schemaInput,
    );

    if (min == null) return null;

    next.min = min;
  }

  if (fallbackMode === "Max Only") {
    const max = normalizeNumberForSchema(
      typeof schemaInput.maxValue === "number"
        ? schemaInput.maxValue
        : schemaInput.type === "percentage"
          ? 100
          : 0,
      schemaInput,
    );

    if (max == null) return null;

    next.max = max;
  }

  return next;
}

function buildEmptyNumberLikeFallback(schemaInput) {
  return {
    id: schemaInput.id,
    mode: "",
    singleValue: null,
    min: null,
    max: null,
  };
}

function buildRequiredAgeRangeFallback(schemaInput, mode) {
  const allowedModes = safeArray(schemaInput?.ageModeOptions);

  const fallbackMode =
    mode ||
    (allowedModes.includes("All Ages")
      ? "All Ages"
      : allowedModes.includes("Min-Max Range")
        ? "Min-Max Range"
        : allowedModes.includes("Min Only")
          ? "Min Only"
          : allowedModes.includes("Max Only")
            ? "Max Only"
            : allowedModes[0] || "");

  const next = {
    id: schemaInput.id,
    mode: fallbackMode,
    min: null,
    max: null,
  };

  if (fallbackMode === "All Ages") {
    return next;
  }

  if (fallbackMode === "Min-Max Range") {
    const min = normalizeNumberForSchema(
      schemaInput.minValue ?? 0,
      schemaInput,
    );
    let max = normalizeNumberForSchema(
      schemaInput.maxValue ?? 150,
      schemaInput,
    );

    if (min == null || max == null) return null;

    if (max < min) {
      max = min;
    }

    if (exceedsMaxLength(max, schemaInput?.maxLength)) {
      return null;
    }

    next.min = min;
    next.max = max;
  }

  if (fallbackMode === "Min Only") {
    const min = normalizeNumberForSchema(
      schemaInput.minValue ?? 0,
      schemaInput,
    );

    if (min == null) return null;

    next.min = min;
  }

  if (fallbackMode === "Max Only") {
    const max = normalizeNumberForSchema(
      schemaInput.maxValue ?? 150,
      schemaInput,
    );

    if (max == null) return null;

    next.max = max;
  }

  return next;
}

function buildEmptyAgeRangeFallback(schemaInput) {
  return {
    id: schemaInput.id,
    mode: "",
    min: null,
    max: null,
  };
}

function buildRequiredHoursFallback(schemaInput) {
  const firstDay = daysOfWeek[0] || "Monday";

  return {
    id: schemaInput.id,
    openHours: Object.fromEntries(
      daysOfWeek.map((day) => [
        day,
        day === firstDay ? [{ open: "9:00 a.m.", close: "5:00 p.m." }] : [],
      ]),
    ),
  };
}

function buildEmptyHoursFallback(schemaInput) {
  return {
    id: schemaInput.id,
    openHours: {},
  };
}

function buildCheckboxFallback(schemaInput) {
  const next = {
    id: schemaInput.id,
    value: false,
  };

  if (schemaInput.isApplicableOption === true) {
    next.isApplicable = true;
  }

  return next;
}

function buildEmptyTagListFallback(schemaInput) {
  return {
    id: schemaInput.id,
    tags: [],
  };
}

function buildEmptyPriceRangeFallback(schemaInput) {
  return {
    id: schemaInput.id,
    categories: {},
  };
}

function shouldStoreEmptyInput(schemaInput) {
  if (!schemaInput || schemaInput.isRequired === true) return false;

  if (schemaInput.type === "checkbox") {
    return schemaInput.displayWhenFalse !== "none";
  }

  return schemaInput.displayIfEmpty === true;
}

function buildFallbackForMissingInput(schemaInput) {
  if (!schemaInput) return null;

  if (schemaInput.isRequired === true) {
    switch (schemaInput.type) {
      case "text":
      case "notes":
      case "website":
      case "phoneNumber":
      case "email":
        return buildRequiredTextLikeFallback(schemaInput);

      case "dropdown":
        return buildRequiredDropdownFallback(schemaInput);

      case "number":
      case "percentage":
      case "capacity":
        return buildRequiredNumberLikeFallback(schemaInput);

      case "hours":
        return buildRequiredHoursFallback(schemaInput);

      case "ageRange":
        return buildRequiredAgeRangeFallback(schemaInput);

      default:
        return null;
    }
  }

  if (!shouldStoreEmptyInput(schemaInput)) {
    return null;
  }

  switch (schemaInput.type) {
    case "text":
    case "notes":
    case "website":
    case "phoneNumber":
    case "email":
      return buildEmptyTextLikeFallback(schemaInput);

    case "dropdown":
      return buildEmptyDropdownFallback(schemaInput);

    case "number":
    case "percentage":
    case "capacity":
      return buildEmptyNumberLikeFallback(schemaInput);

    case "hours":
      return buildEmptyHoursFallback(schemaInput);

    case "ageRange":
      return buildEmptyAgeRangeFallback(schemaInput);

    case "checkbox":
      return buildCheckboxFallback(schemaInput);

    case "tagList":
      return buildEmptyTagListFallback(schemaInput);

    case "priceRangeArray":
      return buildEmptyPriceRangeFallback(schemaInput);

    default:
      return null;
  }
}

function migrateTextLikeInput(schemaInput, storedInput) {
  if (!storedInput) return buildFallbackForMissingInput(schemaInput);

  const value = storedInput?.value;

  if (typeof value !== "string" || value.trim() === "") {
    return buildFallbackForMissingInput(schemaInput);
  }

  const maxLength = Number(schemaInput?.maxLength);
  const nextValue =
    Number.isFinite(maxLength) && value.length > maxLength
      ? value.slice(0, maxLength)
      : value;

  return {
    id: schemaInput.id,
    value: nextValue,
  };
}

function migrateDropdownInput(schemaInput, storedInput) {
  if (!storedInput) return buildFallbackForMissingInput(schemaInput);

  const value = storedInput?.value;
  const options = safeArray(schemaInput?.options);

  if (typeof value !== "string" || value.trim() === "") {
    return buildFallbackForMissingInput(schemaInput);
  }

  if (options.includes(value)) {
    return {
      id: schemaInput.id,
      value,
    };
  }

  return buildFallbackForMissingInput(schemaInput);
}

function migrateCheckboxInput(schemaInput, storedInput) {
  if (!storedInput) return buildFallbackForMissingInput(schemaInput);

  const value = storedInput?.value === true;

  if (value === false && schemaInput.displayWhenFalse === "none") {
    return null;
  }

  const next = {
    id: schemaInput.id,
    value,
  };

  if (schemaInput.isApplicableOption === true) {
    next.isApplicable =
      typeof storedInput?.isApplicable === "boolean"
        ? storedInput.isApplicable
        : true;
  }

  return next;
}

function migrateNumberLikeInput(schemaInput, storedInput) {
  if (!storedInput) return buildFallbackForMissingInput(schemaInput);

  const allowedModes = safeArray(schemaInput?.modeOptions);
  const mode = typeof storedInput?.mode === "string" ? storedInput.mode : "";

  if (!mode || !allowedModes.includes(mode)) {
    return buildFallbackForMissingInput(schemaInput);
  }

  const next = {
    id: schemaInput.id,
    mode,
    singleValue: null,
    min: null,
    max: null,
  };

  if (mode === "Single Value") {
    const value = normalizeNumberForSchema(
      storedInput?.singleValue,
      schemaInput,
    );

    if (value == null) return buildFallbackForMissingInput(schemaInput);

    next.singleValue = value;
  }

  if (mode === "Min Only") {
    const min = normalizeNumberForSchema(storedInput?.min, schemaInput);

    if (min == null) return buildFallbackForMissingInput(schemaInput);

    next.min = min;
  }

  if (mode === "Max Only") {
    const max = normalizeNumberForSchema(storedInput?.max, schemaInput);

    if (max == null) return buildFallbackForMissingInput(schemaInput);

    next.max = max;
  }

  if (mode === "Min-Max Range") {
    let min = normalizeNumberForSchema(storedInput?.min, schemaInput);
    let max = normalizeNumberForSchema(storedInput?.max, schemaInput);

    if (min == null || max == null) {
      return buildFallbackForMissingInput(schemaInput);
    }

    if (max < min) {
      max = min;

      if (exceedsMaxLength(max, schemaInput?.maxLength)) {
        return buildFallbackForMissingInput(schemaInput);
      }
    }

    next.min = min;
    next.max = max;
  }

  return next;
}

function migrateAgeRangeInput(schemaInput, storedInput) {
  if (!storedInput) return buildFallbackForMissingInput(schemaInput);

  const allowedModes = safeArray(schemaInput?.ageModeOptions);
  const mode = typeof storedInput?.mode === "string" ? storedInput.mode : "";

  if (!mode || !allowedModes.includes(mode)) {
    return buildFallbackForMissingInput(schemaInput);
  }

  const next = {
    id: schemaInput.id,
    mode,
    min: null,
    max: null,
  };

  if (mode === "All Ages") {
    return next;
  }

  if (mode === "Min Only") {
    const min = normalizeNumberForSchema(storedInput?.min, schemaInput);

    if (min == null) return buildFallbackForMissingInput(schemaInput);

    next.min = min;
  }

  if (mode === "Max Only") {
    const max = normalizeNumberForSchema(storedInput?.max, schemaInput);

    if (max == null) return buildFallbackForMissingInput(schemaInput);

    next.max = max;
  }

  if (mode === "Min-Max Range") {
    let min = normalizeNumberForSchema(storedInput?.min, schemaInput);
    let max = normalizeNumberForSchema(storedInput?.max, schemaInput);

    if (min == null || max == null) {
      return buildFallbackForMissingInput(schemaInput);
    }

    if (max < min) {
      max = min;

      if (exceedsMaxLength(max, schemaInput?.maxLength)) {
        return buildFallbackForMissingInput(schemaInput);
      }
    }

    next.min = min;
    next.max = max;
  }

  return next;
}

function migrateTagListInput(schemaInput, storedInput) {
  if (!storedInput) return buildFallbackForMissingInput(schemaInput);

  const tags = uniqueNormalizedStrings(storedInput?.tags, {
    maxLength: schemaInput?.maxLength,
  });

  if (tags.length === 0) {
    return buildFallbackForMissingInput(schemaInput);
  }

  const defaultSet = new Set(
    uniqueNormalizedStrings(schemaInput?.defaultTags, {
      maxLength: schemaInput?.maxLength,
    }).map((tag) => tag.toLowerCase()),
  );

  const customSet = new Set(
    uniqueNormalizedStrings(schemaInput?.customTags, {
      maxLength: schemaInput?.maxLength,
    }).map((tag) => tag.toLowerCase()),
  );

  const filteredTags = tags.filter((tag) => {
    const key = tag.toLowerCase();

    if (schemaInput?.allowCustomTags === false) {
      return defaultSet.has(key);
    }

    return defaultSet.has(key) || customSet.has(key) || true;
  });

  const maxItems = Number(schemaInput?.maxItems);
  const finalTags = filteredTags.slice(
    0,
    Number.isFinite(maxItems) ? maxItems : 1000,
  );

  return finalTags.length > 0
    ? {
        id: schemaInput.id,
        tags: finalTags,
      }
    : buildFallbackForMissingInput(schemaInput);
}

function getAllowedPriceCategories(schemaInput) {
  const defaults = uniqueNormalizedStrings(schemaInput?.defaultCategoryOptions);
  const custom = uniqueNormalizedStrings(schemaInput?.customCategoryOptions);

  return schemaInput?.allowCustomCategoriesAndUnits === false
    ? defaults
    : [...defaults, ...custom];
}

function getAllowedPriceUnitMap(schemaInput) {
  const defaultMap = isPlainObject(
    schemaInput?.defaultPriceUnitOptionsByCategory,
  )
    ? schemaInput.defaultPriceUnitOptionsByCategory
    : {};

  const customMap =
    schemaInput?.allowCustomCategoriesAndUnits === false
      ? {}
      : isPlainObject(schemaInput?.customUnitOptionsByCategory)
        ? schemaInput.customUnitOptionsByCategory
        : {};

  const result = {};

  for (const [category, units] of Object.entries(defaultMap)) {
    const normalizedCategory = normalizeLabel(category);
    if (!normalizedCategory) continue;

    result[normalizedCategory] = uniqueNormalizedStrings(units);
  }

  for (const [category, units] of Object.entries(customMap)) {
    const normalizedCategory = normalizeLabel(category);
    if (!normalizedCategory) continue;

    result[normalizedCategory] = uniqueNormalizedStrings([
      ...safeArray(result[normalizedCategory]),
      ...safeArray(units),
    ]);
  }

  return result;
}

function migratePriceRangeInput(schemaInput, storedInput) {
  if (!storedInput) return buildFallbackForMissingInput(schemaInput);

  const categories = isPlainObject(storedInput?.categories)
    ? storedInput.categories
    : {};

  const allowedCategories = getAllowedPriceCategories(schemaInput);
  const allowedCategorySet = new Set(
    allowedCategories.map((category) => category.toLowerCase()),
  );

  const allowedUnitMap = getAllowedPriceUnitMap(schemaInput);
  const allowedModes = safeArray(schemaInput?.priceModeOptions);

  const nextCategories = {};
  let totalRows = 0;

  for (const [rawCategory, rows] of Object.entries(categories)) {
    const category = normalizeLabel(rawCategory);
    if (!category || !Array.isArray(rows)) continue;

    const categoryAllowed =
      schemaInput?.allowCustomCategoriesAndUnits !== false ||
      allowedCategorySet.has(category.toLowerCase());

    if (!categoryAllowed) continue;

    const allowedUnits = safeArray(allowedUnitMap[category]);
    const allowedUnitSet = new Set(
      allowedUnits.map((unit) => unit.toLowerCase()),
    );

    const nextRows = [];

    for (const row of rows) {
      if (!isPlainObject(row)) continue;

      const label = truncateString(
        normalizeLabel(row.label),
        schemaInput?.maxLength,
      ).trim();

      const unit = normalizeLabel(row.unit);

      const priceMode =
        typeof row.priceMode === "string" &&
        allowedModes.includes(row.priceMode)
          ? row.priceMode
          : allowedModes[0] || "Free";

      if (!label || !unit) continue;

      const unitAllowed =
        schemaInput?.allowCustomCategoriesAndUnits !== false ||
        allowedUnitSet.has(unit.toLowerCase());

      if (!unitAllowed) continue;

      if (nextRows.length >= (schemaInput.maxItemsPerCategory ?? 50)) {
        break;
      }

      const nextRow = {
        label,
        unit,
        priceMode,
        min: null,
        max: null,
        fixedPrice: null,
      };

      if (priceMode === "Fixed Price") {
        nextRow.fixedPrice =
          clampMoneyString(
            row.fixedPrice,
            schemaInput.minValue,
            schemaInput.maxValue,
          ) ?? schemaInput.minValue;
      }

      if (priceMode === "Min Only") {
        nextRow.min =
          clampMoneyString(
            row.min,
            schemaInput.minValue,
            schemaInput.maxValue,
          ) ?? schemaInput.minValue;
      }

      if (priceMode === "Max Only") {
        nextRow.max =
          clampMoneyString(
            row.max,
            schemaInput.minValue,
            schemaInput.maxValue,
          ) ?? schemaInput.maxValue;
      }

      if (priceMode === "Min-Max Range") {
        let min =
          clampMoneyString(
            row.min,
            schemaInput.minValue,
            schemaInput.maxValue,
          ) ?? schemaInput.minValue;

        let max =
          clampMoneyString(
            row.max,
            schemaInput.minValue,
            schemaInput.maxValue,
          ) ?? schemaInput.maxValue;

        if (Number(max) < Number(min)) {
          max = min;
        }

        nextRow.min = min;
        nextRow.max = max;
      }

      nextRows.push(nextRow);
      totalRows += 1;

      if (totalRows >= (schemaInput.maxTotalPriceItems ?? 1000)) {
        break;
      }
    }

    if (nextRows.length > 0) {
      nextCategories[category] = nextRows;
    }

    if (totalRows >= (schemaInput.maxTotalPriceItems ?? 1000)) {
      break;
    }
  }

  return Object.keys(nextCategories).length > 0
    ? {
        id: schemaInput.id,
        categories: nextCategories,
      }
    : buildFallbackForMissingInput(schemaInput);
}

function normalizeHoursRows(rows) {
  const nextRows = [];
  let previousCloseMin = null;

  for (const row of safeArray(rows)) {
    if (!isPlainObject(row)) continue;

    const open = typeof row.open === "string" ? row.open.trim() : "";
    const close = typeof row.close === "string" ? row.close.trim() : "";

    if (!open && !close) continue;
    if (!open || !close) continue;

    const openMin = timeAMPMToMinutes(open);
    const isAllDay = open === "12:00 a.m." && close === "12:00 a.m.";

    const closeMin = isAllDay
      ? 1440
      : close === "12:00 a.m."
        ? 1440
        : timeAMPMToMinutes(close);

    if (openMin == null || closeMin == null) continue;
    if (closeMin <= openMin) continue;

    if (previousCloseMin != null && openMin <= previousCloseMin) {
      continue;
    }

    nextRows.push({ open, close });
    previousCloseMin = closeMin;

    if (nextRows.length >= 5) {
      break;
    }
  }

  return nextRows;
}

function migrateHoursInput(schemaInput, storedInput) {
  if (!storedInput) return buildFallbackForMissingInput(schemaInput);

  const openHours = isPlainObject(storedInput?.openHours)
    ? storedInput.openHours
    : {};

  const nextOpenHours = {};

  for (const day of daysOfWeek) {
    const rows = normalizeHoursRows(openHours[day]);
    if (rows.length > 0) {
      nextOpenHours[day] = rows;
    }
  }

  const hasAnyRows = Object.values(nextOpenHours).some(
    (rows) => Array.isArray(rows) && rows.length > 0,
  );

  if (!hasAnyRows) {
    return buildFallbackForMissingInput(schemaInput);
  }

  return {
    id: schemaInput.id,
    openHours: nextOpenHours,
  };
}

function migrateInput(schemaInput, storedInput) {
  if (!schemaInput) return null;

  switch (schemaInput.type) {
    case "text":
    case "notes":
    case "website":
    case "phoneNumber":
    case "email":
      return migrateTextLikeInput(schemaInput, storedInput);

    case "dropdown":
      return migrateDropdownInput(schemaInput, storedInput);

    case "checkbox":
      return migrateCheckboxInput(schemaInput, storedInput);

    case "number":
    case "percentage":
    case "capacity":
      return migrateNumberLikeInput(schemaInput, storedInput);

    case "ageRange":
      return migrateAgeRangeInput(schemaInput, storedInput);

    case "tagList":
      return migrateTagListInput(schemaInput, storedInput);

    case "priceRangeArray":
      return migratePriceRangeInput(schemaInput, storedInput);

    case "hours":
      return migrateHoursInput(schemaInput, storedInput);

    default:
      return null;
  }
}

function migrateStandardSection(schemaSection, storedSection) {
  const storedInputMap = buildInputMap(storedSection);
  const migratedInputs = [];

  for (const schemaInput of safeArray(schemaSection?.inputs)) {
    const storedInput = storedInputMap.get(String(schemaInput.id));
    const migratedInput = migrateInput(schemaInput, storedInput);

    if (migratedInput) {
      migratedInputs.push(migratedInput);
    }
  }

  if (migratedInputs.length === 0) return null;

  return {
    id: schemaSection.id,
    inputs: migratedInputs,
  };
}

function migrateCheckboxGateSection(schemaSection, storedSection) {
  const storedInputMap = buildInputMap(storedSection);
  const migratedInputByKey = new Map();
  const migratedInputs = [];

  const schemaInputs = safeArray(schemaSection?.inputs);
  const primaryInputKeys = safeArray(
    schemaSection?.checkboxGateConfig?.primaryInputKeys,
  );
  const secondaryInputMap = isPlainObject(
    schemaSection?.checkboxGateConfig?.secondaryInputMap,
  )
    ? schemaSection.checkboxGateConfig.secondaryInputMap
    : {};

  for (const schemaInput of schemaInputs) {
    const isSecondary =
      typeof schemaInput?.secondaryFor === "string" &&
      schemaInput.secondaryFor.trim() !== "";

    if (isSecondary) continue;

    const storedInput = storedInputMap.get(String(schemaInput.id));
    const migratedInput = migrateInput(schemaInput, storedInput);

    if (migratedInput) {
      migratedInputs.push(migratedInput);

      if (schemaInput.inputKey) {
        migratedInputByKey.set(schemaInput.inputKey, migratedInput);
      }
    }
  }

  const allowedSecondaryKeys = new Set();

  for (const primaryKey of primaryInputKeys) {
    const primaryStored = migratedInputByKey.get(primaryKey);
    if (primaryStored?.value !== true) continue;

    for (const secondaryKey of safeArray(secondaryInputMap[primaryKey])) {
      allowedSecondaryKeys.add(secondaryKey);
    }
  }

  for (const schemaInput of schemaInputs) {
    const isSecondary =
      typeof schemaInput?.secondaryFor === "string" &&
      schemaInput.secondaryFor.trim() !== "";

    if (!isSecondary) continue;
    if (!allowedSecondaryKeys.has(schemaInput.inputKey)) continue;

    const storedInput = storedInputMap.get(String(schemaInput.id));
    const migratedInput = migrateInput(schemaInput, storedInput);

    if (migratedInput) {
      migratedInputs.push(migratedInput);
    }
  }

  if (migratedInputs.length === 0) return null;

  return {
    id: schemaSection.id,
    inputs: migratedInputs,
  };
}

function migrateDataItemSections({ dataItem, nextProject }) {
  const storedSectionMap = buildSectionMap(dataItem?.sections);
  const migratedSections = [];

  for (const schemaSection of safeArray(nextProject?.sections)) {
    const storedSection = storedSectionMap.get(String(schemaSection.id));

    const migratedSection =
      schemaSection.conditionalSection === "checkboxGate"
        ? migrateCheckboxGateSection(schemaSection, storedSection)
        : migrateStandardSection(schemaSection, storedSection);

    if (migratedSection) {
      migratedSections.push(migratedSection);
    }
  }

  return migratedSections;
}

function getAllowedTimeModes(project) {
  const modes = safeArray(project?.time?.modes).filter(
    (mode) => typeof mode === "string" && mode.trim() !== "",
  );

  return modes.length > 0 ? modes : ["Range", "Instant", "Ongoing"];
}

function normalizeDateRowsForMode(mode, dates, project) {
  const rows = safeArray(dates);

  const nextRows = [];

  for (const row of rows) {
    if (!isPlainObject(row)) continue;

    const start = typeof row.start === "string" ? row.start : "";
    const end =
      row.end === null || typeof row.end === "string" ? row.end : null;

    if (!start) continue;

    if (mode === "Ongoing") {
      nextRows.push({ start, end: null });
      break;
    }

    if (mode === "Instant") {
      nextRows.push({ start, end: start });
      continue;
    }

    if (mode === "Range") {
      /*
       * A row with a start but no end used to be dropped, which - once
       * every row was gone - landed the item in the old "None" mode.
       * With "None" removed there is nowhere to land, so the end is
       * derived from the start plus the project's own declared default
       * duration instead. That is computed from data the item already
       * has rather than invented: the same rule injectCurrentDateTime
       * uses when it builds a brand new Range row, and the same one the
       * Ongoing -> Range switch in renderTime.jsx already applied.
       */
      if (!end) {
        const startMs = Date.parse(start);

        if (!Number.isFinite(startMs)) continue;

        const durationMs = getDefaultDurationMinutes(project?.time) * 60000;

        nextRows.push({
          start,
          end: new Date(startMs + durationMs).toISOString(),
        });

        continue;
      }

      nextRows.push({ start, end });
    }
  }

  return nextRows;
}

function migrateTime(dataItem, previousProject, nextProject) {
  const storedTime = isPlainObject(dataItem?.time) ? dataItem.time : {};
  const nextType = nextProject?.time?.type || previousProject?.time?.type;

  const timezone =
    typeof storedTime.timezone === "string" && storedTime.timezone.trim() !== ""
      ? storedTime.timezone
      : "Etc/UTC";

  if (nextType === "None") {
    return {
      type: "None",
      timezone,
    };
  }

  if (nextType !== "Event") {
    return {
      type: nextType,
      timezone,
    };
  }

  const allowedModes = getAllowedTimeModes(nextProject);

  /*
   * "None" used to be the catch-all landing mode here, both for a
   * stored mode the project no longer allows and for an item left with
   * no usable date rows. It is gone, so the first allowed mode is the
   * fallback instead.
   */
  const storedMode =
    typeof storedTime.mode === "string" &&
    allowedModes.includes(storedTime.mode)
      ? storedTime.mode
      : allowedModes[0] || "Range";

  const dates = normalizeDateRowsForMode(
    storedMode,
    storedTime.dates,
    nextProject,
  );

  /*
   * Only reachable for an item that had no row carrying a parseable
   * start at all - a row missing just its end is repaired above. No
   * such item exists in this database, and nothing can create one now
   * that the empty-dates "None" mode is gone. Deliberately left empty
   * rather than given a made-up timestamp: validateTimePayload will
   * reject it on the next save, which surfaces the problem instead of
   * burying a fabricated date in the record.
   */
  return {
    type: "Event",
    mode: storedMode,
    timezone,
    dates,
  };
}

function migrateExtensions(dataItem, nextProject) {
  const nextExtensions = nextProject?.extensions || {};
  const storedExtensions = isPlainObject(dataItem?.extensions)
    ? dataItem.extensions
    : {};

  const result = {};

  for (const extensionKey of ["Gallery", "Guestbook"]) {
    const extensionConfig = nextExtensions?.[extensionKey];

    if (!extensionConfig) continue;

    if (extensionConfig.enabled !== true) {
      result[extensionKey] = false;
      continue;
    }

    if (extensionConfig.perDataItemToggle !== true) {
      result[extensionKey] = true;
      continue;
    }

    result[extensionKey] =
      typeof storedExtensions[extensionKey] === "boolean"
        ? storedExtensions[extensionKey]
        : true;
  }

  return result;
}

function getSectionSignature(section) {
  return JSON.stringify({
    systemKey: section?.systemKey ?? "",
    conditionalSection: section?.conditionalSection ?? null,
    checkboxGateConfig: section?.checkboxGateConfig ?? null,
  });
}

function getInputConfigSignature(input) {
  if (!input || typeof input !== "object") return "";

  const { id, label, type, inputKey, secondaryFor, ...config } = input;

  return JSON.stringify(config);
}

function getGeometrySignature(geometry) {
  if (!geometry || typeof geometry !== "object") return "";

  const { label, ...config } = geometry;

  return JSON.stringify(config);
}

function getTimeSignature(time) {
  if (!time || typeof time !== "object") return "";

  const { type, label, isFilter, isDisplayed, defaultDurationMinutes, modes } =
    time;

  return JSON.stringify({
    defaultDurationMinutes: defaultDurationMinutes ?? null,
    modes: safeArray(modes),
  });
}

function getRemovedGeometryTypes(previousProject, nextProject) {
  const previousTypes = safeArray(previousProject?.geometry?.types);

  const nextTypeSet = new Set(safeArray(nextProject?.geometry?.types));

  return previousTypes.filter((geometryType) => !nextTypeSet.has(geometryType));
}

async function removeDataItemsForGeometryTypes({
  db,
  projectId,
  collectionName,
  dataType,
  dataItems,
  removedGeometryTypes,
}) {
  if (
    !Array.isArray(removedGeometryTypes) ||
    removedGeometryTypes.length === 0
  ) {
    return {
      removedIds: new Set(),
      removedCount: 0,
      summary: [],
    };
  }

  const removedTypeSet = new Set(removedGeometryTypes);

  const dataItemById = new Map(
    safeArray(dataItems).map((dataItem) => [String(dataItem._id), dataItem]),
  );

  const removedIds = new Set();

  for (const dataItem of safeArray(dataItems)) {
    if (removedTypeSet.has(dataItem?.geometry?.type)) {
      removedIds.add(String(dataItem._id));
    }
  }

  if (removedIds.size === 0) {
    return {
      removedIds,
      removedCount: 0,
      summary: [],
    };
  }

  let addedChild = true;

  while (addedChild) {
    addedChild = false;

    for (const dataItem of safeArray(dataItems)) {
      const id = String(dataItem?._id || "");

      if (!id || removedIds.has(id)) {
        continue;
      }

      const parentId = String(dataItem?.parentDataItemId || "");

      if (parentId && removedIds.has(parentId)) {
        removedIds.add(id);
        addedChild = true;
      }
    }
  }

  const removedObjectIds = [];

  for (const id of removedIds) {
    const dataItem = dataItemById.get(id);

    if (dataItem?._id) {
      removedObjectIds.push(dataItem._id);
    }
  }

  if (removedObjectIds.length === 0) {
    return {
      removedIds,
      removedCount: 0,
      summary: [],
    };
  }

  const summary = [];

  const images = await db
    .collection(collectionName)
    .find({
      projectId,
      dataItemId: {
        $in: removedObjectIds,
      },
      type: "image",
    })
    .toArray();

  for (const image of images) {
    if (image.original?.r2Key) {
      await storage.removeObject(image.original.r2Key);
    }

    if (image.thumb?.r2Key) {
      await storage.removeObject(image.thumb.r2Key);
    }
  }

  if (images.length > 0) {
    await db.collection(collectionName).deleteMany({
      projectId,
      dataItemId: {
        $in: removedObjectIds,
      },
      type: "image",
    });

    summary.push(`${images.length} gallery images removed`);
  }

  const guestbookResult = await db.collection(collectionName).deleteMany({
    projectId,
    dataItemId: {
      $in: removedObjectIds,
    },
    type: "guestbook",
  });

  if (guestbookResult.deletedCount > 0) {
    summary.push(`${guestbookResult.deletedCount} guestbook docs removed`);
  }

  const deleteResult = await db.collection(collectionName).deleteMany({
    projectId,
    _id: {
      $in: removedObjectIds,
    },
    type: dataType,
  });

  if (deleteResult.deletedCount > 0) {
    summary.push(
      `${deleteResult.deletedCount} data items removed for unsupported geometry types`,
    );
  }

  return {
    removedIds,
    removedCount: deleteResult.deletedCount,
    summary,
  };
}

function getExtensionSignature(extension) {
  if (!extension || typeof extension !== "object") {
    return JSON.stringify(extension ?? null);
  }

  return JSON.stringify(extension);
}

function toFiniteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildExtensionLimitChanges(previousProject, nextProject) {
  const previousGallery = previousProject?.extensions?.Gallery || {};
  const nextGallery = nextProject?.extensions?.Gallery || {};

  const previousBulletin = previousProject?.extensions?.Bulletin || {};
  const nextBulletin = nextProject?.extensions?.Bulletin || {};

  const previousChat = previousProject?.extensions?.Chat || {};
  const nextChat = nextProject?.extensions?.Chat || {};

  const previousGalleryMaxImages = toFiniteNumberOrNull(
    previousGallery.maxImages,
  );
  const nextGalleryMaxImages = toFiniteNumberOrNull(nextGallery.maxImages);

  const previousBulletinMaxMessages = toFiniteNumberOrNull(
    previousBulletin.maxMessages,
  );
  const nextBulletinMaxMessages = toFiniteNumberOrNull(
    nextBulletin.maxMessages,
  );

  const previousBulletinMessageLength = toFiniteNumberOrNull(
    previousBulletin.messageLength,
  );
  const nextBulletinMessageLength = toFiniteNumberOrNull(
    nextBulletin.messageLength,
  );

  const previousChatMaxMessages = toFiniteNumberOrNull(
    previousChat.maxMessages,
  );
  const nextChatMaxMessages = toFiniteNumberOrNull(nextChat.maxMessages);

  const previousChatMessageLength = toFiniteNumberOrNull(
    previousChat.messageLength,
  );
  const nextChatMessageLength = toFiniteNumberOrNull(nextChat.messageLength);

  return {
    Gallery: {
      maxImagesReduced:
        previousGallery.enabled === true &&
        nextGallery.enabled === true &&
        previousGalleryMaxImages != null &&
        nextGalleryMaxImages != null &&
        nextGalleryMaxImages < previousGalleryMaxImages,
      previousMaxImages: previousGalleryMaxImages,
      nextMaxImages: nextGalleryMaxImages,
    },

    Bulletin: {
      maxMessagesReduced:
        previousBulletin.enabled === true &&
        nextBulletin.enabled === true &&
        previousBulletinMaxMessages != null &&
        nextBulletinMaxMessages != null &&
        nextBulletinMaxMessages < previousBulletinMaxMessages,
      messageLengthReduced:
        previousBulletin.enabled === true &&
        nextBulletin.enabled === true &&
        previousBulletinMessageLength != null &&
        nextBulletinMessageLength != null &&
        nextBulletinMessageLength < previousBulletinMessageLength,
      previousMaxMessages: previousBulletinMaxMessages,
      nextMaxMessages: nextBulletinMaxMessages,
      previousMessageLength: previousBulletinMessageLength,
      nextMessageLength: nextBulletinMessageLength,
    },

    Chat: {
      maxMessagesReduced:
        previousChat.enabled === true &&
        nextChat.enabled === true &&
        previousChatMaxMessages != null &&
        nextChatMaxMessages != null &&
        nextChatMaxMessages < previousChatMaxMessages,
      messageLengthReduced:
        previousChat.enabled === true &&
        nextChat.enabled === true &&
        previousChatMessageLength != null &&
        nextChatMessageLength != null &&
        nextChatMessageLength < previousChatMessageLength,
      previousMaxMessages: previousChatMaxMessages,
      nextMaxMessages: nextChatMaxMessages,
      previousMessageLength: previousChatMessageLength,
      nextMessageLength: nextChatMessageLength,
    },
  };
}

function sortOldestFirst(a, b) {
  const aTime = new Date(a.createdAt || a.updatedAt || 0).getTime();
  const bTime = new Date(b.createdAt || b.updatedAt || 0).getTime();

  const safeATime = Number.isFinite(aTime) ? aTime : 0;
  const safeBTime = Number.isFinite(bTime) ? bTime : 0;

  if (safeATime !== safeBTime) return safeATime - safeBTime;

  return String(a._id || a.id || "").localeCompare(String(b._id || b.id || ""));
}

function truncateStringToLimit(value, maxLength) {
  if (typeof value !== "string") return value;

  const limit = Number(maxLength);
  if (!Number.isFinite(limit) || limit < 0) return value;

  return value.length > limit ? value.slice(0, limit) : value;
}

export async function enforceGalleryMaxImages({
  db,
  collectionName,
  projectId,
  maxImages,
}) {
  const limit = Number(maxImages);

  if (!Number.isInteger(limit) || limit < 0) {
    return {
      removedCount: 0,
    };
  }

  const images = await db
    .collection(collectionName)
    .find({
      projectId,
      type: "image",
    })
    .toArray();

  if (images.length === 0) {
    return {
      removedCount: 0,
    };
  }

  const imagesByDataItemId = new Map();

  for (const image of images) {
    const key = String(image.dataItemId || "");
    if (!key) continue;

    const group = imagesByDataItemId.get(key) || [];
    group.push(image);
    imagesByDataItemId.set(key, group);
  }

  const imagesToRemove = [];

  for (const group of imagesByDataItemId.values()) {
    const sorted = [...group].sort(sortOldestFirst);

    if (sorted.length <= limit) continue;

    imagesToRemove.push(...sorted.slice(limit));
  }

  for (const image of imagesToRemove) {
    if (image.original?.r2Key) {
      await storage.removeObject(image.original.r2Key);
    }

    if (image.thumb?.r2Key) {
      await storage.removeObject(image.thumb.r2Key);
    }
  }

  if (imagesToRemove.length > 0) {
    await db.collection(collectionName).deleteMany({
      _id: {
        $in: imagesToRemove.map((image) => image._id),
      },
      projectId,
      type: "image",
    });
  }

  return {
    removedCount: imagesToRemove.length,
  };
}

export async function enforceProjectChatLimits({
  db,
  projectId,
  maxMessagesReduced,
  nextMaxMessages,
  messageLengthReduced,
  nextMessageLength,
}) {
  const collection = db.collection("projectChat");

  const doc = await collection.findOne({
    projectId,
    type: "projectChat",
  });

  if (!doc || !Array.isArray(doc.messages)) {
    return {
      removedCount: 0,
      truncatedCount: 0,
    };
  }

  let messages = [...doc.messages];
  let removedCount = 0;
  let truncatedCount = 0;

  if (messageLengthReduced === true) {
    const limit = Number(nextMessageLength);

    if (Number.isInteger(limit) && limit >= 0) {
      messages = messages.map((message) => {
        const nextMessage = {
          ...message,
          message: truncateStringToLimit(message?.message, limit),
        };

        if (nextMessage.message !== message?.message) {
          truncatedCount += 1;
        }

        return nextMessage;
      });
    }
  }

  if (maxMessagesReduced === true) {
    const limit = Number(nextMaxMessages);

    if (Number.isInteger(limit) && limit >= 0 && messages.length > limit) {
      const sorted = [...messages].sort(sortOldestFirst);
      messages = sorted.slice(0, limit);
      removedCount = sorted.length - messages.length;
    }
  }

  if (removedCount === 0 && truncatedCount === 0) {
    return {
      removedCount: 0,
      truncatedCount: 0,
    };
  }

  await collection.updateOne(
    {
      _id: doc._id,
      projectId,
      type: "projectChat",
    },
    {
      $set: {
        messages,
        updatedAt: new Date(),
      },
    },
  );

  return {
    removedCount,
    truncatedCount,
  };
}

export async function enforceBulletinLimits({
  db,
  projectId,
  maxMessagesReduced,
  nextMaxMessages,
  messageLengthReduced,
  nextMessageLength,
}) {
  const collection = db.collection("bulletin");

  const doc = await collection.findOne({
    projectId,
    type: "bulletin",
  });

  if (!doc || !Array.isArray(doc.messages)) {
    return {
      removedCount: 0,
      truncatedCount: 0,
    };
  }

  let messages = [...doc.messages];
  let removedCount = 0;
  let truncatedCount = 0;

  if (messageLengthReduced === true) {
    const limit = Number(nextMessageLength);

    if (Number.isInteger(limit) && limit >= 0) {
      messages = messages.map((message) => {
        const nextMessage = {
          ...message,
          body: truncateStringToLimit(message?.body, limit),
        };

        if (nextMessage.body !== message?.body) {
          truncatedCount += 1;
        }

        return nextMessage;
      });
    }
  }

  if (maxMessagesReduced === true) {
    const limit = Number(nextMaxMessages);

    if (Number.isInteger(limit) && limit >= 0 && messages.length > limit) {
      const sorted = [...messages].sort(sortOldestFirst);
      messages = sorted.slice(0, limit);
      removedCount = sorted.length - messages.length;
    }
  }

  if (removedCount === 0 && truncatedCount === 0) {
    return {
      removedCount: 0,
      truncatedCount: 0,
    };
  }

  await collection.updateOne(
    {
      _id: doc._id,
      projectId,
      type: "bulletin",
    },
    {
      $set: {
        messages,
        updatedAt: new Date(),
      },
    },
  );

  return {
    removedCount,
    truncatedCount,
  };
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  return a.every((value, index) => String(value) === String(b[index]));
}

function getExistingSectionOrder(previousSections, nextSections) {
  const previousIdSet = new Set(
    safeArray(previousSections).map((section) => String(section?.id)),
  );

  return safeArray(nextSections)
    .map((section) => section?.id)
    .filter((id) => previousIdSet.has(String(id)));
}

function getSurvivingSectionOrder(previousSections, nextSections) {
  const nextIdSet = new Set(
    safeArray(nextSections).map((section) => String(section?.id)),
  );

  return safeArray(previousSections)
    .map((section) => section?.id)
    .filter((id) => nextIdSet.has(String(id)));
}

function getExistingInputOrder(previousInputs, nextInputs) {
  const previousIdSet = new Set(
    safeArray(previousInputs).map((input) => String(input?.id)),
  );

  return safeArray(nextInputs)
    .map((input) => input?.id)
    .filter((id) => previousIdSet.has(String(id)));
}

function getSurvivingInputOrder(previousInputs, nextInputs) {
  const nextIdSet = new Set(
    safeArray(nextInputs).map((input) => String(input?.id)),
  );

  return safeArray(previousInputs)
    .map((input) => input?.id)
    .filter((id) => nextIdSet.has(String(id)));
}

function sectionOrderChanged(previousSections, nextSections) {
  return !arraysEqual(
    getSurvivingSectionOrder(previousSections, nextSections),
    getExistingSectionOrder(previousSections, nextSections),
  );
}

function inputOrderChanged(previousSection, nextSection) {
  return !arraysEqual(
    getSurvivingInputOrder(previousSection?.inputs, nextSection?.inputs),
    getExistingInputOrder(previousSection?.inputs, nextSection?.inputs),
  );
}

function hasDataItemExtensionAdded(plan, previousProject, nextProject) {
  if (!plan?.changedExtensions?.length) return false;

  for (const extensionKey of ["Gallery", "Guestbook"]) {
    if (!plan.changedExtensions.includes(extensionKey)) continue;

    const previousEnabled =
      previousProject?.extensions?.[extensionKey]?.enabled === true;

    const nextEnabled =
      nextProject?.extensions?.[extensionKey]?.enabled === true;

    if (!previousEnabled && nextEnabled) {
      return true;
    }
  }

  return false;
}

function hasPlanWork(plan, previousProject, nextProject) {
  if (!plan) return true;

  return (
    plan.removedSectionIds.length > 0 ||
    plan.removedInputIds.length > 0 ||
    plan.addedSectionIds.length > 0 ||
    plan.addedInputIds.length > 0 ||
    plan.changedSectionIds.length > 0 ||
    plan.changedInputIds.length > 0 ||
    plan.removedGeometryTypes.length > 0 ||
    plan.sectionOrderChanged === true ||
    plan.inputOrderChanged === true ||
    plan.changedTime === true ||
    plan.removedExtensions.length > 0 ||
    plan.forceGlobalExtensions.length > 0 ||
    hasDataItemExtensionAdded(plan, previousProject, nextProject)
  );
}

export function generateProjectMigrationPlan(previousProject, nextProject) {
  const removedSectionIds = [];
  const removedInputIds = [];
  const addedSectionIds = [];
  const addedInputIds = [];
  const changedSectionIds = [];
  const changedInputIds = [];
  const changedExtensions = [];
  const removedExtensions = [];
  const forceGlobalExtensions = [];

  const changedGeometry =
    getGeometrySignature(previousProject?.geometry) !==
    getGeometrySignature(nextProject?.geometry);

  const removedGeometryTypes = getRemovedGeometryTypes(
    previousProject,
    nextProject,
  );

  const changedTime =
    getTimeSignature(previousProject?.time) !==
    getTimeSignature(nextProject?.time);

  const previousSections = Array.isArray(previousProject?.sections)
    ? previousProject.sections
    : [];

  const nextSections = Array.isArray(nextProject?.sections)
    ? nextProject.sections
    : [];

  const hasSectionOrderChanged = sectionOrderChanged(
    previousSections,
    nextSections,
  );

  let hasInputOrderChanged = false;

  const previousSectionMap = new Map(
    previousSections.map((section) => [String(section.id), section]),
  );

  const nextSectionMap = new Map(
    nextSections.map((section) => [String(section.id), section]),
  );

  for (const previousSection of previousSections) {
    if (!nextSectionMap.has(String(previousSection.id))) {
      removedSectionIds.push(previousSection.id);
    }
  }

  for (const nextSection of nextSections) {
    const previousSection = previousSectionMap.get(String(nextSection.id));

    if (!previousSection) {
      addedSectionIds.push(nextSection.id);

      for (const nextInput of safeArray(nextSection.inputs)) {
        addedInputIds.push({
          sectionId: nextSection.id,
          inputId: nextInput.id,
        });
      }

      continue;
    }

    if (inputOrderChanged(previousSection, nextSection)) {
      hasInputOrderChanged = true;
    }

    if (
      getSectionSignature(previousSection) !== getSectionSignature(nextSection)
    ) {
      changedSectionIds.push(nextSection.id);
    }

    const previousInputMap = new Map(
      safeArray(previousSection.inputs).map((input) => [
        String(input.id),
        input,
      ]),
    );

    const nextInputMap = new Map(
      safeArray(nextSection.inputs).map((input) => [String(input.id), input]),
    );

    for (const previousInput of safeArray(previousSection.inputs)) {
      if (!nextInputMap.has(String(previousInput.id))) {
        removedInputIds.push(previousInput.id);
      }
    }

    for (const nextInput of safeArray(nextSection.inputs)) {
      const previousInput = previousInputMap.get(String(nextInput.id));

      if (!previousInput) {
        addedInputIds.push({
          sectionId: nextSection.id,
          inputId: nextInput.id,
        });

        continue;
      }

      if (
        getInputConfigSignature(previousInput) !==
        getInputConfigSignature(nextInput)
      ) {
        changedInputIds.push({
          sectionId: nextSection.id,
          inputId: nextInput.id,
        });
      }
    }
  }

  const previousExtensions = previousProject?.extensions || {};
  const nextExtensions = nextProject?.extensions || {};

  const allExtensionKeys = new Set([
    ...Object.keys(previousExtensions),
    ...Object.keys(nextExtensions),
  ]);

  for (const extensionKey of allExtensionKeys) {
    const previousValue = previousExtensions[extensionKey];
    const nextValue = nextExtensions[extensionKey];

    const previousEnabled =
      typeof previousValue === "object"
        ? previousValue?.enabled
        : previousValue;

    const nextEnabled =
      typeof nextValue === "object" ? nextValue?.enabled : nextValue;

    const previousToggle =
      typeof previousValue === "object"
        ? previousValue?.perDataItemToggle
        : false;

    const nextToggle =
      typeof nextValue === "object" ? nextValue?.perDataItemToggle : false;

    if (previousEnabled === true && nextEnabled !== true) {
      removedExtensions.push(extensionKey);
      continue;
    }

    const shouldForceGlobal =
      nextEnabled === true &&
      nextToggle === false &&
      (previousEnabled !== true || previousToggle === true);

    if (shouldForceGlobal) {
      forceGlobalExtensions.push(extensionKey);
    }

    if (
      getExtensionSignature(previousValue) !== getExtensionSignature(nextValue)
    ) {
      changedExtensions.push(extensionKey);
    }
  }

  const extensionLimitChanges = buildExtensionLimitChanges(
    previousProject,
    nextProject,
  );

  return {
    removedSectionIds,
    removedInputIds,
    addedSectionIds,
    addedInputIds,
    changedSectionIds,
    changedInputIds,
    changedGeometry,
    removedGeometryTypes,
    changedTime,
    changedExtensions,
    removedExtensions,
    forceGlobalExtensions,
    extensionLimitChanges,
    sectionOrderChanged: hasSectionOrderChanged,
    inputOrderChanged: hasInputOrderChanged,
  };
}

export async function migrateProjectDataForSchemaUpdate({
  db,
  projectId,
  collectionName,
  previousProject,
  nextProject,
  migrationPlan = null,
}) {
  const plan =
    migrationPlan || generateProjectMigrationPlan(previousProject, nextProject);

  if (!hasPlanWork(plan, previousProject, nextProject)) {
    return {
      updatedCount: 0,
      removedCount: 0,
      summary: [],
    };
  }

  const dataType = getProjectDataType(previousProject.engineKey);

  if (!dataType) {
    return {
      updatedCount: 0,
      removedCount: 0,
      summary: [],
    };
  }

  const dataItems = await db
    .collection(collectionName)
    .find({
      projectId,
      type: dataType,
    })
    .toArray();

  if (dataItems.length === 0) {
    return {
      updatedCount: 0,
      removedCount: 0,
      summary: [],
    };
  }

  const removalResult = await removeDataItemsForGeometryTypes({
    db,
    projectId,
    collectionName,
    dataType,
    dataItems,
    removedGeometryTypes: plan.removedGeometryTypes,
  });

  const remainingDataItems = dataItems.filter(
    (dataItem) => !removalResult.removedIds.has(String(dataItem._id)),
  );

  const bulkOps = [];
  const now = new Date();

  for (const dataItem of remainingDataItems) {
    const migratedSections = migrateDataItemSections({
      dataItem,
      previousProject,
      nextProject,
    });

    const migratedTime = migrateTime(dataItem, previousProject, nextProject);

    const migratedExtensions = migrateExtensions(dataItem, nextProject);

    bulkOps.push({
      updateOne: {
        filter: {
          _id: dataItem._id,
        },
        update: {
          $set: {
            time: migratedTime,
            sections: migratedSections,
            extensions: migratedExtensions,
            updatedAt: now,
          },
        },
      },
    });
  }

  if (bulkOps.length > 0) {
    await db.collection(collectionName).bulkWrite(bulkOps, {
      ordered: false,
    });
  }

  const summary = [...removalResult.summary];

  if (bulkOps.length > 0) {
    summary.push(`${bulkOps.length} data items migrated for schema changes`);
  }

  return {
    updatedCount: bulkOps.length,
    removedCount: removalResult.removedCount,
    summary,
  };
}
