import { hasExactKeys } from "../auth/auth.js";
import {
  PRICE_RANGE_ARRAY_LIMITS,
  PROJECT_LIMITS,
  TAG_LIST_LIMITS,
} from "./validationConstants.js";

const PRESENCE_GET_PAYLOAD_FIELDS = ["projectId", "schemaMetadata"];

const PRESENCE_SCHEMA_METADATA_FIELDS = [
  "_id",
  "configUpdatedAt",
  "customOptionInputs",
];

const TAG_LIST_METADATA_FIELDS = [
  "sectionId",
  "inputId",
  "type",
  "customTags",
];

const PRICE_RANGE_ARRAY_METADATA_FIELDS = [
  "sectionId",
  "inputId",
  "type",
  "customCategoryOptions",
  "customUnitOptionsByCategory",
];

function valid() {
  return { isValid: true, error: null };
}

function invalid(error = "Invalid presence schema metadata.") {
  return { isValid: false, error };
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isObjectIdLike(value) {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
}

function isDateLike(value) {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return false;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime());
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSchemaString(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function validateUniqueStringArray(values, label) {
  const seen = new Set();

  for (const value of values) {
    const key = value.toLowerCase();

    if (seen.has(key)) {
      return invalid(`${label} contains duplicate value "${value}".`);
    }

    seen.add(key);
  }

  return valid();
}

function validateStringOptionsArray({
  values,
  label,
  maxItems,
  maxLength,
}) {
  if (!Array.isArray(values)) {
    return invalid(`${label} must be an array.`);
  }

  if (values.length > maxItems) {
    return invalid(`${label} cannot contain more than ${maxItems} items.`);
  }

  const normalizedValues = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (typeof value !== "string") {
      return invalid(`${label}[${index}] must be a string.`);
    }

    const normalizedValue = normalizeSchemaString(value);

    if (!normalizedValue) {
      return invalid(`${label}[${index}] cannot be empty.`);
    }

    if (normalizedValue.length > maxLength) {
      return invalid(
        `${label}[${index}] must be at most ${maxLength} characters.`,
      );
    }

    normalizedValues.push(normalizedValue);
  }

  return validateUniqueStringArray(normalizedValues, label);
}

function validateTagListMetadata(input, index) {
  if (!hasExactKeys(input, TAG_LIST_METADATA_FIELDS)) {
    return invalid(`customOptionInputs[${index}] has invalid tagList fields.`);
  }

  if (!isFiniteNumber(input.sectionId)) {
    return invalid(`customOptionInputs[${index}].sectionId must be a number.`);
  }

  if (!isFiniteNumber(input.inputId)) {
    return invalid(`customOptionInputs[${index}].inputId must be a number.`);
  }

  if (input.type !== "tagList") {
    return invalid(`customOptionInputs[${index}].type must be "tagList".`);
  }

  return validateStringOptionsArray({
    values: input.customTags,
    label: `customOptionInputs[${index}].customTags`,
    maxItems: TAG_LIST_LIMITS.maxItems.max,
    maxLength: TAG_LIST_LIMITS.maxLength.max,
  });
}

function validateCustomUnitOptionsByCategory(value, index) {
  if (!isPlainObject(value)) {
    return invalid(
      `customOptionInputs[${index}].customUnitOptionsByCategory must be an object.`,
    );
  }

  const categoryNames = Object.keys(value);

  if (categoryNames.length > PRICE_RANGE_ARRAY_LIMITS.maxCategories.max) {
    return invalid(
      `customOptionInputs[${index}].customUnitOptionsByCategory cannot contain more than ${PRICE_RANGE_ARRAY_LIMITS.maxCategories.max} categories.`,
    );
  }

  for (const categoryName of categoryNames) {
    const normalizedCategory = normalizeSchemaString(categoryName);

    if (!normalizedCategory) {
      return invalid(
        `customOptionInputs[${index}].customUnitOptionsByCategory contains an empty category.`,
      );
    }

    if (normalizedCategory.length > PRICE_RANGE_ARRAY_LIMITS.maxLength.max) {
      return invalid(
        `customOptionInputs[${index}].customUnitOptionsByCategory category names must be at most ${PRICE_RANGE_ARRAY_LIMITS.maxLength.max} characters.`,
      );
    }

    const units = value[categoryName];

    const unitValidation = validateStringOptionsArray({
      values: units,
      label: `customOptionInputs[${index}].customUnitOptionsByCategory.${categoryName}`,
      maxItems: PRICE_RANGE_ARRAY_LIMITS.maxUnitsPerCategory.max,
      maxLength: PRICE_RANGE_ARRAY_LIMITS.maxLength.max,
    });

    if (!unitValidation.isValid) {
      return unitValidation;
    }
  }

  return valid();
}

function validatePriceRangeArrayMetadata(input, index) {
  if (!hasExactKeys(input, PRICE_RANGE_ARRAY_METADATA_FIELDS)) {
    return invalid(
      `customOptionInputs[${index}] has invalid priceRangeArray fields.`,
    );
  }

  if (!isFiniteNumber(input.sectionId)) {
    return invalid(`customOptionInputs[${index}].sectionId must be a number.`);
  }

  if (!isFiniteNumber(input.inputId)) {
    return invalid(`customOptionInputs[${index}].inputId must be a number.`);
  }

  if (input.type !== "priceRangeArray") {
    return invalid(
      `customOptionInputs[${index}].type must be "priceRangeArray".`,
    );
  }

  const categoriesValidation = validateStringOptionsArray({
    values: input.customCategoryOptions,
    label: `customOptionInputs[${index}].customCategoryOptions`,
    maxItems: PRICE_RANGE_ARRAY_LIMITS.maxCategories.max,
    maxLength: PRICE_RANGE_ARRAY_LIMITS.maxLength.max,
  });

  if (!categoriesValidation.isValid) {
    return categoriesValidation;
  }

  return validateCustomUnitOptionsByCategory(
    input.customUnitOptionsByCategory,
    index,
  );
}

export function buildPresenceSchemaMetadata(schema) {
  if (!schema) return null;

  const customOptionInputs = [];

  const sections = Array.isArray(schema.sections) ? schema.sections : [];

  for (const section of sections) {
    const sectionId = section?.id;
    const inputs = Array.isArray(section?.inputs) ? section.inputs : [];

    for (const input of inputs) {
      if (input?.type === "tagList") {
        customOptionInputs.push({
          sectionId,
          inputId: input.id,
          type: "tagList",
          customTags: Array.isArray(input.customTags)
            ? input.customTags
            : [],
        });
      }

      if (input?.type === "priceRangeArray") {
        customOptionInputs.push({
          sectionId,
          inputId: input.id,
          type: "priceRangeArray",
          customCategoryOptions: Array.isArray(input.customCategoryOptions)
            ? input.customCategoryOptions
            : [],
          customUnitOptionsByCategory:
            input.customUnitOptionsByCategory &&
            typeof input.customUnitOptionsByCategory === "object" &&
            !Array.isArray(input.customUnitOptionsByCategory)
              ? input.customUnitOptionsByCategory
              : {},
        });
      }
    }
  }

  return {
    _id: schema._id,
    configUpdatedAt: schema.configUpdatedAt,
    customOptionInputs,
  };
}

export function validatePresenceSchemaMetadata(schemaMetadata, projectId = "") {
  if (!isPlainObject(schemaMetadata)) {
    return invalid("Schema metadata must be an object.");
  }

  if (!hasExactKeys(schemaMetadata, PRESENCE_SCHEMA_METADATA_FIELDS)) {
    return invalid("Invalid schema metadata fields.");
  }

  if (!isObjectIdLike(schemaMetadata._id)) {
    return invalid("Invalid schema metadata project id.");
  }

  if (projectId && String(schemaMetadata._id) !== String(projectId)) {
    return invalid("Schema metadata project id does not match projectId.");
  }

  if (!isDateLike(schemaMetadata.configUpdatedAt)) {
    return invalid("Schema metadata configUpdatedAt must be a valid date.");
  }

  if (!Array.isArray(schemaMetadata.customOptionInputs)) {
    return invalid("Schema metadata customOptionInputs must be an array.");
  }

  const maxCustomOptionInputs =
    PROJECT_LIMITS.maxSections * PROJECT_LIMITS.maxInputsPerSection;

  if (schemaMetadata.customOptionInputs.length > maxCustomOptionInputs) {
    return invalid(
      `Schema metadata customOptionInputs cannot exceed ${maxCustomOptionInputs} inputs.`,
    );
  }

  const seenInputIds = new Set();

  for (
    let index = 0;
    index < schemaMetadata.customOptionInputs.length;
    index += 1
  ) {
    const input = schemaMetadata.customOptionInputs[index];

    if (!isPlainObject(input)) {
      return invalid(`customOptionInputs[${index}] must be an object.`);
    }

    if (!isFiniteNumber(input.inputId)) {
      return invalid(`customOptionInputs[${index}].inputId must be a number.`);
    }

    if (seenInputIds.has(input.inputId)) {
      return invalid(
        `Schema metadata contains duplicate input id "${input.inputId}".`,
      );
    }

    seenInputIds.add(input.inputId);

    if (input.type === "tagList") {
      const tagValidation = validateTagListMetadata(input, index);

      if (!tagValidation.isValid) {
        return tagValidation;
      }

      continue;
    }

    if (input.type === "priceRangeArray") {
      const priceValidation = validatePriceRangeArrayMetadata(input, index);

      if (!priceValidation.isValid) {
        return priceValidation;
      }

      continue;
    }

    return invalid(
      `customOptionInputs[${index}].type must be "tagList" or "priceRangeArray".`,
    );
  }

  return valid();
}

export function validatePresenceGetPayload(payload) {
  if (!isPlainObject(payload)) {
    return invalid("Presence get payload must be an object.");
  }

  if (!hasExactKeys(payload, PRESENCE_GET_PAYLOAD_FIELDS)) {
    return invalid("Invalid presence get payload fields.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  return validatePresenceSchemaMetadata(payload.schemaMetadata, payload.projectId);
}