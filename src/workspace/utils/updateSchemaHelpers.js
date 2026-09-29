// src/workspace/utils/updateSchemaHelpers.js

export function applyAddedCustomTagsToSchema(schema, addedCustomTags) {
  if (!schema || !Array.isArray(schema.sections) || !Array.isArray(addedCustomTags)) return schema;

  const nextSchema = structuredClone(schema);
  let changed = false;

  for (const change of addedCustomTags) {
    const inputId = String(change?.inputId || "");
    const incomingTags = Array.isArray(change?.tags) ? change.tags : [];
    if (!inputId || incomingTags.length === 0) continue;

    for (const section of nextSchema.sections || []) {
      for (const input of section.inputs || []) {
        if (String(input?.id) !== inputId) continue;

        if (!Array.isArray(input.customTags)) input.customTags = [];

        const existingSet = new Set(
          input.customTags
            .filter((tag) => typeof tag === "string")
            .map((tag) => tag.toLowerCase()),
        );

        for (const tag of incomingTags) {
          if (typeof tag !== "string") continue;
          const key = tag.toLowerCase();
          if (existingSet.has(key)) continue;

          existingSet.add(key);
          input.customTags.push(tag);
          changed = true;
        }
      }
    }
  }

  return changed ? nextSchema : schema;
}

export function applyRemovedCustomTagsToSchema(schema, removedCustomTags) {
  if (!schema || !Array.isArray(schema.sections) || !Array.isArray(removedCustomTags)) return schema;

  const nextSchema = structuredClone(schema);
  let changed = false;

  for (const change of removedCustomTags) {
    const inputId = String(change?.inputId || "");
    const removed = Array.isArray(change?.tags) ? change.tags : [];
    if (!inputId || removed.length === 0) continue;

    const removedSet = new Set(
      removed
        .filter((tag) => typeof tag === "string")
        .map((tag) => tag.toLowerCase()),
    );

    for (const section of nextSchema.sections || []) {
      for (const input of section.inputs || []) {
        if (String(input?.id) !== inputId) continue;
        if (!Array.isArray(input.customTags)) continue;

        const beforeLength = input.customTags.length;
        input.customTags = input.customTags.filter(
          (tag) => typeof tag === "string" && !removedSet.has(tag.toLowerCase()),
        );

        if (input.customTags.length !== beforeLength) changed = true;
      }
    }
  }

  return changed ? nextSchema : schema;
}

export function applyAddedCustomCategoriesToSchema(schema, addedCustomCategories) {
  if (!schema || !Array.isArray(schema.sections) || !Array.isArray(addedCustomCategories)) return schema;

  const nextSchema = structuredClone(schema);
  let changed = false;

  for (const change of addedCustomCategories) {
    const inputId = String(change?.inputId || "");
    const incomingCategories = Array.isArray(change?.categories) ? change.categories : [];
    if (!inputId || incomingCategories.length === 0) continue;

    for (const section of nextSchema.sections || []) {
      for (const input of section.inputs || []) {
        if (String(input?.id) !== inputId) continue;

        if (!Array.isArray(input.customCategoryOptions)) {
          input.customCategoryOptions = [];
        }

        const existingSet = new Set(
          input.customCategoryOptions
            .filter((category) => typeof category === "string")
            .map((category) => category.toLowerCase()),
        );

        for (const category of incomingCategories) {
          if (typeof category !== "string") continue;
          const key = category.toLowerCase();
          if (existingSet.has(key)) continue;

          existingSet.add(key);
          input.customCategoryOptions.push(category);
          changed = true;
        }
      }
    }
  }

  return changed ? nextSchema : schema;
}

export function applyRemovedCustomCategoriesToSchema(schema, removedCustomCategories) {
  if (!schema || !Array.isArray(schema.sections) || !Array.isArray(removedCustomCategories)) return schema;

  const nextSchema = structuredClone(schema);
  let changed = false;

  for (const change of removedCustomCategories) {
    const inputId = String(change?.inputId || "");
    const removed = Array.isArray(change?.categories) ? change.categories : [];
    if (!inputId || removed.length === 0) continue;

    const removedSet = new Set(
      removed
        .filter((category) => typeof category === "string")
        .map((category) => category.toLowerCase()),
    );

    for (const section of nextSchema.sections || []) {
      for (const input of section.inputs || []) {
        if (String(input?.id) !== inputId) continue;
        if (!Array.isArray(input.customCategoryOptions)) continue;

        const beforeLength = input.customCategoryOptions.length;
        input.customCategoryOptions = input.customCategoryOptions.filter(
          (category) =>
            typeof category === "string" &&
            !removedSet.has(category.toLowerCase()),
        );

        if (input.customCategoryOptions.length !== beforeLength) changed = true;
      }
    }
  }

  return changed ? nextSchema : schema;
}

