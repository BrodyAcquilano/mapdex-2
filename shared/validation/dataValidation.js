// shared/validation/dataValidation.js

import {
  validatePointGeometry,
  validatePresencePointGeometry,
} from "./pointValidation.js";
import {
  validatePolygonGeometry,
  validatePolygonGeometryForUpdate,
} from "./polygonValidation.js";
import {
  validateLineStringGeometry,
  validateLineStringGeometryForUpdate,
} from "./lineStringValidation.js";
import {
  validateMultiPointGeometry,
  validateMultiPointGeometryForUpdate,
} from "./multiPointValidation.js";
import {
  validateMultiLineStringGeometry,
  validateMultiLineStringGeometryForUpdate,
} from "./multiLineStringValidation.js";
import {
  validateMultiPolygonGeometry,
  validateMultiPolygonGeometryForUpdate,
} from "./multiPolygonValidation.js";
import { validateMotionTimePayload } from "./motionValidation.js";

import {
  exceedsMaxLength,
  isValidNumber,
  parseISOToMs,
  timeAMPMToMinutes,
} from "./formValueHelpers.js";

import {
  GEOMETRY_LIMITS,
  HOURS_LIMITS,
  LAYER_LIMITS,
  TIME_LIMITS,
} from "./validationConstants.js";

const safeArray = (value) => (Array.isArray(value) ? value : []);

const DATA_ITEM_EXTENSION_KEYS = ["Gallery", "Guestbook"];

function valid() {
  return { isValid: true, error: null };
}

function invalid(error = "Invalid data item payload.") {
  return { isValid: false, error };
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  if (!isPlainObject(value)) return false;

  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

export function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;

  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length) return false;

  const expected = new Set(expectedKeys);
  return keys.every((key) => expected.has(key));
}

export function hasNoKeys(value) {
  if (!isPlainObject(value)) return true;

  return Object.keys(value).length === 0;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isValidObjectIdString(value) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  return /^[a-f\d]{24}$/i.test(trimmed);
}

function normalizeLayerValue(value) {
  const layer = Number(value);
  return Number.isInteger(layer) ? layer : null;
}

function validateLayerPayload(schema, dataItem) {
  const layer = normalizeLayerValue(dataItem?.layer);

  if (layer === null) return false;
  if (layer < 1) return false;
  if (layer > LAYER_LIMITS.maxLayers) return false;

  if (
    (schema?.engineKey === "presence" || schema?.engineKey === "motion") &&
    layer !== 1
  ) {
    return false;
  }

  const hasParentDataItemId = hasOwn(dataItem, "parentDataItemId");

  if (
    (schema?.engineKey === "presence" || schema?.engineKey === "motion") &&
    hasParentDataItemId
  ) {
    return false;
  }

  if (layer === 1) {
    return !hasParentDataItemId;
  }

  if (layer === 2) {
    if (!hasParentDataItemId) return false;
    return isValidObjectIdString(dataItem.parentDataItemId);
  }

  return false;
}

