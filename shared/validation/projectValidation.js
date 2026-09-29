// shared/validation/projectValidation.js

import {
  TEXT_LIMITS,
  NOTES_LIMITS,
  WEBSITE_LIMITS,
  PHONE_NUMBER_LIMITS,
  EMAIL_LIMITS,
  NUMBER_LIMITS,
  PERCENTAGE_LIMITS,
  DROPDOWN_LIMITS,
  CAPACITY_LIMITS,
  AGE_RANGE_LIMITS,
  PRICE_RANGE_ARRAY_LIMITS,
  TAG_LIST_LIMITS,
  GEOMETRY_LIMITS,
  TIME_LIMITS,
  SECTION_LIMITS,
  PROJECT_LIMITS,
  EXTENSION_LIMITS,
  SYSTEM_KEY_LIMITS,
  INPUT_KEY_LIMITS,
} from "./validationConstants.js";

import {
  ENGINE_KEYS,
  VISIBILITY_OPTIONS,
  PROJECT_ROLE_FIELDS,
  PROJECT_ROLE_PAYLOAD_FIELDS,
  PROJECT_VISIBILITY_PAYLOAD_FIELDS,
  PROJECT_UPDATE_PAYLOAD_FIELDS,
  PROJECT_SETTINGS_PAYLOAD_FIELDS,
  PROJECT_CREATE_PAYLOAD_FIELDS,
  PROJECT_FAVOURITE_PAYLOAD_FIELDS,
  EXTENSION_KEYS,
  EXTENSION_FIELDS,
  INPUT_TYPES,
  MOTION_INPUT_TYPES,
  INPUT_FIELDS_BY_TYPE,
  GEOMETRY_FIELDS,
  TIME_FIELDS,
  STANDARD_SECTION_FIELDS,
  STANDARD_SECTION_FIELD_TYPES,
  CONDITIONAL_SECTION_FIELDS,
  CONDITIONAL_SECTION_FIELD_TYPES,
  CONDITIONAL_SECTION_TYPES,
  CHECKBOX_GATE_CONFIG_FIELDS,
} from "./schemaConstants.js";

import { normalizeTag, exceedsMaxLength } from "./formValueHelpers.js";
import { validateUserName } from "../auth/auth.js";

const DISPLAY_TEXT_MAX_LENGTH = 40;
const CHECKBOX_TRUE_DISPLAY_OPTIONS = [
  "labelOnly",
  "labelMessage",
  "messageOnly",
  "none",
];
const CHECKBOX_FALSE_DISPLAY_OPTIONS = ["none", "labelMessage", "messageOnly"];
const CHECKBOX_MESSAGE_DISPLAY_OPTIONS = ["labelMessage", "messageOnly"];

/* ─────────────────────────────────────────────
   Public API
───────────────────────────────────────────── */