export function applyAddedCustomUnitsToSchema(schema, addedCustomUnits) {
  if (!schema || !Array.isArray(schema.sections) || !Array.isArray(addedCustomUnits)) return schema;

  const nextSchema = structuredClone(schema);
  let changed = false;

  for (const change of addedCustomUnits) {
    const inputId = String(change?.inputId || "");
    const incomingUnitsByCategory =
      change?.unitsByCategory && typeof change.unitsByCategory === "object"
        ? change.unitsByCategory
        : {};

    if (!inputId || Object.keys(incomingUnitsByCategory).length === 0) continue;

    for (const section of nextSchema.sections || []) {
      for (const input of section.inputs || []) {
        if (String(input?.id) !== inputId) continue;

        if (
          !input.customUnitOptionsByCategory ||
          typeof input.customUnitOptionsByCategory !== "object" ||
          Array.isArray(input.customUnitOptionsByCategory)
        ) {
          input.customUnitOptionsByCategory = {};
        }

        for (const [category, units] of Object.entries(incomingUnitsByCategory)) {
          const incomingUnits = Array.isArray(units) ? units : [];
          if (incomingUnits.length === 0) continue;

          if (!Array.isArray(input.customUnitOptionsByCategory[category])) {
            input.customUnitOptionsByCategory[category] = [];
          }

          const existingSet = new Set(
            input.customUnitOptionsByCategory[category]
              .filter((unit) => typeof unit === "string")
              .map((unit) => unit.toLowerCase()),
          );

          for (const unit of incomingUnits) {
            if (typeof unit !== "string") continue;
            const key = unit.toLowerCase();
            if (existingSet.has(key)) continue;

            existingSet.add(key);
            input.customUnitOptionsByCategory[category].push(unit);
            changed = true;
          }
        }
      }
    }
  }

  return changed ? nextSchema : schema;
}

export function applyRemovedCustomUnitsToSchema(schema, removedCustomUnits) {
  if (!schema || !Array.isArray(schema.sections) || !Array.isArray(removedCustomUnits)) return schema;

  const nextSchema = structuredClone(schema);
  let changed = false;

  for (const change of removedCustomUnits) {
    const inputId = String(change?.inputId || "");
    const removedUnitsByCategory =
      change?.unitsByCategory && typeof change.unitsByCategory === "object"
        ? change.unitsByCategory
        : {};

    if (!inputId || Object.keys(removedUnitsByCategory).length === 0) continue;

    for (const section of nextSchema.sections || []) {
      for (const input of section.inputs || []) {
        if (String(input?.id) !== inputId) continue;

        if (
          !input.customUnitOptionsByCategory ||
          typeof input.customUnitOptionsByCategory !== "object" ||
          Array.isArray(input.customUnitOptionsByCategory)
        ) {
          continue;
        }

        for (const [category, units] of Object.entries(removedUnitsByCategory)) {
          const removedUnits = Array.isArray(units) ? units : [];
          if (removedUnits.length === 0) continue;
          if (!Array.isArray(input.customUnitOptionsByCategory[category])) continue;

          const removedSet = new Set(
            removedUnits
              .filter((unit) => typeof unit === "string")
              .map((unit) => unit.toLowerCase()),
          );

          const beforeLength = input.customUnitOptionsByCategory[category].length;

          input.customUnitOptionsByCategory[category] =
            input.customUnitOptionsByCategory[category].filter(
              (unit) =>
                typeof unit === "string" && !removedSet.has(unit.toLowerCase()),
            );

          if (input.customUnitOptionsByCategory[category].length !== beforeLength) {
            changed = true;
          }

          if (input.customUnitOptionsByCategory[category].length === 0) {
            delete input.customUnitOptionsByCategory[category];
            changed = true;
          }
        }
      }
    }
  }

  return changed ? nextSchema : schema;
}

export function applySchemaMetadataDiffs(schema, diffs = {}) {
  const addedCustomTags = diffs.addedCustomTags || [];
  const removedCustomTags = diffs.removedCustomTags || [];
  const addedCustomCategories = diffs.addedCustomCategories || [];
  const removedCustomCategories = diffs.removedCustomCategories || [];
  const addedCustomUnits = diffs.addedCustomUnits || [];
  const removedCustomUnits = diffs.removedCustomUnits || [];

  const hasSchemaMetadataChanges =
    addedCustomTags.length > 0 ||
    removedCustomTags.length > 0 ||
    addedCustomCategories.length > 0 ||
    removedCustomCategories.length > 0 ||
    addedCustomUnits.length > 0 ||
    removedCustomUnits.length > 0;

  if (!hasSchemaMetadataChanges) {
    return schema;
  }

  const withAddedTags = applyAddedCustomTagsToSchema(schema, addedCustomTags);

  const withRemovedTags = applyRemovedCustomTagsToSchema(
    withAddedTags,
    removedCustomTags,
  );

  const withAddedCategories = applyAddedCustomCategoriesToSchema(
    withRemovedTags,
    addedCustomCategories,
  );

  const withRemovedCategories = applyRemovedCustomCategoriesToSchema(
    withAddedCategories,
    removedCustomCategories,
  );

  const withAddedUnits = applyAddedCustomUnitsToSchema(
    withRemovedCategories,
    addedCustomUnits,
  );

  const withRemovedUnits = applyRemovedCustomUnitsToSchema(
    withAddedUnits,
    removedCustomUnits,
  );

  if (diffs.schemaUpdatedAt == null) {
    return withRemovedUnits;
  }

  return {
    ...withRemovedUnits,
    updatedAt: diffs.schemaUpdatedAt,
  };
}