function normalizeTag(value) {
  if (typeof value !== "string") return "";

  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";

  return collapsed
    .split(" ")
    .map((word) => {
      if (!word) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function normalizePriceLabel(value) {
  return normalizeTag(value);
}

function getSchemaTagListOptions(input) {
  const defaultTags = safeArray(input?.defaultTags);
  const customTags = safeArray(input?.customTags);

  const sourceTags =
    input?.allowCustomTags === false
      ? defaultTags
      : [...defaultTags, ...customTags];

  const merged = [];
  const seen = new Set();

  for (const rawTag of sourceTags) {
    const normalized = normalizeTag(rawTag);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    merged.push(normalized);
  }

  return merged;
}

function getSchemaPriceCategories(input) {
  const defaults = safeArray(input?.defaultCategoryOptions);
  const custom = safeArray(input?.customCategoryOptions);

  const sourceCategories =
    input?.allowCustomCategoriesAndUnits === false
      ? defaults
      : [...defaults, ...custom];

  const seen = new Set();
  const merged = [];

  for (const raw of sourceCategories) {
    if (typeof raw !== "string") continue;

    const normalized = normalizePriceLabel(raw);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    merged.push(normalized);
  }

  return merged;
}

function getSchemaPriceUnitsByCategory(input) {
  const defaultMap = isPlainObject(input?.defaultPriceUnitOptionsByCategory)
    ? input.defaultPriceUnitOptionsByCategory
    : {};

  const customMap =
    input?.allowCustomCategoriesAndUnits === false
      ? {}
      : isPlainObject(input?.customUnitOptionsByCategory)
        ? input.customUnitOptionsByCategory
        : {};

  const result = {};

  for (const [rawCategory, rawUnits] of Object.entries(defaultMap)) {
    const category = normalizePriceLabel(rawCategory);
    if (!category) continue;

    result[category] = result[category] || [];

    for (const rawUnit of safeArray(rawUnits)) {
      const unit = normalizePriceLabel(rawUnit);
      if (!unit) continue;

      if (
        !result[category].some(
          (existing) => existing.toLowerCase() === unit.toLowerCase(),
        )
      ) {
        result[category].push(unit);
      }
    }
  }

  for (const [rawCategory, rawUnits] of Object.entries(customMap)) {
    const category = normalizePriceLabel(rawCategory);
    if (!category) continue;

    result[category] = result[category] || [];

    for (const rawUnit of safeArray(rawUnits)) {
      const unit = normalizePriceLabel(rawUnit);
      if (!unit) continue;

      if (
        !result[category].some(
          (existing) => existing.toLowerCase() === unit.toLowerCase(),
        )
      ) {
        result[category].push(unit);
      }
    }
  }

  return result;
}

function getNormalizedUniqueUnitsFromRows(rows) {
  const units = [];
  const seen = new Set();

  for (const row of safeArray(rows)) {
    if (!isPlainObject(row)) continue;

    const normalizedUnit = normalizePriceLabel(row.unit);
    if (!normalizedUnit) continue;

    const key = normalizedUnit.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    units.push(normalizedUnit);
  }

  return units;
}

function shouldSkipCheckboxGateInput(section, sectionData, input) {
  if (section?.conditionalSection !== "checkboxGate") return false;

  if (
    !input ||
    typeof input.secondaryFor !== "string" ||
    input.secondaryFor.trim() === ""
  ) {
    return false;
  }

  const parentKey = input.secondaryFor;

  const parentIndex = Array.isArray(section.inputs)
    ? section.inputs.findIndex((candidate) => candidate?.inputKey === parentKey)
    : -1;

  if (parentIndex === -1) return false;

  const parentStored = sectionData?.inputs?.[parentIndex];

  return parentStored?.value !== true;
}

function validateTopLevelShape(schema, dataItem, mode) {
  if (!isPlainObject(dataItem)) return false;

  if (mode === "add") {
    const layer = normalizeLayerValue(dataItem?.layer);

    if (layer === 1) {
      return hasExactKeys(dataItem, [
        "layer",
        "geometry",
        "time",
        "sections",
        "extensions",
      ]);
    }

    if (layer === 2) {
      return hasExactKeys(dataItem, [
        "layer",
        "parentDataItemId",
        "geometry",
        "time",
        "sections",
        "extensions",
      ]);
    }

    return false;
  }

  if (mode === "update") {
    if (
      !hasExactKeys(dataItem, [
        "_id",
        "geometry",
        "time",
        "sections",
        "updatedAt",
      ])
    ) {
      return false;
    }

    if (!dataItem._id) return false;
    if (!dataItem.updatedAt) return false;

    return true;
  }

  return false;
}

function validateSectionAndInputIds(schema, dataItem) {
  const schemaSections = safeArray(schema?.sections);
  const dataSections = dataItem?.sections;

  if (!Array.isArray(dataSections)) return false;
  if (dataSections.length !== schemaSections.length) return false;

  const seenSectionIds = new Set();

  for (
    let sectionIndex = 0;
    sectionIndex < schemaSections.length;
    sectionIndex += 1
  ) {
    const schemaSection = schemaSections[sectionIndex];
    const dataSection = dataSections[sectionIndex];

    if (!isPlainObject(dataSection)) return false;
    if (!hasOnlyKeys(dataSection, ["id", "inputs"])) return false;
    if (String(dataSection.id) !== String(schemaSection.id)) return false;

    const sectionKey = String(dataSection.id);

    if (seenSectionIds.has(sectionKey)) return false;
    seenSectionIds.add(sectionKey);

    const schemaInputs = safeArray(schemaSection.inputs);
    const dataInputs = dataSection.inputs;

    if (!Array.isArray(dataInputs)) return false;
    if (dataInputs.length !== schemaInputs.length) return false;

    const seenInputIds = new Set();

    for (
      let inputIndex = 0;
      inputIndex < schemaInputs.length;
      inputIndex += 1
    ) {
      const schemaInput = schemaInputs[inputIndex];
      const dataInput = dataInputs[inputIndex];

      if (!isPlainObject(dataInput)) return false;
      if (String(dataInput.id) !== String(schemaInput.id)) return false;

      const inputKey = String(dataInput.id);

      if (seenInputIds.has(inputKey)) return false;
      seenInputIds.add(inputKey);
    }
  }

  return true;
}

export function validateGeometryPayload(schema, geometry, { mode } = {}) {
  if (!isPlainObject(geometry)) return false;

  const geometryType = geometry.type;

  if (typeof geometryType !== "string" || !geometryType) {
    return false;
  }

  const allowedGeometryTypes = schema?.geometry?.types;

  if (
    !Array.isArray(allowedGeometryTypes) ||
    allowedGeometryTypes.length === 0
  ) {
    return false;
  }

  if (!allowedGeometryTypes.includes(geometryType)) {
    return false;
  }

  if (geometryType === "Point") {
    if (schema?.engineKey === "presence") {
      return validatePresencePointGeometry(geometry);
    }

    return validatePointGeometry(geometry);
  }

  if (geometryType === "LineString") {
    if (mode === "update") {
      return validateLineStringGeometryForUpdate(geometry);
    }

    return validateLineStringGeometry(geometry);
  }

  if (geometryType === "Polygon") {
    if (mode === "update") {
      return validatePolygonGeometryForUpdate(geometry);
    }

    return validatePolygonGeometry(geometry);
  }

  if (geometryType === "MultiPoint") {
    if (mode === "update") {
      return validateMultiPointGeometryForUpdate(geometry);
    }

    return validateMultiPointGeometry(geometry);
  }

  if (geometryType === "MultiLineString") {
    if (mode === "update") {
      return validateMultiLineStringGeometryForUpdate(geometry);
    }

    return validateMultiLineStringGeometry(geometry);
  }

  if (geometryType === "MultiPolygon") {
    if (mode === "update") {
      return validateMultiPolygonGeometryForUpdate(geometry);
    }

    return validateMultiPolygonGeometry(geometry);
  }

  return false;
}

function validateTimePayload(schema, time, geometry = null) {
  if (!isPlainObject(time)) return false;

  const timeType = time.type || schema?.time?.type;

  if (!timeType) return false;
  if (schema?.time?.type && timeType !== schema.time.type) return false;

  if (timeType === "None") {
    return hasOnlyKeys(time, ["type", "timezone"]);
  }

  if (timeType === "Motion") {
    return validateMotionTimePayload(time, geometry);
  }

  if (timeType !== "Event") {
    return false;
  }

  if (!hasOnlyKeys(time, ["type", "mode", "timezone", "dates"])) {
    return false;
  }

  const mode = time.mode;
  const dates = time.dates;
  const timezone = time.timezone;

  if (!TIME_LIMITS.eventModeOptions.includes(mode)) return false;
  if (!timezone || typeof timezone !== "string") return false;

  /*
   * Every remaining mode needs at least one date row - the "None" mode,
   * which was the one case that required an EMPTY dates array, is gone.
   */
  if (!Array.isArray(dates) || dates.length === 0) return false;

  if (dates.length > TIME_LIMITS.maxDates) {
    return false;
  }

  if (mode === "Ongoing" && dates.length !== 1) return false;

  for (let i = 0; i < dates.length; i += 1) {
    const row = dates[i];

    if (!hasOnlyKeys(row, ["start", "end"])) return false;

    const start = row.start;
    const end = row.end;

    const startMs = parseISOToMs(start);
    const endMs = parseISOToMs(end);

    if (mode === "Range") {
      if (!start || !end) return false;
      if (startMs == null || endMs == null) return false;
      if (endMs < startMs) return false;
    }

    if (mode === "Instant") {
      if (!start || !end) return false;
      if (startMs == null || endMs == null) return false;
      if (startMs !== endMs) return false;
    }

    if (mode === "Ongoing") {
      if (!start) return false;
      if (startMs == null) return false;
      if (end !== null) return false;
    }
  }

  return true;
}

function validateTextLikeInput(schemaInput, stored) {
  if (!hasOnlyKeys(stored, ["id", "value"])) return false;

  const value = stored.value;

  if (
    schemaInput.isRequired &&
    (value === "" || value === null || value === undefined)
  ) {
    return false;
  }

  if (value !== "" && value !== null && value !== undefined) {
    if (typeof value !== "string") return false;
    if (exceedsMaxLength(value, schemaInput.maxLength)) return false;
  }

  return true;
}

function validateDropdownInput(schemaInput, stored) {
  if (!validateTextLikeInput(schemaInput, stored)) return false;

  const value = stored.value;

  if (
    value !== "" &&
    value !== null &&
    value !== undefined &&
    !safeArray(schemaInput.options).includes(value)
  ) {
    return false;
  }

  return true;
}

function validateNumberLikeInput(
  schemaInput,
  stored,
  { capacity = false } = {},
) {
  if (!hasOnlyKeys(stored, ["id", "mode", "singleValue", "min", "max"])) {
    return false;
  }

  const { mode, singleValue, min, max } = stored;
  const allowedModes = safeArray(schemaInput.modeOptions);
  const isEmptyMode = mode === "" || mode === null || mode === undefined;

  if (schemaInput.isRequired && isEmptyMode) return false;
  if (isEmptyMode) return true;
  if (!allowedModes.includes(mode)) return false;

  if (mode === "Single Value") {
    if (exceedsMaxLength(singleValue, schemaInput.maxLength)) return false;
    return isValidNumber(singleValue, schemaInput);
  }

  if (mode === "Min Only" && !capacity) {
    if (exceedsMaxLength(min, schemaInput.maxLength)) return false;
    return isValidNumber(min, schemaInput);
  }

  if (mode === "Max Only" && !capacity) {
    if (exceedsMaxLength(max, schemaInput.maxLength)) return false;
    return isValidNumber(max, schemaInput);
  }

  if (mode === "Min-Max Range") {
    if (exceedsMaxLength(min, schemaInput.maxLength)) return false;
    if (exceedsMaxLength(max, schemaInput.maxLength)) return false;
    if (!isValidNumber(min, schemaInput)) return false;
    if (!isValidNumber(max, schemaInput)) return false;
    if (Number(max) < Number(min)) return false;

    return true;
  }

  return false;
}

function validateCheckboxInput(schemaInput, stored) {
  const allowedKeys =
    schemaInput.isApplicableOption === true
      ? ["id", "value", "isApplicable"]
      : ["id", "value"];

  if (!hasOnlyKeys(stored, allowedKeys)) return false;
  if (typeof stored.value !== "boolean") return false;

  if (
    schemaInput.isApplicableOption === true &&
    typeof stored.isApplicable !== "boolean"
  ) {
    return false;
  }

  return true;
}

function validateHoursInput(schemaInput, stored) {
  if (!hasOnlyKeys(stored, ["id", "openHours"])) return false;

  const openHours = isPlainObject(stored.openHours) ? stored.openHours : {};
  let hasAnyInterval = false;

  for (const dayRows of Object.values(openHours)) {
    const rows = Array.isArray(dayRows) ? dayRows : [];

    if (rows.length > HOURS_LIMITS.maxRangesPerDay) {
      return false;
    }

    let previousCloseMin = null;

    for (const row of rows) {
      if (!hasOnlyKeys(row, ["open", "close"])) return false;

      const open = row.open;
      const close = row.close;

      const hasOpen = typeof open === "string" && open.trim() !== "";
      const hasClose = typeof close === "string" && close.trim() !== "";

      if (!hasOpen && !hasClose) continue;
      if (!hasOpen || !hasClose) return false;

      const openMin = timeAMPMToMinutes(open);
      const isAllDay = open === "12:00 a.m." && close === "12:00 a.m.";

      const closeMin = isAllDay
        ? 1440
        : close === "12:00 a.m."
          ? 1440
          : timeAMPMToMinutes(close);

      if (openMin == null || closeMin == null) return false;
      if (closeMin <= openMin) return false;

      if (previousCloseMin != null && openMin <= previousCloseMin) {
        return false;
      }

      previousCloseMin = closeMin;
      hasAnyInterval = true;
    }
  }

  if (schemaInput.isRequired && !hasAnyInterval) return false;

  return true;
}

function validateAgeRangeInput(schemaInput, stored) {
  if (!hasOnlyKeys(stored, ["id", "mode", "min", "max"])) return false;

  const { mode, min, max } = stored;
  const allowedModes = safeArray(schemaInput.ageModeOptions);
  const isEmptyMode = mode === "" || mode === null || mode === undefined;
  const isNum = (value) => Number.isFinite(Number(value));

  if (schemaInput.isRequired && isEmptyMode) return false;
  if (isEmptyMode) return true;
  if (!allowedModes.includes(mode)) return false;

  if (mode === "All Ages") return true;

  if (mode === "Min Only") {
    if (exceedsMaxLength(min, schemaInput.maxLength)) return false;
    if (!isNum(min)) return false;
    if (Number(min) < schemaInput.minValue) return false;
    if (Number(min) > schemaInput.maxValue) return false;

    return true;
  }

  if (mode === "Max Only") {
    if (exceedsMaxLength(max, schemaInput.maxLength)) return false;
    if (!isNum(max)) return false;
    if (Number(max) < schemaInput.minValue) return false;
    if (Number(max) > schemaInput.maxValue) return false;

    return true;
  }

  if (mode === "Min-Max Range") {
    if (exceedsMaxLength(min, schemaInput.maxLength)) return false;
    if (exceedsMaxLength(max, schemaInput.maxLength)) return false;
    if (!isNum(min) || !isNum(max)) return false;
    if (Number(min) < schemaInput.minValue) return false;
    if (Number(min) > schemaInput.maxValue) return false;
    if (Number(max) < schemaInput.minValue) return false;
    if (Number(max) > schemaInput.maxValue) return false;
    if (Number(max) < Number(min)) return false;

    return true;
  }

  return false;
}

function validateTagListInput(schemaInput, stored) {
  if (!hasOnlyKeys(stored, ["id", "tags"])) return false;

  const schemaTags = getSchemaTagListOptions(schemaInput);
  const dataTags = Array.isArray(stored.tags) ? stored.tags : [];

  const normalizedDataTags = dataTags
    .filter((tag) => typeof tag === "string")
    .map(normalizeTag)
    .filter(Boolean);

  if (normalizedDataTags.length !== dataTags.length) return false;

  if (normalizedDataTags.length > (schemaInput.maxItems ?? 1000)) {
    return false;
  }

  const schemaTagSet = new Set(schemaTags.map((tag) => tag.toLowerCase()));

  for (const tag of normalizedDataTags) {
    if (exceedsMaxLength(tag, schemaInput.maxLength)) return false;

    if (
      schemaInput?.allowCustomTags === false &&
      !schemaTagSet.has(tag.toLowerCase())
    ) {
      return false;
    }
  }

  return true;
}

function validatePriceRangeArrayInput(schemaInput, stored) {
  if (!hasOnlyKeys(stored, ["id", "categories"])) return false;

  const categories = isPlainObject(stored.categories)
    ? stored.categories
    : null;

  if (!categories) return false;

  const allowCustomCategoriesAndUnits =
    schemaInput?.allowCustomCategoriesAndUnits !== false;

  const schemaCategories = getSchemaPriceCategories(schemaInput);
  const schemaUnitsByCategory = getSchemaPriceUnitsByCategory(schemaInput);
  const allowedModes = safeArray(schemaInput?.priceModeOptions);

  const normalizedDataCategoryNames = [];
  const normalizedCategoryMap = {};
  const seenCategories = new Set();

  for (const [rawCategory, rows] of Object.entries(categories)) {
    const normalizedCategory = normalizePriceLabel(rawCategory);

    if (!normalizedCategory) return false;
    if (exceedsMaxLength(normalizedCategory, schemaInput.maxLength)) {
      return false;
    }

    const categoryKey = normalizedCategory.toLowerCase();

    if (seenCategories.has(categoryKey)) return false;
    if (!Array.isArray(rows)) return false;

    seenCategories.add(categoryKey);
    normalizedDataCategoryNames.push(normalizedCategory);
    normalizedCategoryMap[normalizedCategory] = rows;
  }

  if (!allowCustomCategoriesAndUnits) {
    const schemaCategorySet = new Set(
      schemaCategories.map((category) => category.toLowerCase()),
    );

    for (const category of normalizedDataCategoryNames) {
      if (!schemaCategorySet.has(category.toLowerCase())) return false;
    }
  }

  const mergedUniqueCategories = [];
  const mergedCategorySeen = new Set();

  for (const category of [
    ...schemaCategories,
    ...normalizedDataCategoryNames,
  ]) {
    const key = category.toLowerCase();
    if (mergedCategorySeen.has(key)) continue;

    mergedCategorySeen.add(key);
    mergedUniqueCategories.push(category);
  }

  if (mergedUniqueCategories.length > (schemaInput.maxCategories ?? 20)) {
    return false;
  }

  let totalPriceItems = 0;

  for (const category of normalizedDataCategoryNames) {
    const rows = normalizedCategoryMap[category];

    if (!Array.isArray(rows)) return false;
    if (rows.length === 0) return false;
    if (rows.length > (schemaInput.maxItemsPerCategory ?? 50)) return false;

    totalPriceItems += rows.length;

    const schemaUnits = safeArray(schemaUnitsByCategory[category]);
    const dataUnits = getNormalizedUniqueUnitsFromRows(rows);

    if (!allowCustomCategoriesAndUnits) {
      const schemaUnitSet = new Set(
        schemaUnits.map((unit) => unit.toLowerCase()),
      );

      for (const unit of dataUnits) {
        if (!schemaUnitSet.has(unit.toLowerCase())) return false;
      }
    }

    const mergedUnits = [];
    const seenUnits = new Set();

    for (const unit of [...schemaUnits, ...dataUnits]) {
      const key = unit.toLowerCase();
      if (seenUnits.has(key)) continue;

      seenUnits.add(key);
      mergedUnits.push(unit);
    }

    if (dataUnits.length > (schemaInput.maxUnitsPerCategory ?? 10)) {
      return false;
    }

    if (mergedUnits.length > (schemaInput.maxUnitsPerCategory ?? 10)) {
      return false;
    }

    for (const row of rows) {
      if (!isPlainObject(row)) return false;

      if (
        !hasOnlyKeys(row, [
          "label",
          "unit",
          "priceMode",
          "fixedPrice",
          "min",
          "max",
        ])
      ) {
        return false;
      }

      if (typeof row.label !== "string" || row.label.trim() === "") {
        return false;
      }

      const normalizedLabel = normalizePriceLabel(row.label);
      if (!normalizedLabel) return false;
      if (exceedsMaxLength(normalizedLabel, schemaInput.maxLength)) {
        return false;
      }

      if (typeof row.unit !== "string" || row.unit.trim() === "") return false;

      const normalizedRowUnit = normalizePriceLabel(row.unit);
      if (!normalizedRowUnit) return false;
      if (exceedsMaxLength(normalizedRowUnit, schemaInput.maxLength)) {
        return false;
      }

      if (
        !dataUnits.some(
          (unit) => unit.toLowerCase() === normalizedRowUnit.toLowerCase(),
        )
      ) {
        return false;
      }

      if (
        !mergedUnits.some(
          (unit) => unit.toLowerCase() === normalizedRowUnit.toLowerCase(),
        )
      ) {
        return false;
      }

      if (
        typeof row.priceMode !== "string" ||
        !allowedModes.includes(row.priceMode)
      ) {
        return false;
      }

      if (row.priceMode === "Free") {
        if (row.fixedPrice !== null) return false;
        if (row.min !== null) return false;
        if (row.max !== null) return false;
        continue;
      }

      if (row.priceMode === "Fixed Price") {
        if (row.min !== null) return false;
        if (row.max !== null) return false;
        if (exceedsMaxLength(row.fixedPrice, schemaInput.maxLength)) {
          return false;
        }
        if (!isValidNumber(row.fixedPrice, schemaInput)) return false;
        continue;
      }

      if (row.priceMode === "Min Only") {
        if (row.fixedPrice !== null) return false;
        if (row.max !== null) return false;
        if (exceedsMaxLength(row.min, schemaInput.maxLength)) return false;
        if (!isValidNumber(row.min, schemaInput)) return false;
        continue;
      }

      if (row.priceMode === "Max Only") {
        if (row.fixedPrice !== null) return false;
        if (row.min !== null) return false;
        if (exceedsMaxLength(row.max, schemaInput.maxLength)) return false;
        if (!isValidNumber(row.max, schemaInput)) return false;
        continue;
      }

      if (row.priceMode === "Min-Max Range") {
        if (row.fixedPrice !== null) return false;
        if (exceedsMaxLength(row.min, schemaInput.maxLength)) return false;
        if (exceedsMaxLength(row.max, schemaInput.maxLength)) return false;
        if (!isValidNumber(row.min, schemaInput)) return false;
        if (!isValidNumber(row.max, schemaInput)) return false;
        if (Number(row.max) < Number(row.min)) return false;
        continue;
      }

      return false;
    }
  }

  if (totalPriceItems > (schemaInput.maxTotalPriceItems ?? 1000)) {
    return false;
  }

  return true;
}

function validateStoredInput(schemaInput, stored) {
  switch (schemaInput.type) {
    case "text":
    case "notes":
    case "website":
    case "phoneNumber":
    case "email":
      return validateTextLikeInput(schemaInput, stored);

    case "dropdown":
      return validateDropdownInput(schemaInput, stored);

    case "number":
    case "percentage":
      return validateNumberLikeInput(schemaInput, stored);

    case "capacity":
      return validateNumberLikeInput(schemaInput, stored, { capacity: true });

    case "checkbox":
      return validateCheckboxInput(schemaInput, stored);

    case "hours":
      return validateHoursInput(schemaInput, stored);

    case "ageRange":
      return validateAgeRangeInput(schemaInput, stored);

    case "tagList":
      return validateTagListInput(schemaInput, stored);

    case "priceRangeArray":
      return validatePriceRangeArrayInput(schemaInput, stored);

    default:
      return false;
  }
}

function validateSectionsPayload(schema, dataItem) {
  if (!validateSectionAndInputIds(schema, dataItem)) return false;

  const schemaSections = safeArray(schema.sections);
  const dataSections = dataItem.sections;

  for (
    let sectionIndex = 0;
    sectionIndex < schemaSections.length;
    sectionIndex += 1
  ) {
    const schemaSection = schemaSections[sectionIndex];
    const dataSection = dataSections[sectionIndex];

    for (
      let inputIndex = 0;
      inputIndex < safeArray(schemaSection.inputs).length;
      inputIndex += 1
    ) {
      const schemaInput = schemaSection.inputs[inputIndex];
      const storedInput = dataSection.inputs[inputIndex];

      if (
        shouldSkipCheckboxGateInput(schemaSection, dataSection, schemaInput)
      ) {
        continue;
      }

      if (!validateStoredInput(schemaInput, storedInput)) {
        return false;
      }
    }
  }

  return true;
}

export function validateExtensionsPayload(schema, extensions) {
  if (!isPlainObject(extensions)) return false;

  const rawExtensions = schema?.extensions || {};
  const dataItemExtensions = DATA_ITEM_EXTENSION_KEYS.map((id) => {
    const ext = rawExtensions?.[id];
    return ext ? { id, ...ext } : null;
  }).filter(Boolean);

  const expectedIds = dataItemExtensions.map((ext) => ext.id);

  if (!hasExactKeys(extensions, expectedIds)) return false;

  for (const ext of dataItemExtensions) {
    const value = extensions[ext.id];

    if (typeof value !== "boolean") return false;
    if (!ext.enabled && value !== false) return false;
    if (ext.enabled && !ext.perDataItemToggle && value !== true) return false;
  }

  return true;
}

export function validateDataItemPayload({
  schema,
  dataItem,
  mode = "add",
} = {}) {
  if (!schema) {
    return invalid("Invalid project schema.");
  }

  if (mode !== "add" && mode !== "update") {
    return invalid("Invalid data item payload.");
  }

  if (!validateTopLevelShape(schema, dataItem, mode)) {
    return invalid("Invalid data item payload.");
  }

  if (mode === "add" && !validateLayerPayload(schema, dataItem)) {
    return invalid("Invalid layer.");
  }

  if (!validateSectionAndInputIds(schema, dataItem)) {
    return invalid("Invalid IDs.");
  }

  if (!validateGeometryPayload(schema, dataItem.geometry, { mode })) {
    return invalid("Invalid geometry.");
  }

  if (!validateTimePayload(schema, dataItem.time, dataItem.geometry)) {
    return invalid("Invalid time.");
  }

  if (!validateSectionsPayload(schema, dataItem)) {
    return invalid("Invalid sections.");
  }

  if (
    mode === "add" &&
    !validateExtensionsPayload(schema, dataItem.extensions)
  ) {
    return invalid("Invalid extensions.");
  }

  return valid();
}