export function validateProjectSchema(project, options = {}) {
  const { existingProject = null } = options;
  const errors = [];

  if (!isPlainObject(project)) {
    return resultWithErrors(["Project schema must be an object."]);
  }

  validateTopLevelProject(project, errors);
  validateGeometry(project.geometry, errors);
  validateTime(project.time, errors);
  validateSections(project.sections, errors, project);
  validateExtensions(project.extensions, errors);
  validatePreviewText(project.previewText, project.sections, errors);

  if (existingProject) {
    validateProjectUpdateCompatibility(existingProject, project, errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/* ─────────────────────────────────────────────
   Top Level
───────────────────────────────────────────── */

function validateTopLevelProject(project, errors) {
  const expectedFields = PROJECT_UPDATE_PAYLOAD_FIELDS;

  if (!hasExactKeys(project, expectedFields)) {
    const expected = new Set(expectedFields);

    for (const key of Object.keys(project)) {
      if (!expected.has(key)) {
        errors.push(
          `Top-level field "${key}" is not allowed in project update payload.`,
        );
      }
    }

    for (const key of expectedFields) {
      if (project[key] === undefined || project[key] === null) {
        errors.push(`"${key}" is required in project update payload.`);
      }
    }
  }

  if (!isObjectIdLike(project._id)) {
    errors.push(`"_id" must be an object id.`);
  }

  if (!isDateLike(project.configUpdatedAt)) {
    errors.push(`"configUpdatedAt" must be a valid date.`);
  }

  if (!isNonEmptyString(project.engineKey)) {
    errors.push(`"engineKey" must be a non-empty string.`);
  } else if (!ENGINE_KEYS.includes(project.engineKey)) {
    errors.push(`"engineKey" must be one of: ${ENGINE_KEYS.join(", ")}.`);
  }

  if (typeof project.projectName !== "string") {
    errors.push(`"projectName" must be a string.`);
  } else if (
    project.projectName.trim().length === 0 ||
    project.projectName.length > PROJECT_LIMITS.projectNameMaxLength
  ) {
    errors.push(
      `"projectName" must be between 1 and ${PROJECT_LIMITS.projectNameMaxLength} characters.`,
    );
  }

  if (typeof project.projectDescription !== "string") {
    errors.push(`"projectDescription" must be a string.`);
  } else if (
    project.projectDescription.length >
    PROJECT_LIMITS.projectDescriptionMaxLength
  ) {
    errors.push(
      `"projectDescription" must be at most ${PROJECT_LIMITS.projectDescriptionMaxLength} characters.`,
    );
  }

  validateProjectTags(project.projectTags, errors);

  if (!Array.isArray(project.sections)) {
    errors.push(`"sections" must be an array.`);
  } else if (project.sections.length > PROJECT_LIMITS.maxSections) {
    errors.push(
      `"sections" cannot exceed ${PROJECT_LIMITS.maxSections} sections.`,
    );
  }

  if (!isPlainObject(project.extensions)) {
    errors.push(`"extensions" must be an object.`);
  }
}

/* ─────────────────────────────────────────────
   Project Tags
───────────────────────────────────────────── */

function validateProjectTags(projectTags, errors) {
  if (!Array.isArray(projectTags)) {
    errors.push(`"projectTags" must be an array.`);
    return;
  }

  if (projectTags.length > PROJECT_LIMITS.maxProjectTags) {
    errors.push(
      `"projectTags" cannot exceed ${PROJECT_LIMITS.maxProjectTags} tags.`,
    );
    return;
  }

  const seen = new Set();

  for (const tag of projectTags) {
    if (typeof tag !== "string") {
      errors.push(`Each value in "projectTags" must be a string.`);
      return;
    }

    const normalized = normalizeTag(tag);

    if (!normalized) {
      errors.push(`"projectTags" cannot contain an empty tag.`);
      return;
    }

    if (tag !== normalized) {
      errors.push(`"projectTags" values must be pre-normalized.`);
      return;
    }

    if (exceedsMaxLength(normalized, PROJECT_LIMITS.projectTagMaxLength)) {
      errors.push(
        `Each tag in "projectTags" must be at most ${PROJECT_LIMITS.projectTagMaxLength} characters.`,
      );
      return;
    }

    const lowered = normalized.toLowerCase();

    if (seen.has(lowered)) {
      errors.push(`"projectTags" cannot contain duplicate tag "${normalized}".`);
      return;
    }

    seen.add(lowered);
  }
}

/* ─────────────────────────────────────────────
   Project Settings (lightweight name/description/tags update)
───────────────────────────────────────────── */

export function validateProjectSettingsPayload(payload = {}) {
  if (!hasExactKeys(payload, PROJECT_SETTINGS_PAYLOAD_FIELDS)) {
    return false;
  }

  const { projectName, projectDescription, projectTags, configUpdatedAt } =
    payload;

  if (typeof projectName !== "string") return false;

  if (
    projectName.trim().length === 0 ||
    projectName.length > PROJECT_LIMITS.projectNameMaxLength
  ) {
    return false;
  }

  if (typeof projectDescription !== "string") return false;

  if (projectDescription.length > PROJECT_LIMITS.projectDescriptionMaxLength) {
    return false;
  }

  const tagErrors = [];
  validateProjectTags(projectTags, tagErrors);
  if (tagErrors.length > 0) return false;

  if (!isDateLike(configUpdatedAt)) return false;

  return true;
}

/* ─────────────────────────────────────────────
   Project Create (lightweight: engine + name/description/tags only,
   the rest of the schema is injected server-side from the engine's
   default schema)
───────────────────────────────────────────── */

export function validateProjectCreatePayload(payload = {}) {
  if (!hasExactKeys(payload, PROJECT_CREATE_PAYLOAD_FIELDS)) {
    return false;
  }

  const {
    engineKey,
    projectName,
    projectDescription,
    projectTags,
    visibility,
  } = payload;

  if (typeof engineKey !== "string" || !ENGINE_KEYS.includes(engineKey)) {
    return false;
  }

  if (typeof projectName !== "string") return false;

  if (
    projectName.trim().length === 0 ||
    projectName.length > PROJECT_LIMITS.projectNameMaxLength
  ) {
    return false;
  }

  if (typeof projectDescription !== "string") return false;

  if (projectDescription.length > PROJECT_LIMITS.projectDescriptionMaxLength) {
    return false;
  }

  const tagErrors = [];
  validateProjectTags(projectTags, tagErrors);
  if (tagErrors.length > 0) return false;

  if (typeof visibility !== "string" || !VISIBILITY_OPTIONS.includes(visibility)) {
    return false;
  }

  return true;
}

/* ─────────────────────────────────────────────
   Update Compatibility
───────────────────────────────────────────── */

function validateProjectUpdateCompatibility(
  previousProject,
  nextProject,
  errors,
) {
  if (!isPlainObject(previousProject) || !isPlainObject(nextProject)) {
    return;
  }

  if (previousProject.engineKey !== nextProject.engineKey) {
    errors.push(`"engineKey" cannot be changed.`);
  }

  if (previousProject?.time?.type !== nextProject?.time?.type) {
    errors.push(`"time.type" cannot be changed.`);
  }

  validateExistingInputSectionOwnership(
    previousProject.sections,
    nextProject.sections,
    errors,
  );

  validateSystemSectionInputOrder(
    previousProject.sections,
    nextProject.sections,
    errors,
  );

  validateExistingSectionCompatibility(
    previousProject.sections,
    nextProject.sections,
    errors,
  );

  validateExistingInputCompatibility(
    previousProject.sections,
    nextProject.sections,
    errors,
  );
}

function validateExistingInputSectionOwnership(
  previousSections,
  nextSections,
  errors,
) {
  if (!Array.isArray(previousSections) || !Array.isArray(nextSections)) return;

  const previousInputSectionById = new Map();
  const nextInputSectionById = new Map();

  for (const previousSection of previousSections) {
    const previousSectionId = previousSection?.id;
    const previousInputs = Array.isArray(previousSection?.inputs)
      ? previousSection.inputs
      : [];

    for (const input of previousInputs) {
      if (!isFiniteNumber(input?.id)) continue;
      previousInputSectionById.set(input.id, previousSectionId);
    }
  }

  for (const nextSection of nextSections) {
    const nextSectionId = nextSection?.id;
    const nextInputs = Array.isArray(nextSection?.inputs)
      ? nextSection.inputs
      : [];

    for (const input of nextInputs) {
      if (!isFiniteNumber(input?.id)) continue;
      nextInputSectionById.set(input.id, nextSectionId);
    }
  }

  for (const [
    inputId,
    previousSectionId,
  ] of previousInputSectionById.entries()) {
    if (!nextInputSectionById.has(inputId)) continue;

    const nextSectionId = nextInputSectionById.get(inputId);

    if (previousSectionId !== nextSectionId) {
      errors.push(
        `"inputs[id=${inputId}]" cannot be moved from section id "${previousSectionId}" to section id "${nextSectionId}".`,
      );
    }
  }
}

function validateSystemSectionInputOrder(
  previousSections,
  nextSections,
  errors,
) {
  if (!Array.isArray(previousSections) || !Array.isArray(nextSections)) return;

  const nextSectionById = mapById(nextSections);

  for (const previousSection of previousSections) {
    const nextSection = nextSectionById.get(previousSection?.id);
    if (!nextSection) continue;

    const previousSystemKey = normalizeOptionalString(
      previousSection.systemKey,
    );
    const nextSystemKey = normalizeOptionalString(nextSection.systemKey);

    if (!previousSystemKey || previousSystemKey !== nextSystemKey) continue;

    const previousInputs = Array.isArray(previousSection.inputs)
      ? previousSection.inputs
      : [];

    const nextInputs = Array.isArray(nextSection.inputs)
      ? nextSection.inputs
      : [];

    const previousInputIds = previousInputs.map((input) => input?.id);
    const previousInputIdSet = new Set(previousInputIds);

    const nextExistingInputIds = nextInputs
      .map((input) => input?.id)
      .filter((id) => previousInputIdSet.has(id));

    const previousSurvivingInputIds = previousInputIds.filter((id) =>
      nextExistingInputIds.includes(id),
    );

    if (!arraysEqual(previousSurvivingInputIds, nextExistingInputIds)) {
      errors.push(
        `"sections[id=${previousSection.id}].inputs" cannot reorder existing inputs because this is a system section.`,
      );
    }
  }
}

function validateExistingSectionCompatibility(
  previousSections,
  nextSections,
  errors,
) {
  if (!Array.isArray(previousSections) || !Array.isArray(nextSections)) return;

  const nextSectionById = mapById(nextSections);

  for (const previousSection of previousSections) {
    const nextSection = nextSectionById.get(previousSection?.id);
    if (!nextSection) continue;

    const previousConditional = normalizeOptionalString(
      previousSection.conditionalSection,
    );
    const nextConditional = normalizeOptionalString(
      nextSection.conditionalSection,
    );

    if (previousConditional !== nextConditional) {
      errors.push(
        `"sections[id=${previousSection.id}].conditionalSection" cannot be changed.`,
      );
    }

    const previousSystemKey = normalizeOptionalString(
      previousSection.systemKey,
    );
    const nextSystemKey = normalizeOptionalString(nextSection.systemKey);

    if (previousSystemKey !== nextSystemKey) {
      errors.push(
        `"sections[id=${previousSection.id}].systemKey" cannot be changed.`,
      );
    }
  }
}

function validateExistingInputCompatibility(
  previousSections,
  nextSections,
  errors,
) {
  if (!Array.isArray(previousSections) || !Array.isArray(nextSections)) return;

  const nextSectionById = mapById(nextSections);

  for (const previousSection of previousSections) {
    const nextSection = nextSectionById.get(previousSection?.id);
    if (!nextSection) continue;

    const previousInputs = Array.isArray(previousSection.inputs)
      ? previousSection.inputs
      : [];

    const nextInputs = Array.isArray(nextSection.inputs)
      ? nextSection.inputs
      : [];

    const nextInputById = mapById(nextInputs);

    for (const previousInput of previousInputs) {
      const nextInput = nextInputById.get(previousInput?.id);
      if (!nextInput) continue;

      if (previousInput.type !== nextInput.type) {
        errors.push(
          `"sections[id=${previousSection.id}].inputs[id=${previousInput.id}].type" cannot be changed.`,
        );
      }

      const previousInputKey = normalizeOptionalString(previousInput.inputKey);
      const nextInputKey = normalizeOptionalString(nextInput.inputKey);

      if (previousInputKey !== nextInputKey) {
        errors.push(
          `"sections[id=${previousSection.id}].inputs[id=${previousInput.id}].inputKey" cannot be changed.`,
        );
      }

      const previousSecondaryFor = normalizeOptionalString(
        previousInput.secondaryFor,
      );
      const nextSecondaryFor = normalizeOptionalString(nextInput.secondaryFor);

      if (previousSecondaryFor !== nextSecondaryFor) {
        errors.push(
          `"sections[id=${previousSection.id}].inputs[id=${previousInput.id}].secondaryFor" cannot be changed.`,
        );
      }
    }
  }
}

function validateSystemKey(systemKey, path, errors) {
  if (systemKey === undefined) return;

  if (typeof systemKey !== "string") {
    errors.push(`"${path}" must be a string when provided.`);
    return;
  }

  if (systemKey.trim() === "") {
    errors.push(`"${path}" cannot be empty when provided.`);
    return;
  }

  if (systemKey.length > SYSTEM_KEY_LIMITS.maxLength) {
    errors.push(
      `"${path}" must be at most ${SYSTEM_KEY_LIMITS.maxLength} characters.`,
    );
    return;
  }

  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(systemKey)) {
    errors.push(
      `"${path}" may only contain letters, numbers, underscores, or hyphens, and must start with a letter.`,
    );
  }
}

function validateInputKey(value, path, errors, { allowNull = false } = {}) {
  if (value === undefined) return;
  if (allowNull && value === null) return;

  if (typeof value !== "string") {
    errors.push(`"${path}" must be a string${allowNull ? " or null" : ""}.`);
    return;
  }

  if (value.trim() === "") {
    errors.push(`"${path}" cannot be empty when provided.`);
    return;
  }

  if (value.length > INPUT_KEY_LIMITS.maxLength) {
    errors.push(
      `"${path}" must be at most ${INPUT_KEY_LIMITS.maxLength} characters.`,
    );
    return;
  }

  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) {
    errors.push(
      `"${path}" may only contain letters, numbers, underscores, or hyphens, and must start with a letter.`,
    );
  }
}

/* ─────────────────────────────────────────────
   Geometry
───────────────────────────────────────────── */

function validateGeometry(geometry, errors) {
  if (!isPlainObject(geometry)) {
    errors.push(`"geometry" must be an object.`);
    return;
  }

  for (const key of Object.keys(geometry)) {
    if (!GEOMETRY_FIELDS.includes(key)) {
      errors.push(`"geometry.${key}" is not an allowed field.`);
    }
  }

  if (typeof geometry.label !== "string") {
    errors.push(`"geometry.label" must be a string.`);
  }

  if (!Array.isArray(geometry.types)) {
    errors.push(`"geometry.types" must be an array.`);
  } else {
    if (geometry.types.length === 0) {
      errors.push(`"geometry.types" must contain at least one geometry type.`);
    }

    if (geometry.types.length > GEOMETRY_LIMITS.typeOptions.length) {
      errors.push(
        `"geometry.types" cannot contain more than ${GEOMETRY_LIMITS.typeOptions.length} geometry types.`,
      );
    }

    const seenTypes = new Set();

    for (const geometryType of geometry.types) {
      if (typeof geometryType !== "string") {
        errors.push(`Each value in "geometry.types" must be a string.`);
        continue;
      }

      if (!GEOMETRY_LIMITS.typeOptions.includes(geometryType)) {
        errors.push(
          `"geometry.types" values must be one of: ${GEOMETRY_LIMITS.typeOptions.join(", ")}.`,
        );
        continue;
      }

      if (seenTypes.has(geometryType)) {
        errors.push(
          `"geometry.types" cannot contain duplicate value "${geometryType}".`,
        );
        continue;
      }

      seenTypes.add(geometryType);
    }
  }

  if (typeof geometry.isFilter !== "boolean") {
    errors.push(`"geometry.isFilter" must be a boolean.`);
  }

  if (typeof geometry.isDisplayed !== "boolean") {
    errors.push(`"geometry.isDisplayed" must be a boolean.`);
  }
}

/* ─────────────────────────────────────────────
   Time
───────────────────────────────────────────── */

function validateTime(time, errors) {
  if (!isPlainObject(time)) {
    errors.push(`"time" must be an object.`);
    return;
  }

  for (const key of Object.keys(time)) {
    if (!TIME_FIELDS.includes(key)) {
      errors.push(`"time.${key}" is not an allowed field.`);
    }
  }

  if (typeof time.label !== "string") {
    errors.push(`"time.label" must be a string.`);
  }

  if (typeof time.type !== "string") {
    errors.push(`"time.type" must be a string.`);
  } else if (!TIME_LIMITS.typeOptions.includes(time.type)) {
    errors.push(
      `"time.type" must be one of: ${TIME_LIMITS.typeOptions.join(", ")}.`,
    );
  }

  if (typeof time.isFilter !== "boolean") {
    errors.push(`"time.isFilter" must be a boolean.`);
  }

  if (typeof time.isDisplayed !== "boolean") {
    errors.push(`"time.isDisplayed" must be a boolean.`);
  }

  if (time.defaultDurationMinutes !== undefined) {
    if (!isFiniteNumber(time.defaultDurationMinutes)) {
      errors.push(`"time.defaultDurationMinutes" must be a number.`);
    } else if (
      time.defaultDurationMinutes < TIME_LIMITS.defaultDurationMinutes.min ||
      time.defaultDurationMinutes > TIME_LIMITS.defaultDurationMinutes.max
    ) {
      errors.push(
        `"time.defaultDurationMinutes" must be between ${TIME_LIMITS.defaultDurationMinutes.min} and ${TIME_LIMITS.defaultDurationMinutes.max}.`,
      );
    } else if (
      time.defaultDurationMinutes % TIME_LIMITS.defaultDurationMinutes.step !==
      0
    ) {
      errors.push(
        `"time.defaultDurationMinutes" must be in steps of ${TIME_LIMITS.defaultDurationMinutes.step}.`,
      );
    }
  }

  if (time.modes !== undefined) {
    if (!Array.isArray(time.modes)) {
      errors.push(`"time.modes" must be an array.`);
    } else {
      if (time.type === "Event") {
        validateNonEmptyOptionsArray(time.modes, "time.modes", errors);
      }

      validateUniqueStringArray(time.modes, "time.modes", errors);

      for (const mode of time.modes) {
        if (!TIME_LIMITS.eventModeOptions.includes(mode)) {
          errors.push(
            `"time.modes" contains invalid value "${mode}". Allowed values: ${TIME_LIMITS.eventModeOptions.join(", ")}.`,
          );
        }
      }
    }
  }
}

/* ─────────────────────────────────────────────
   Sections
───────────────────────────────────────────── */

function validateSections(sections, errors, project) {
  if (!Array.isArray(sections)) return;

  validateUniqueSectionIds(sections, errors);
  validateUniqueInputIds(sections, errors);

  sections.forEach((section, sectionIndex) => {
    const sectionPath = `sections[${sectionIndex}]`;

    if (!isPlainObject(section)) {
      errors.push(`"${sectionPath}" must be an object.`);
      return;
    }

    const isConditionalSection = section.conditionalSection !== undefined;
    const allowedSectionFields = isConditionalSection
      ? CONDITIONAL_SECTION_FIELDS
      : STANDARD_SECTION_FIELDS;

    for (const key of Object.keys(section)) {
      if (!allowedSectionFields.includes(key)) {
        errors.push(`"${sectionPath}.${key}" is not an allowed field.`);
      }
    }

    if (!isFiniteNumber(section.id)) {
      errors.push(`"${sectionPath}.id" must be a number.`);
    }

    if (!isNonEmptyString(section.name)) {
      errors.push(`"${sectionPath}.name" must be a non-empty string.`);
    }

    validateSystemKey(section.systemKey, `${sectionPath}.systemKey`, errors);

    if (section.conditionalSection !== undefined) {
      if (typeof section.conditionalSection !== "string") {
        errors.push(
          `"${sectionPath}.conditionalSection" must be a string when provided.`,
        );
      } else if (
        !CONDITIONAL_SECTION_TYPES.includes(section.conditionalSection)
      ) {
        errors.push(
          `"${sectionPath}.conditionalSection" must be one of: ${CONDITIONAL_SECTION_TYPES.join(", ")}.`,
        );
      }
    }

    if (section.checkboxGateConfig !== undefined) {
      if (section.conditionalSection !== "checkboxGate") {
        errors.push(
          `"${sectionPath}.checkboxGateConfig" is only allowed when conditionalSection is "checkboxGate".`,
        );
      } else {
        validateCheckboxGateConfig(section, sectionIndex, errors);
      }
    }

    if (
      section.conditionalSection === "checkboxGate" &&
      section.checkboxGateConfig === undefined
    ) {
      errors.push(
        `"${sectionPath}.checkboxGateConfig" is required when conditionalSection is "checkboxGate".`,
      );
    }

    if (!Array.isArray(section.inputs)) {
      errors.push(`"${sectionPath}.inputs" must be an array.`);
      return;
    }

    if (section.inputs.length > SECTION_LIMITS.maxInputs) {
      errors.push(
        `"${sectionPath}.inputs" cannot exceed ${SECTION_LIMITS.maxInputs} inputs.`,
      );
    }

    section.inputs.forEach((input, inputIndex) => {
      const isCheckboxGateSection =
        section.conditionalSection === "checkboxGate";
      validateInput(input, sectionIndex, inputIndex, errors, project, {
        isCheckboxGateSection,
      });
    });

    if (section.conditionalSection === "checkboxGate") {
      validateCheckboxGateRelationships(section, sectionIndex, errors);
    }
  });
}

function validateUniqueSectionIds(sections, errors) {
  const seen = new Set();

  sections.forEach((section, sectionIndex) => {
    const id = section?.id;

    if (!isFiniteNumber(id)) return;

    if (seen.has(id)) {
      errors.push(
        `"sections[${sectionIndex}].id" duplicates section id "${id}".`,
      );
      return;
    }

    seen.add(id);
  });
}

function validateUniqueInputIds(sections, errors) {
  const seen = new Set();

  sections.forEach((section, sectionIndex) => {
    const inputs = Array.isArray(section?.inputs) ? section.inputs : [];

    inputs.forEach((input, inputIndex) => {
      const id = input?.id;

      if (!isFiniteNumber(id)) return;

      if (seen.has(id)) {
        errors.push(
          `"sections[${sectionIndex}].inputs[${inputIndex}].id" duplicates input id "${id}".`,
        );
        return;
      }

      seen.add(id);
    });
  });
}

/* ─────────────────────────────────────────────
   Inputs
───────────────────────────────────────────── */

function getAllowedInputTypesForProject(project) {
  if (project?.engineKey === "motion") {
    return MOTION_INPUT_TYPES;
  }

  return INPUT_TYPES;
}

function validateInput(
  input,
  sectionIndex,
  inputIndex,
  errors,
  project,
  options = {},
) {
  const { isCheckboxGateSection = false } = options;
  const inputPath = `sections[${sectionIndex}].inputs[${inputIndex}]`;

  if (!isPlainObject(input)) {
    errors.push(`"${inputPath}" must be an object.`);
    return;
  }

  if (!isNonEmptyString(input.type)) {
    errors.push(`"${inputPath}.type" must be a non-empty string.`);
    return;
  }

 const allowedInputTypes = getAllowedInputTypesForProject(project);

if (!allowedInputTypes.includes(input.type)) {
  errors.push(
    `"${inputPath}.type" must be one of: ${allowedInputTypes.join(", ")} for ${project?.engineKey || "this"} projects.`,
  );
  return;
}

  const allowedFields = INPUT_FIELDS_BY_TYPE[input.type] || [];

  for (const key of Object.keys(input)) {
    if (!allowedFields.includes(key)) {
      errors.push(
        `"${inputPath}.${key}" is not an allowed field for input type "${input.type}".`,
      );
    }
  }

  if (!isFiniteNumber(input.id)) {
    errors.push(`"${inputPath}.id" must be a number.`);
  }

  if (!isNonEmptyString(input.label)) {
    errors.push(`"${inputPath}.label" must be a non-empty string.`);
  }

  if (!isCheckboxGateSection) {
    if (input.inputKey !== undefined) {
      errors.push(
        `"${inputPath}.inputKey" is only allowed in checkboxGate sections.`,
      );
    }

    if (input.secondaryFor !== undefined && input.secondaryFor !== null) {
      errors.push(
        `"${inputPath}.secondaryFor" is only allowed in checkboxGate sections.`,
      );
    }
  } else {
    validateInputKey(input.inputKey, `${inputPath}.inputKey`, errors);
    validateInputKey(input.secondaryFor, `${inputPath}.secondaryFor`, errors, {
      allowNull: true,
    });
  }

  switch (input.type) {
    case "text":
      validateStandardTextLikeInput(
        input,
        inputPath,
        errors,
        TEXT_LIMITS.maxLength.min,
        TEXT_LIMITS.maxLength.max,
      );
      break;

    case "website":
      validateStandardTextLikeInput(
        input,
        inputPath,
        errors,
        WEBSITE_LIMITS.maxLength.min,
        WEBSITE_LIMITS.maxLength.max,
        { requireIsFilter: false },
      );
      break;

    case "phoneNumber":
      validateStandardTextLikeInput(
        input,
        inputPath,
        errors,
        PHONE_NUMBER_LIMITS.maxLength.min,
        PHONE_NUMBER_LIMITS.maxLength.max,
        { requireIsFilter: false },
      );
      break;

    case "email":
      validateStandardTextLikeInput(
        input,
        inputPath,
        errors,
        EMAIL_LIMITS.maxLength.min,
        EMAIL_LIMITS.maxLength.max,
        { requireIsFilter: false },
      );
      break;

    case "notes":
      validateStandardTextLikeInput(
        input,
        inputPath,
        errors,
        NOTES_LIMITS.maxLength.min,
        NOTES_LIMITS.maxLength.max,
        { requireIsFilter: false },
      );
      break;

    case "number":
      validateRangedNumericInput(input, inputPath, errors, NUMBER_LIMITS);
      break;

    case "percentage":
      validateRangedNumericInput(input, inputPath, errors, PERCENTAGE_LIMITS);
      break;

    case "capacity":
      validateRangedNumericInput(input, inputPath, errors, CAPACITY_LIMITS);
      break;

    case "ageRange":
      validateAgeRangeInput(input, inputPath, errors);
      break;

    case "dropdown":
      validateDropdownInput(input, inputPath, errors);
      break;

    case "checkbox":
      validateCheckboxInput(input, inputPath, errors);
      break;

    case "hours":
      validateHoursInput(input, inputPath, errors);
      break;

    case "priceRangeArray":
      validatePriceRangeArrayInput(input, inputPath, errors, project);
      break;

    case "tagList":
      validateTagListInput(input, inputPath, errors, project);
      break;

    default:
      errors.push(`"${inputPath}.type" is not supported.`);
  }
}

function validateCheckboxGateConfig(section, sectionIndex, errors) {
  const sectionPath = `sections[${sectionIndex}]`;
  const config = section.checkboxGateConfig;

  if (!isPlainObject(config)) {
    errors.push(`"${sectionPath}.checkboxGateConfig" must be an object.`);
    return;
  }

  for (const key of Object.keys(config)) {
    if (!CHECKBOX_GATE_CONFIG_FIELDS.includes(key)) {
      errors.push(
        `"${sectionPath}.checkboxGateConfig.${key}" is not an allowed field.`,
      );
    }
  }

  if (!Array.isArray(config.primaryInputKeys)) {
    errors.push(
      `"${sectionPath}.checkboxGateConfig.primaryInputKeys" must be an array.`,
    );
  } else {
    config.primaryInputKeys.forEach((value, index) => {
      if (!isNonEmptyString(value)) {
        errors.push(
          `"${sectionPath}.checkboxGateConfig.primaryInputKeys[${index}]" must be a non-empty string.`,
        );
      }
    });

    validateUniqueStringArray(
      config.primaryInputKeys,
      `${sectionPath}.checkboxGateConfig.primaryInputKeys`,
      errors,
    );
  }

  if (!isPlainObject(config.secondaryInputMap)) {
    errors.push(
      `"${sectionPath}.checkboxGateConfig.secondaryInputMap" must be an object.`,
    );
    return;
  }

  for (const [primaryKey, secondaryKeys] of Object.entries(
    config.secondaryInputMap,
  )) {
    if (!isNonEmptyString(primaryKey)) {
      errors.push(
        `"${sectionPath}.checkboxGateConfig.secondaryInputMap" contains an invalid primary key.`,
      );
      continue;
    }

    if (!Array.isArray(secondaryKeys)) {
      errors.push(
        `"${sectionPath}.checkboxGateConfig.secondaryInputMap.${primaryKey}" must be an array.`,
      );
      continue;
    }

    secondaryKeys.forEach((value, index) => {
      if (!isNonEmptyString(value)) {
        errors.push(
          `"${sectionPath}.checkboxGateConfig.secondaryInputMap.${primaryKey}[${index}]" must be a non-empty string.`,
        );
      }
    });

    validateUniqueStringArray(
      secondaryKeys,
      `${sectionPath}.checkboxGateConfig.secondaryInputMap.${primaryKey}`,
      errors,
    );
  }
}

function validateCheckboxGateRelationships(section, sectionIndex, errors) {
  const sectionPath = `sections[${sectionIndex}]`;
  const config = section.checkboxGateConfig;

  if (!isPlainObject(config)) return;
  if (!Array.isArray(section.inputs)) return;

  const primaryInputKeys = Array.isArray(config.primaryInputKeys)
    ? config.primaryInputKeys
    : [];

  const secondaryInputMap = isPlainObject(config.secondaryInputMap)
    ? config.secondaryInputMap
    : {};

  const inputsByKey = new Map();

  section.inputs.forEach((input, inputIndex) => {
    const inputPath = `sections[${sectionIndex}].inputs[${inputIndex}]`;

    if (!isNonEmptyString(input?.inputKey)) {
      errors.push(
        `"${inputPath}.inputKey" is required for checkboxGate sections.`,
      );
      return;
    }

    if (inputsByKey.has(input.inputKey)) {
      errors.push(
        `"${inputPath}.inputKey" duplicates another inputKey in the same section.`,
      );
      return;
    }

    inputsByKey.set(input.inputKey, { input, inputIndex });
  });

  for (const primaryKey of primaryInputKeys) {
    const primaryEntry = inputsByKey.get(primaryKey);

    if (!primaryEntry) {
      errors.push(
        `"${sectionPath}.checkboxGateConfig.primaryInputKeys" references missing inputKey "${primaryKey}".`,
      );
      continue;
    }

    if (primaryEntry.input.type !== "checkbox") {
      errors.push(
        `"${sectionPath}.checkboxGateConfig.primaryInputKeys" must reference checkbox inputs. "${primaryKey}" is "${primaryEntry.input.type}".`,
      );
    }

    if (
      primaryEntry.input.secondaryFor !== null &&
      primaryEntry.input.secondaryFor !== undefined
    ) {
      errors.push(
        `"sections[${sectionIndex}].inputs[${primaryEntry.inputIndex}].secondaryFor" must be null or undefined for primary checkbox inputs.`,
      );
    }
  }

  for (const [primaryKey, secondaryKeys] of Object.entries(secondaryInputMap)) {
    const primaryEntry = inputsByKey.get(primaryKey);

    if (!primaryEntry) {
      errors.push(
        `"${sectionPath}.checkboxGateConfig.secondaryInputMap.${primaryKey}" references a missing primary inputKey.`,
      );
      continue;
    }

    if (primaryEntry.input.type !== "checkbox") {
      errors.push(
        `"${sectionPath}.checkboxGateConfig.secondaryInputMap.${primaryKey}" must reference a checkbox primary input.`,
      );
    }

    if (
      primaryEntry.input.secondaryFor !== null &&
      primaryEntry.input.secondaryFor !== undefined
    ) {
      errors.push(
        `"sections[${sectionIndex}].inputs[${primaryEntry.inputIndex}].secondaryFor" must be null or undefined for primary checkbox inputs.`,
      );
    }

    if (!primaryInputKeys.includes(primaryKey)) {
      errors.push(
        `"${sectionPath}.checkboxGateConfig.secondaryInputMap.${primaryKey}" must also appear in primaryInputKeys.`,
      );
    }

    if (!Array.isArray(secondaryKeys)) continue;

    secondaryKeys.forEach((secondaryKey, secondaryIndex) => {
      const secondaryEntry = inputsByKey.get(secondaryKey);

      if (!secondaryEntry) {
        errors.push(
          `"${sectionPath}.checkboxGateConfig.secondaryInputMap.${primaryKey}[${secondaryIndex}]" references missing inputKey "${secondaryKey}".`,
        );
        return;
      }

      if (secondaryEntry.input.secondaryFor !== primaryKey) {
        errors.push(
          `"sections[${sectionIndex}].inputs[${secondaryEntry.inputIndex}].secondaryFor" must equal "${primaryKey}".`,
        );
      }
    });
  }

  section.inputs.forEach((input, inputIndex) => {
    const inputPath = `sections[${sectionIndex}].inputs[${inputIndex}]`;

    if (input.secondaryFor == null) return;
    if (!isNonEmptyString(input.secondaryFor)) return;

    const parentEntry = inputsByKey.get(input.secondaryFor);

    if (!parentEntry) {
      errors.push(
        `"${inputPath}.secondaryFor" references missing primary inputKey "${input.secondaryFor}".`,
      );
      return;
    }

    if (parentEntry.input.type !== "checkbox") {
      errors.push(
        `"${inputPath}.secondaryFor" must reference a checkbox inputKey.`,
      );
    }

    const listedSecondaries = Array.isArray(
      secondaryInputMap[input.secondaryFor],
    )
      ? secondaryInputMap[input.secondaryFor]
      : [];

    if (!listedSecondaries.includes(input.inputKey)) {
      errors.push(
        `"${inputPath}.inputKey" must be listed in checkboxGateConfig.secondaryInputMap.${input.secondaryFor}.`,
      );
    }
  });
}

function validateStandardTextLikeInput(
  input,
  inputPath,
  errors,
  minLength,
  maxLength,
  options = {},
) {
  const { requireIsFilter = true } = options;

  validateCommonDisplayInput(input, inputPath, errors, { requireIsFilter });

  if (!isFiniteNumber(input.maxLength)) {
    errors.push(`"${inputPath}.maxLength" must be a number.`);
  } else if (input.maxLength < minLength || input.maxLength > maxLength) {
    errors.push(
      `"${inputPath}.maxLength" must be between ${minLength} and ${maxLength}.`,
    );
  }
}

function validateRangedNumericInput(input, inputPath, errors, limits) {
  validateCommonDisplayInput(input, inputPath, errors);

  if (!isFiniteNumber(input.maxLength)) {
    errors.push(`"${inputPath}.maxLength" must be a number.`);
  } else if (
    input.maxLength < limits.maxLength.min ||
    input.maxLength > limits.maxLength.max
  ) {
    errors.push(
      `"${inputPath}.maxLength" must be between ${limits.maxLength.min} and ${limits.maxLength.max}.`,
    );
  }

  if (input.minValue !== null && input.minValue !== undefined) {
    if (!isFiniteNumber(input.minValue)) {
      errors.push(`"${inputPath}.minValue" must be a number or null.`);
    } else if (
      input.minValue < limits.minValue ||
      input.minValue > limits.maxValue
    ) {
      errors.push(
        `"${inputPath}.minValue" must be between ${limits.minValue} and ${limits.maxValue}.`,
      );
    }
  }

  if (input.maxValue !== null && input.maxValue !== undefined) {
    if (!isFiniteNumber(input.maxValue)) {
      errors.push(`"${inputPath}.maxValue" must be a number or null.`);
    } else if (
      input.maxValue < limits.minValue ||
      input.maxValue > limits.maxValue
    ) {
      errors.push(
        `"${inputPath}.maxValue" must be between ${limits.minValue} and ${limits.maxValue}.`,
      );
    }
  }

  if (
    isFiniteNumber(input.minValue) &&
    isFiniteNumber(input.maxValue) &&
    input.minValue > input.maxValue
  ) {
    errors.push(`"${inputPath}.minValue" cannot be greater than maxValue.`);
  }

  if (!Array.isArray(input.modeOptions)) {
    errors.push(`"${inputPath}.modeOptions" must be an array.`);
  } else {
    validateNonEmptyOptionsArray(
      input.modeOptions,
      `${inputPath}.modeOptions`,
      errors,
    );
    validateStringOptionsArray(
      input.modeOptions,
      limits.modeOptions,
      `${inputPath}.modeOptions`,
      errors,
    );
    validateUniqueStringArray(
      input.modeOptions,
      `${inputPath}.modeOptions`,
      errors,
    );
  }

  validateNumericMaxLengthCanRepresentBounds({
    input,
    inputPath,
    errors,
  });
}

function validateAgeRangeInput(input, inputPath, errors) {
  validateCommonDisplayInput(input, inputPath, errors);

  if (!isFiniteNumber(input.maxLength)) {
    errors.push(`"${inputPath}.maxLength" must be a number.`);
  } else if (
    input.maxLength < AGE_RANGE_LIMITS.maxLength.min ||
    input.maxLength > AGE_RANGE_LIMITS.maxLength.max
  ) {
    errors.push(
      `"${inputPath}.maxLength" must be between ${AGE_RANGE_LIMITS.maxLength.min} and ${AGE_RANGE_LIMITS.maxLength.max}.`,
    );
  }

  if (!isFiniteNumber(input.minValue)) {
    errors.push(`"${inputPath}.minValue" must be a number.`);
  } else if (
    input.minValue < AGE_RANGE_LIMITS.minValue ||
    input.minValue > AGE_RANGE_LIMITS.maxValue
  ) {
    errors.push(
      `"${inputPath}.minValue" must be between ${AGE_RANGE_LIMITS.minValue} and ${AGE_RANGE_LIMITS.maxValue}.`,
    );
  }

  if (!isFiniteNumber(input.maxValue)) {
    errors.push(`"${inputPath}.maxValue" must be a number.`);
  } else if (
    input.maxValue < AGE_RANGE_LIMITS.minValue ||
    input.maxValue > AGE_RANGE_LIMITS.maxValue
  ) {
    errors.push(
      `"${inputPath}.maxValue" must be between ${AGE_RANGE_LIMITS.minValue} and ${AGE_RANGE_LIMITS.maxValue}.`,
    );
  }

  if (isFiniteNumber(input.minValue) && isFiniteNumber(input.maxValue)) {
    if (input.minValue > input.maxValue) {
      errors.push(`"${inputPath}.minValue" cannot be greater than maxValue.`);
    }
  }

  validateNumericMaxLengthCanRepresentBounds({
    input,
    inputPath,
    errors,
  });

  if (!Array.isArray(input.ageModeOptions)) {
    errors.push(`"${inputPath}.ageModeOptions" must be an array.`);
  } else {
    validateNonEmptyOptionsArray(
      input.ageModeOptions,
      `${inputPath}.ageModeOptions`,
      errors,
    );
    validateStringOptionsArray(
      input.ageModeOptions,
      AGE_RANGE_LIMITS.modeOptions,
      `${inputPath}.ageModeOptions`,
      errors,
    );
    validateUniqueStringArray(
      input.ageModeOptions,
      `${inputPath}.ageModeOptions`,
      errors,
    );
  }
}

function validateDropdownInput(input, inputPath, errors) {
  validateCommonDisplayInput(input, inputPath, errors);

  if (!Array.isArray(input.options)) {
    errors.push(`"${inputPath}.options" must be an array.`);
    return;
  }

  if (
    input.options.length < DROPDOWN_LIMITS.maxOptions.min ||
    input.options.length > DROPDOWN_LIMITS.maxOptions.max
  ) {
    errors.push(
      `"${inputPath}.options" must contain between ${DROPDOWN_LIMITS.maxOptions.min} and ${DROPDOWN_LIMITS.maxOptions.max} items.`,
    );
  }

  input.options.forEach((option, optionIndex) => {
    if (typeof option !== "string") {
      errors.push(`"${inputPath}.options[${optionIndex}]" must be a string.`);
      return;
    }

    const trimmed = option.trim();

    if (trimmed.length < DROPDOWN_LIMITS.optionMaxLength.min) {
      errors.push(`"${inputPath}.options[${optionIndex}]" cannot be empty.`);
    }

    if (trimmed.length > DROPDOWN_LIMITS.optionMaxLength.max) {
      errors.push(
        `"${inputPath}.options[${optionIndex}]" must be at most ${DROPDOWN_LIMITS.optionMaxLength.max} characters.`,
      );
    }
  });
}

function validateCheckboxInput(input, inputPath, errors) {
  if (typeof input.isFilter !== "boolean") {
    errors.push(`"${inputPath}.isFilter" must be a boolean.`);
  }

  if (typeof input.displayWhenTrue !== "string") {
    errors.push(`"${inputPath}.displayWhenTrue" must be a string.`);
  } else if (!CHECKBOX_TRUE_DISPLAY_OPTIONS.includes(input.displayWhenTrue)) {
    errors.push(
      `"${inputPath}.displayWhenTrue" must be one of: ${CHECKBOX_TRUE_DISPLAY_OPTIONS.join(", ")}.`,
    );
  }

  if (typeof input.displayWhenFalse !== "string") {
    errors.push(`"${inputPath}.displayWhenFalse" must be a string.`);
  } else if (!CHECKBOX_FALSE_DISPLAY_OPTIONS.includes(input.displayWhenFalse)) {
    errors.push(
      `"${inputPath}.displayWhenFalse" must be one of: ${CHECKBOX_FALSE_DISPLAY_OPTIONS.join(", ")}.`,
    );
  }

  const usesTrueMessage = CHECKBOX_MESSAGE_DISPLAY_OPTIONS.includes(
    input.displayWhenTrue,
  );

  const usesFalseMessage = CHECKBOX_MESSAGE_DISPLAY_OPTIONS.includes(
    input.displayWhenFalse,
  );

  if (typeof input.trueDisplayText !== "string") {
    errors.push(`"${inputPath}.trueDisplayText" must be a string.`);
  } else {
    if (!usesTrueMessage && input.trueDisplayText !== "") {
      errors.push(
        `"${inputPath}.trueDisplayText" must be empty unless displayWhenTrue uses a message mode.`,
      );
    }

    if (input.trueDisplayText.length > DISPLAY_TEXT_MAX_LENGTH) {
      errors.push(
        `"${inputPath}.trueDisplayText" must be at most ${DISPLAY_TEXT_MAX_LENGTH} characters.`,
      );
    }
  }

  if (typeof input.falseDisplayText !== "string") {
    errors.push(`"${inputPath}.falseDisplayText" must be a string.`);
  } else {
    if (!usesFalseMessage && input.falseDisplayText !== "") {
      errors.push(
        `"${inputPath}.falseDisplayText" must be empty unless displayWhenFalse uses a message mode.`,
      );
    }

    if (input.falseDisplayText.length > DISPLAY_TEXT_MAX_LENGTH) {
      errors.push(
        `"${inputPath}.falseDisplayText" must be at most ${DISPLAY_TEXT_MAX_LENGTH} characters.`,
      );
    }
  }

  if (typeof input.isApplicableOption !== "boolean") {
    errors.push(`"${inputPath}.isApplicableOption" must be a boolean.`);
  } else if (
    input.displayWhenFalse === "none" &&
    input.isApplicableOption !== false
  ) {
    errors.push(
      `"${inputPath}.isApplicableOption" must be false when displayWhenFalse is "none".`,
    );
  }

  if (typeof input.notes !== "string") {
    errors.push(`"${inputPath}.notes" must be a string.`);
  } else if (input.notes.length > NOTES_LIMITS.maxLength.max) {
    errors.push(
      `"${inputPath}.notes" must be at most ${NOTES_LIMITS.maxLength.max} characters.`,
    );
  }
}

function validateHoursInput(input, inputPath, errors) {
  if (typeof input.isRequired !== "boolean") {
    errors.push(`"${inputPath}.isRequired" must be a boolean.`);
  }

  if (typeof input.isFilter !== "boolean") {
    errors.push(`"${inputPath}.isFilter" must be a boolean.`);
  }

  if (typeof input.isDisplayed !== "boolean") {
    errors.push(`"${inputPath}.isDisplayed" must be a boolean.`);
  }

  if (typeof input.displayIfEmpty !== "boolean") {
    errors.push(`"${inputPath}.displayIfEmpty" must be a boolean.`);
  } else if (input.isDisplayed !== true && input.displayIfEmpty !== false) {
    errors.push(
      `"${inputPath}.displayIfEmpty" must be false when isDisplayed is false.`,
    );
  } else if (input.isRequired === true && input.displayIfEmpty !== false) {
    errors.push(
      `"${inputPath}.displayIfEmpty" must be false when isRequired is true.`,
    );
  }
}

function validatePriceRangeArrayInput(input, inputPath, errors, project) {
  validateCommonDisplayInput(input, inputPath, errors);

  if (input.isRequired !== false) {
    errors.push(`"${inputPath}.isRequired" must be false for priceRangeArray.`);
  }

  if (!isFiniteNumber(input.maxLength)) {
    errors.push(`"${inputPath}.maxLength" must be a number.`);
  } else if (
    input.maxLength < PRICE_RANGE_ARRAY_LIMITS.maxLength.min ||
    input.maxLength > PRICE_RANGE_ARRAY_LIMITS.maxLength.max
  ) {
    errors.push(
      `"${inputPath}.maxLength" must be between ${PRICE_RANGE_ARRAY_LIMITS.maxLength.min} and ${PRICE_RANGE_ARRAY_LIMITS.maxLength.max}.`,
    );
  }

  if (!isMoneyString(input.minValue)) {
    errors.push(`"${inputPath}.minValue" must be a money string like "0.00".`);
  } else if (
    compareMoneyStrings(input.minValue, PRICE_RANGE_ARRAY_LIMITS.minValue) < 0
  ) {
    errors.push(
      `"${inputPath}.minValue" cannot be less than ${PRICE_RANGE_ARRAY_LIMITS.minValue}.`,
    );
  }

  if (!isMoneyString(input.maxValue)) {
    errors.push(`"${inputPath}.maxValue" must be a money string like "0.00".`);
  } else if (
    compareMoneyStrings(input.maxValue, PRICE_RANGE_ARRAY_LIMITS.maxValue) > 0
  ) {
    errors.push(
      `"${inputPath}.maxValue" cannot be greater than ${PRICE_RANGE_ARRAY_LIMITS.maxValue}.`,
    );
  }

  if (
    isMoneyString(input.minValue) &&
    isMoneyString(input.maxValue) &&
    compareMoneyStrings(input.minValue, input.maxValue) > 0
  ) {
    errors.push(`"${inputPath}.minValue" cannot be greater than maxValue.`);
  }

  if (!isFiniteNumber(input.maxTotalPriceItems)) {
    errors.push(`"${inputPath}.maxTotalPriceItems" must be a number.`);
  } else if (
    input.maxTotalPriceItems <
      PRICE_RANGE_ARRAY_LIMITS.maxTotalPriceItems.min ||
    input.maxTotalPriceItems > PRICE_RANGE_ARRAY_LIMITS.maxTotalPriceItems.max
  ) {
    errors.push(
      `"${inputPath}.maxTotalPriceItems" must be between ${PRICE_RANGE_ARRAY_LIMITS.maxTotalPriceItems.min} and ${PRICE_RANGE_ARRAY_LIMITS.maxTotalPriceItems.max}.`,
    );
  }

  if (!isFiniteNumber(input.maxItemsPerCategory)) {
    errors.push(`"${inputPath}.maxItemsPerCategory" must be a number.`);
  } else if (
    input.maxItemsPerCategory <
      PRICE_RANGE_ARRAY_LIMITS.maxItemsPerCategory.min ||
    input.maxItemsPerCategory > PRICE_RANGE_ARRAY_LIMITS.maxItemsPerCategory.max
  ) {
    errors.push(
      `"${inputPath}.maxItemsPerCategory" must be between ${PRICE_RANGE_ARRAY_LIMITS.maxItemsPerCategory.min} and ${PRICE_RANGE_ARRAY_LIMITS.maxItemsPerCategory.max}.`,
    );
  }

  if (!isFiniteNumber(input.maxCategories)) {
    errors.push(`"${inputPath}.maxCategories" must be a number.`);
  } else if (
    input.maxCategories < PRICE_RANGE_ARRAY_LIMITS.maxCategories.min ||
    input.maxCategories > PRICE_RANGE_ARRAY_LIMITS.maxCategories.max
  ) {
    errors.push(
      `"${inputPath}.maxCategories" must be between ${PRICE_RANGE_ARRAY_LIMITS.maxCategories.min} and ${PRICE_RANGE_ARRAY_LIMITS.maxCategories.max}.`,
    );
  }

  if (!isFiniteNumber(input.maxUnitsPerCategory)) {
    errors.push(`"${inputPath}.maxUnitsPerCategory" must be a number.`);
  } else if (
    input.maxUnitsPerCategory <
      PRICE_RANGE_ARRAY_LIMITS.maxUnitsPerCategory.min ||
    input.maxUnitsPerCategory > PRICE_RANGE_ARRAY_LIMITS.maxUnitsPerCategory.max
  ) {
    errors.push(
      `"${inputPath}.maxUnitsPerCategory" must be between ${PRICE_RANGE_ARRAY_LIMITS.maxUnitsPerCategory.min} and ${PRICE_RANGE_ARRAY_LIMITS.maxUnitsPerCategory.max}.`,
    );
  }

  if (typeof input.allowCustomCategoriesAndUnits !== "boolean") {
    errors.push(
      `"${inputPath}.allowCustomCategoriesAndUnits" must be a boolean.`,
    );
  }

  if (
    project?.engineKey === "presence" &&
    input.allowCustomCategoriesAndUnits !== false
  ) {
    errors.push(
      `"${inputPath}.allowCustomCategoriesAndUnits" must be false for presence projects.`,
    );
  }

  if (!Array.isArray(input.defaultCategoryOptions)) {
    errors.push(`"${inputPath}.defaultCategoryOptions" must be an array.`);
  }

  if (!Array.isArray(input.customCategoryOptions)) {
    errors.push(`"${inputPath}.customCategoryOptions" must be an array.`);
  }

  const defaultCategories = Array.isArray(input.defaultCategoryOptions)
    ? input.defaultCategoryOptions
    : [];

  const customCategories = Array.isArray(input.customCategoryOptions)
    ? input.customCategoryOptions
    : [];

  const mergedCategories = [...defaultCategories, ...customCategories];

  if (mergedCategories.length > input.maxCategories) {
    errors.push(
      `"${inputPath}" cannot contain more than ${input.maxCategories} total categories across defaultCategoryOptions and customCategoryOptions.`,
    );
  }

  validateUniqueStringArray(
    mergedCategories,
    `${inputPath} merged category options`,
    errors,
  );

  mergedCategories.forEach((category, categoryIndex) => {
    if (typeof category !== "string") {
      errors.push(
        `"${inputPath}" category option at merged index ${categoryIndex} must be a string.`,
      );
      return;
    }

    if (category.trim().length === 0) {
      errors.push(
        `"${inputPath}" category option at merged index ${categoryIndex} cannot be empty.`,
      );
    }

    if (category.length > input.maxLength) {
      errors.push(
        `"${inputPath}" category option at merged index ${categoryIndex} must be at most ${input.maxLength} characters.`,
      );
    }
  });

  if (!Array.isArray(input.priceModeOptions)) {
    errors.push(`"${inputPath}.priceModeOptions" must be an array.`);
  } else {
    validateNonEmptyOptionsArray(
      input.priceModeOptions,
      `${inputPath}.priceModeOptions`,
      errors,
    );
    validateStringOptionsArray(
      input.priceModeOptions,
      PRICE_RANGE_ARRAY_LIMITS.modeOptions,
      `${inputPath}.priceModeOptions`,
      errors,
    );
    validateUniqueStringArray(
      input.priceModeOptions,
      `${inputPath}.priceModeOptions`,
      errors,
    );
  }

  if (!isPlainObject(input.defaultPriceUnitOptionsByCategory)) {
    errors.push(
      `"${inputPath}.defaultPriceUnitOptionsByCategory" must be an object.`,
    );
  }

  if (!isPlainObject(input.customUnitOptionsByCategory)) {
    errors.push(
      `"${inputPath}.customUnitOptionsByCategory" must be an object.`,
    );
  }

  const defaultUnitMap = isPlainObject(input.defaultPriceUnitOptionsByCategory)
    ? input.defaultPriceUnitOptionsByCategory
    : {};

  const customUnitMap = isPlainObject(input.customUnitOptionsByCategory)
    ? input.customUnitOptionsByCategory
    : {};

  const mergedCategorySet = new Set(mergedCategories);

  for (const [category, units] of Object.entries(defaultUnitMap)) {
    validateUnitMapEntry({
      input,
      inputPath,
      errors,
      category,
      units,
      mergedCategorySet,
      mapName: "defaultPriceUnitOptionsByCategory",
    });
  }

  for (const [category, units] of Object.entries(customUnitMap)) {
    validateUnitMapEntry({
      input,
      inputPath,
      errors,
      category,
      units,
      mergedCategorySet,
      mapName: "customUnitOptionsByCategory",
    });
  }

  for (const category of mergedCategories) {
    const defaultUnits = Array.isArray(defaultUnitMap[category])
      ? defaultUnitMap[category]
      : [];

    const customUnits = Array.isArray(customUnitMap[category])
      ? customUnitMap[category]
      : [];

    const mergedUnits = [...defaultUnits, ...customUnits];

    if (mergedUnits.length > input.maxUnitsPerCategory) {
      errors.push(
        `"${inputPath}" category "${category}" cannot contain more than ${input.maxUnitsPerCategory} total units across defaultPriceUnitOptionsByCategory and customUnitOptionsByCategory.`,
      );
    }

    validateUniqueStringArray(
      mergedUnits,
      `${inputPath} merged units for ${category}`,
      errors,
    );
  }
}

function validateUnitMapEntry({
  input,
  inputPath,
  errors,
  category,
  units,
  mergedCategorySet,
  mapName,
}) {
  if (!mergedCategorySet.has(category)) {
    errors.push(
      `"${inputPath}.${mapName}.${category}" has no matching category in defaultCategoryOptions/customCategoryOptions.`,
    );
  }

  if (!Array.isArray(units)) {
    errors.push(`"${inputPath}.${mapName}.${category}" must be an array.`);
    return;
  }

  units.forEach((unit, unitIndex) => {
    if (typeof unit !== "string") {
      errors.push(
        `"${inputPath}.${mapName}.${category}[${unitIndex}]" must be a string.`,
      );
      return;
    }

    if (unit.trim().length === 0) {
      errors.push(
        `"${inputPath}.${mapName}.${category}[${unitIndex}]" cannot be empty.`,
      );
    }

    if (unit.length > input.maxLength) {
      errors.push(
        `"${inputPath}.${mapName}.${category}[${unitIndex}]" must be at most ${input.maxLength} characters.`,
      );
    }
  });

  if (units.length > input.maxUnitsPerCategory) {
    errors.push(
      `"${inputPath}.${mapName}.${category}" cannot contain more than ${input.maxUnitsPerCategory} units.`,
    );
  }

  validateUniqueStringArray(
    units,
    `${inputPath}.${mapName}.${category}`,
    errors,
  );
}

function validateTagListInput(input, inputPath, errors, project) {
  validateCommonDisplayInput(input, inputPath, errors);

  if (input.isRequired !== false) {
    errors.push(`"${inputPath}.isRequired" must be false for tagList.`);
  }

  if (!isFiniteNumber(input.maxLength)) {
    errors.push(`"${inputPath}.maxLength" must be a number.`);
  } else if (
    input.maxLength < TAG_LIST_LIMITS.maxLength.min ||
    input.maxLength > TAG_LIST_LIMITS.maxLength.max
  ) {
    errors.push(
      `"${inputPath}.maxLength" must be between ${TAG_LIST_LIMITS.maxLength.min} and ${TAG_LIST_LIMITS.maxLength.max}.`,
    );
  }

  if (!isFiniteNumber(input.maxItems)) {
    errors.push(`"${inputPath}.maxItems" must be a number.`);
  } else if (
    input.maxItems < TAG_LIST_LIMITS.maxItems.min ||
    input.maxItems > TAG_LIST_LIMITS.maxItems.max
  ) {
    errors.push(
      `"${inputPath}.maxItems" must be between ${TAG_LIST_LIMITS.maxItems.min} and ${TAG_LIST_LIMITS.maxItems.max}.`,
    );
  }

  if (typeof input.allowCustomTags !== "boolean") {
    errors.push(`"${inputPath}.allowCustomTags" must be a boolean.`);
  }

  if (project?.engineKey === "presence" && input.allowCustomTags !== false) {
    errors.push(
      `"${inputPath}.allowCustomTags" must be false for presence projects.`,
    );
  }

  if (!Array.isArray(input.defaultTags)) {
    errors.push(`"${inputPath}.defaultTags" must be an array.`);
  }

  if (!Array.isArray(input.customTags)) {
    errors.push(`"${inputPath}.customTags" must be an array.`);
  }

  const defaultTags = Array.isArray(input.defaultTags) ? input.defaultTags : [];
  const customTags = Array.isArray(input.customTags) ? input.customTags : [];

  const mergedTags = [...defaultTags, ...customTags];

  if (mergedTags.length > input.maxItems) {
    errors.push(
      `"${inputPath}" cannot contain more than ${input.maxItems} total tags across defaultTags and customTags.`,
    );
  }

  validateUniqueStringArray(
    mergedTags,
    `${inputPath} merged tag options`,
    errors,
  );

  mergedTags.forEach((tag, tagIndex) => {
    if (typeof tag !== "string") {
      errors.push(
        `"${inputPath}" tag option at merged index ${tagIndex} must be a string.`,
      );
      return;
    }

    if (tag.trim().length === 0) {
      errors.push(
        `"${inputPath}" tag option at merged index ${tagIndex} cannot be empty.`,
      );
    }

    if (tag.length > input.maxLength) {
      errors.push(
        `"${inputPath}" tag option at merged index ${tagIndex} must be at most ${input.maxLength} characters.`,
      );
    }
  });
}

function validateCommonDisplayInput(input, inputPath, errors, options = {}) {
  const { requireIsFilter = true } = options;

  if (typeof input.isRequired !== "boolean") {
    errors.push(`"${inputPath}.isRequired" must be a boolean.`);
  }

  if (requireIsFilter && typeof input.isFilter !== "boolean") {
    errors.push(`"${inputPath}.isFilter" must be a boolean.`);
  }

  if (typeof input.isDisplayed !== "boolean") {
    errors.push(`"${inputPath}.isDisplayed" must be a boolean.`);
  }

  if (typeof input.displayIfEmpty !== "boolean") {
    errors.push(`"${inputPath}.displayIfEmpty" must be a boolean.`);
  } else if (input.isDisplayed !== true && input.displayIfEmpty !== false) {
    errors.push(
      `"${inputPath}.displayIfEmpty" must be false when isDisplayed is false.`,
    );
  } else if (input.isRequired === true && input.displayIfEmpty !== false) {
    errors.push(
      `"${inputPath}.displayIfEmpty" must be false when isRequired is true.`,
    );
  }

  if (typeof input.emptyDisplayText !== "string") {
    errors.push(`"${inputPath}.emptyDisplayText" must be a string.`);
  } else {
    if (input.isDisplayed !== true && input.emptyDisplayText !== "") {
      errors.push(
        `"${inputPath}.emptyDisplayText" must be empty when isDisplayed is false.`,
      );
    }

    if (input.isRequired === true && input.emptyDisplayText !== "") {
      errors.push(
        `"${inputPath}.emptyDisplayText" must be empty when isRequired is true.`,
      );
    }

    if (input.emptyDisplayText.length > DISPLAY_TEXT_MAX_LENGTH) {
      errors.push(
        `"${inputPath}.emptyDisplayText" must be at most ${DISPLAY_TEXT_MAX_LENGTH} characters.`,
      );
    }
  }
}

/* ─────────────────────────────────────────────
   Extensions
───────────────────────────────────────────── */

function validateExtensions(extensions, errors) {
  if (!isPlainObject(extensions)) {
    errors.push(`"extensions" must be an object.`);
    return;
  }

  for (const [extensionKey, extensionValue] of Object.entries(extensions)) {
    if (!EXTENSION_KEYS.includes(extensionKey)) {
      errors.push(`"extensions.${extensionKey}" is not a valid extension.`);
      continue;
    }

    if (!isPlainObject(extensionValue)) {
      errors.push(`"extensions.${extensionKey}" must be an object.`);
      continue;
    }

    const allowedFields = EXTENSION_FIELDS[extensionKey] || [];

    for (const key of Object.keys(extensionValue)) {
      if (!allowedFields.includes(key)) {
        errors.push(
          `"extensions.${extensionKey}.${key}" is not an allowed field.`,
        );
      }
    }

    if (
      extensionValue.enabled !== undefined &&
      typeof extensionValue.enabled !== "boolean"
    ) {
      errors.push(`"extensions.${extensionKey}.enabled" must be a boolean.`);
    }

    const enabled = extensionValue.enabled === true;

    if (
      extensionValue.perDataItemToggle !== undefined &&
      typeof extensionValue.perDataItemToggle !== "boolean"
    ) {
      errors.push(
        `"extensions.${extensionKey}.perDataItemToggle" must be a boolean.`,
      );
    }

    if (!enabled && extensionValue.perDataItemToggle === true) {
      errors.push(
        `"extensions.${extensionKey}.perDataItemToggle" must be false when the extension is disabled.`,
      );
    }

    if (extensionKey === "Gallery") {
      if (extensionValue.maxImages !== undefined) {
        validateNumberInRange(
          extensionValue.maxImages,
          `extensions.${extensionKey}.maxImages`,
          errors,
          EXTENSION_LIMITS.Gallery.maxImages.min,
          EXTENSION_LIMITS.Gallery.maxImages.max,
        );
      }

      if (!enabled && extensionValue.maxImages !== 0) {
        errors.push(
          `"extensions.${extensionKey}.maxImages" must be 0 when the extension is disabled.`,
        );
      }
    }

    if (extensionKey === "Bulletin") {
      if (extensionValue.maxMessages !== undefined) {
        validateNumberInRange(
          extensionValue.maxMessages,
          `extensions.${extensionKey}.maxMessages`,
          errors,
          EXTENSION_LIMITS.Bulletin.maxMessages.min,
          EXTENSION_LIMITS.Bulletin.maxMessages.max,
        );
      }

      if (extensionValue.messageLength !== undefined) {
        validateNumberInRange(
          extensionValue.messageLength,
          `extensions.${extensionKey}.messageLength`,
          errors,
          EXTENSION_LIMITS.Bulletin.messageLength.min,
          EXTENSION_LIMITS.Bulletin.messageLength.max,
        );
      }

      if (!enabled && extensionValue.maxMessages !== 0) {
        errors.push(
          `"extensions.${extensionKey}.maxMessages" must be 0 when the extension is disabled.`,
        );
      }

      if (!enabled && extensionValue.messageLength !== 0) {
        errors.push(
          `"extensions.${extensionKey}.messageLength" must be 0 when the extension is disabled.`,
        );
      }
    }

    if (extensionKey === "Chat") {
      if (extensionValue.maxMessages !== undefined) {
        validateNumberInRange(
          extensionValue.maxMessages,
          `extensions.${extensionKey}.maxMessages`,
          errors,
          EXTENSION_LIMITS.Chat.maxMessages.min,
          EXTENSION_LIMITS.Chat.maxMessages.max,
        );
      }

      if (extensionValue.messageLength !== undefined) {
        validateNumberInRange(
          extensionValue.messageLength,
          `extensions.${extensionKey}.messageLength`,
          errors,
          EXTENSION_LIMITS.Chat.messageLength.min,
          EXTENSION_LIMITS.Chat.messageLength.max,
        );
      }

      if (!enabled && extensionValue.maxMessages !== 0) {
        errors.push(
          `"extensions.${extensionKey}.maxMessages" must be 0 when the extension is disabled.`,
        );
      }

      if (!enabled && extensionValue.messageLength !== 0) {
        errors.push(
          `"extensions.${extensionKey}.messageLength" must be 0 when the extension is disabled.`,
        );
      }
    }
  }
}

/* ─────────────────────────────────────────────
   Preview Text
───────────────────────────────────────────── */

function validatePreviewText(previewText, sections, errors) {
  if (previewText === undefined || previewText === null || previewText === "") {
    return;
  }

  if (typeof previewText !== "string") {
    errors.push(`"previewText" must be a string.`);
    return;
  }

  if (previewText !== previewText.trim()) {
    errors.push(`"previewText" cannot have leading or trailing spaces.`);
    return;
  }

  const tokens = previewText.split(" ");

  if (tokens.some((token) => token === "")) {
    errors.push(`"previewText" must use exactly one space between tokens.`);
    return;
  }

  for (const token of tokens) {
    const match = token.match(
      /^sections\[(\d+)\]\.inputs\[(\d+)\]\.(label|value)$/,
    );

    if (!match) {
      errors.push(`"previewText" contains invalid token "${token}".`);
      continue;
    }

    const sectionIndex = Number(match[1]);
    const inputIndex = Number(match[2]);

    if (!Array.isArray(sections) || !sections[sectionIndex]) {
      errors.push(
        `"previewText" references missing section index ${sectionIndex}.`,
      );
      continue;
    }

    if (
      !Array.isArray(sections[sectionIndex].inputs) ||
      !sections[sectionIndex].inputs[inputIndex]
    ) {
      errors.push(
        `"previewText" references missing input index ${inputIndex} in section ${sectionIndex}.`,
      );
    }
  }
}

/* ─────────────────────────────────────────────
   Extra route payload validators
───────────────────────────────────────────── */

export function validateProjectVisibilityPayload(payload = {}) {
  if (!hasExactKeys(payload, PROJECT_VISIBILITY_PAYLOAD_FIELDS)) {
    return false;
  }

  const { visibility, configUpdatedAt } = payload;

  if (typeof visibility !== "string") {
    return false;
  }

  if (!VISIBILITY_OPTIONS.includes(visibility)) {
    return false;
  }

  if (!isDateLike(configUpdatedAt)) {
    return false;
  }

  return true;
}

export function validateFavouriteProjectPayload(payload = {}) {
  if (!hasExactKeys(payload, PROJECT_FAVOURITE_PAYLOAD_FIELDS)) {
    return false;
  }

  const { projectId } = payload;

  if (typeof projectId !== "string") {
    return false;
  }

  return /^[a-f0-9]{24}$/i.test(projectId.trim());
}

export function validateProjectRolePayload(payload = {}) {
  if (!hasExactKeys(payload, PROJECT_ROLE_PAYLOAD_FIELDS)) {
    return false;
  }

  const { role, userName, configUpdatedAt } = payload;

  if (typeof role !== "string" || !PROJECT_ROLE_FIELDS.includes(role)) {
    return false;
  }

  if (typeof userName !== "string") {
    return false;
  }

  if (validateUserName(userName)) {
    return false;
  }

  if (!isDateLike(configUpdatedAt)) {
    return false;
  }

  return true;
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function decimalPlaces(value) {
  if (!Number.isFinite(Number(value))) return 0;

  const str = String(value);

  if (!str.includes(".")) return 0;

  return str.split(".")[1]?.length || 0;
}

function requiredNumberLength(value) {
  if (!Number.isFinite(Number(value))) return 0;

  return String(value).length;
}

function validateNumericMaxLengthCanRepresentBounds({
  input,
  inputPath,
  errors,
  minValue,
  maxValue,
}) {
  if (!isFiniteNumber(input.maxLength)) return;

  const valuesToCheck = [];

  if (isFiniteNumber(input.minValue)) {
    valuesToCheck.push(input.minValue);
  }

  if (isFiniteNumber(input.maxValue)) {
    valuesToCheck.push(input.maxValue);
  }

  for (const value of valuesToCheck) {
    const requiredLength = requiredNumberLength(value);

    if (requiredLength > input.maxLength) {
      errors.push(
        `"${inputPath}.maxLength" must be at least ${requiredLength} to represent configured value "${value}".`,
      );
    }
  }

  if (
    isFiniteNumber(input.minValue) &&
    isFiniteNumber(input.maxValue) &&
    input.minValue <= 0 &&
    input.maxValue >= 0 &&
    String(0).length > input.maxLength
  ) {
    errors.push(`"${inputPath}.maxLength" must be able to represent 0.`);
  }
}

function validateNumberInRange(value, path, errors, min, max) {
  if (!isFiniteNumber(value)) {
    errors.push(`"${path}" must be a number.`);
    return;
  }

  if (value < min || value > max) {
    errors.push(`"${path}" must be between ${min} and ${max}.`);
  }
}

function validateNonEmptyOptionsArray(actual, path, errors) {
  if (!Array.isArray(actual)) return;

  if (actual.length === 0) {
    errors.push(`"${path}" must contain at least one option.`);
  }
}

function validateStringOptionsArray(actual, allowed, path, errors) {
  actual.forEach((value, index) => {
    if (typeof value !== "string") {
      errors.push(`"${path}[${index}]" must be a string.`);
      return;
    }

    if (!allowed.includes(value)) {
      errors.push(`"${path}[${index}]" must be one of: ${allowed.join(", ")}.`);
    }
  });
}

function validateUniqueStringArray(arr, path, errors) {
  const seen = new Set();

  arr.forEach((value, index) => {
    if (typeof value !== "string") return;

    if (seen.has(value)) {
      errors.push(`"${path}[${index}]" duplicates "${value}".`);
      return;
    }

    seen.add(value);
  });
}

export function hasNoKeys(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return true;
  }

  return Object.keys(payload).length === 0;
}

export function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;

  const keys = Object.keys(value);

  if (keys.length !== expectedKeys.length) {
    return false;
  }

  const expected = new Set(expectedKeys);
  return keys.every((key) => expected.has(key));
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isDateLike(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime());
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime());
  }

  return false;
}

function isObjectIdLike(value) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (isPlainObject(value)) {
    return true;
  }

  return false;
}

function isMoneyString(value) {
  return typeof value === "string" && /^\d+(\.\d{2})$/.test(value);
}

function compareMoneyStrings(a, b) {
  const aNum = Number(a);
  const bNum = Number(b);

  if (!Number.isFinite(aNum) || !Number.isFinite(bNum)) return 0;
  if (aNum < bNum) return -1;
  if (aNum > bNum) return 1;
  return 0;
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  return a.every((value, index) => value === b[index]);
}

function mapById(items) {
  const map = new Map();

  if (!Array.isArray(items)) {
    return map;
  }

  for (const item of items) {
    if (item?.id !== undefined && item?.id !== null) {
      map.set(item.id, item);
    }
  }

  return map;
}

function normalizeOptionalString(value) {
  return typeof value === "string" ? value : "";
}

function resultWithErrors(errors) {
  return {
    isValid: errors.length === 0,
    errors,
  };
}
