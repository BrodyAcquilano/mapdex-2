import { validateDataItemPayload } from "../../shared/validation/dataValidation.js";

function applyAddedCustomTagsToSchema(schema, addedCustomTags) {
  if (
    !schema ||
    !Array.isArray(schema.sections) ||
    !Array.isArray(addedCustomTags)
  ) {
    return schema;
  }

  const nextSchema = structuredClone(schema);
  let changed = false;

  for (const change of addedCustomTags) {
    const inputId = String(change?.inputId || "");
    const incomingTags = Array.isArray(change?.tags) ? change.tags : [];
    if (!inputId || incomingTags.length === 0) continue;

    for (const section of nextSchema.sections || []) {
      for (const input of section.inputs || []) {
        if (String(input?.id) !== inputId) continue;

        if (!Array.isArray(input.customTags)) {
          input.customTags = [];
        }

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

function applyRemovedCustomTagsToSchema(schema, removedCustomTags) {
  if (
    !schema ||
    !Array.isArray(schema.sections) ||
    !Array.isArray(removedCustomTags)
  ) {
    return schema;
  }

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
          (tag) =>
            typeof tag === "string" && !removedSet.has(tag.toLowerCase()),
        );

        if (input.customTags.length !== beforeLength) {
          changed = true;
        }
      }
    }
  }

  return changed ? nextSchema : schema;
}

function applyAddedCustomCategoriesToSchema(schema, addedCustomCategories) {
  if (
    !schema ||
    !Array.isArray(schema.sections) ||
    !Array.isArray(addedCustomCategories)
  ) {
    return schema;
  }

  const nextSchema = structuredClone(schema);
  let changed = false;

  for (const change of addedCustomCategories) {
    const inputId = String(change?.inputId || "");
    const incomingCategories = Array.isArray(change?.categories)
      ? change.categories
      : [];

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

function applyRemovedCustomCategoriesToSchema(schema, removedCustomCategories) {
  if (
    !schema ||
    !Array.isArray(schema.sections) ||
    !Array.isArray(removedCustomCategories)
  ) {
    return schema;
  }

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

        if (input.customCategoryOptions.length !== beforeLength) {
          changed = true;
        }
      }
    }
  }

  return changed ? nextSchema : schema;
}

function applyAddedCustomUnitsToSchema(schema, addedCustomUnits) {
  if (
    !schema ||
    !Array.isArray(schema.sections) ||
    !Array.isArray(addedCustomUnits)
  ) {
    return schema;
  }

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

        for (const [category, units] of Object.entries(
          incomingUnitsByCategory,
        )) {
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

function applyRemovedCustomUnitsToSchema(schema, removedCustomUnits) {
  if (
    !schema ||
    !Array.isArray(schema.sections) ||
    !Array.isArray(removedCustomUnits)
  ) {
    return schema;
  }

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

        for (const [category, units] of Object.entries(
          removedUnitsByCategory,
        )) {
          const removedUnits = Array.isArray(units) ? units : [];
          if (removedUnits.length === 0) continue;
          if (!Array.isArray(input.customUnitOptionsByCategory[category])) {
            continue;
          }

          const removedSet = new Set(
            removedUnits
              .filter((unit) => typeof unit === "string")
              .map((unit) => unit.toLowerCase()),
          );

          const beforeLength =
            input.customUnitOptionsByCategory[category].length;

          input.customUnitOptionsByCategory[category] =
            input.customUnitOptionsByCategory[category].filter(
              (unit) =>
                typeof unit === "string" && !removedSet.has(unit.toLowerCase()),
            );

          if (
            input.customUnitOptionsByCategory[category].length !== beforeLength
          ) {
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

function updateSchemaMetadata({
  schema,
  setSchema,
  schemaUpdatedAt = null,
  addedCustomTags = [],
  removedCustomTags = [],
  addedCustomCategories = [],
  removedCustomCategories = [],
  addedCustomUnits = [],
  removedCustomUnits = [],
}) {
  if (typeof setSchema !== "function" || !schema) return;

  const hasSchemaMetadataChanges =
    addedCustomTags.length > 0 ||
    removedCustomTags.length > 0 ||
    addedCustomCategories.length > 0 ||
    removedCustomCategories.length > 0 ||
    addedCustomUnits.length > 0 ||
    removedCustomUnits.length > 0;

  if (!hasSchemaMetadataChanges) return;

  setSchema((prev) => {
    const baseSchema = prev || schema;

    const withAddedTags = applyAddedCustomTagsToSchema(
      baseSchema,
      addedCustomTags,
    );

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

    return schemaUpdatedAt == null
      ? withRemovedUnits
      : {
          ...withRemovedUnits,
          updatedAt: schemaUpdatedAt,
        };
  });
}

function notifyLines(system, message) {
  if (!message) return;

  message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => system.notify(line));
}

function applyApiSchemaMetadata({ schema, setSchema, apiResponse }) {
  updateSchemaMetadata({
    schema,
    setSchema,
    schemaUpdatedAt: apiResponse?.schemaUpdatedAt ?? null,
    addedCustomTags: apiResponse?.addedCustomTags || [],
    removedCustomTags: apiResponse?.removedCustomTags || [],
    addedCustomCategories: apiResponse?.addedCustomCategories || [],
    removedCustomCategories: apiResponse?.removedCustomCategories || [],
    addedCustomUnits: apiResponse?.addedCustomUnits || [],
    removedCustomUnits: apiResponse?.removedCustomUnits || [],
  });
}

export async function handleAddSubmit({
  schema,
  formData,
  system,
  dataUtils,
  apis,
  setData,
  setSelectedDataItem,
  setSchema,
  onClose,
}) {
  if (!schema) {
    return;
  }

  const payload =
    dataUtils.buildAddPayloadFromForm(
      formData,
    );

  if (!payload) {
    return;
  }

  const validation =
    validateDataItemPayload({
      schema,
      dataItem: payload,
      mode: "add",
    });

  if (!validation.isValid) {
    system.notify(
      "Form is missing required fields or contains invalid entries.",
    );

    return;
  }

  try {
    const {
      data: apiResponse,
      message,
    } = await apis.engineApi.add(
      schema._id,
      schema.updatedAt,
      payload,
    );

    system.notify(message);

    const savedDoc =
      apiResponse?.data;

    if (!savedDoc?._id) {
      return;
    }

    applyApiSchemaMetadata({
      schema,
      setSchema,
      apiResponse,
    });

    const savedDocForClient = {
      ...savedDoc,
      userRole: "editor",
    };

    const normalizedDataItem =
      dataUtils.normalizeDataItem(
        schema,
        savedDocForClient,
      );

    dataUtils.insertDataItemInList(
      setData,
      normalizedDataItem,
    );

    setSelectedDataItem(
      normalizedDataItem,
    );

    onClose?.();
  } catch (error) {
    console.error(
      "Add data failed:",
      error,
    );

    system.notify(
      "Unable to add data.",
    );
  }
}

export async function handleEditSubmit({
  schema,
  selectedDataItem,
  formData,
  committedDataItem,
  blankFormTemplate,
  forms,
  system,
  dataUtils,
  apis,
  setData,
  previousCenterRef,
  setCommittedDataItem,
  setSkipInitialization,
  setDraftGeometry,
  setSelectedDataItem,
  setFormData,
  setSchema,
}) {
  if (!committedDataItem?._id) return;

  const payload = dataUtils.buildUpdatePayloadFromForm(formData);

  if (!payload?._id || !payload?.updatedAt) return;

  const validation = validateDataItemPayload({
    schema,
    dataItem: payload,
    mode: "update",
  });

  if (!validation.isValid) {
    system.notify("Missing required entries or invalid fields.");
    return;
  }

  const { data: apiResponse, message } = await apis.engineApi.update(
    schema._id,
    schema.updatedAt,
    payload,
  );

  system.notify(message);

  const savedDoc = apiResponse?.data;
  if (!savedDoc?._id) return;

  applyApiSchemaMetadata({ schema, setSchema, apiResponse });

  const savedDocForClient = {
    ...savedDoc,
    userRole: "editor",
  };

  const normalizedDataItem = dataUtils.normalizeDataItem(
    schema,
    savedDocForClient,
  );

  dataUtils.updateDataItemInList(setData, normalizedDataItem);

  if (normalizedDataItem?.geometry?.type === "Point") {
    const coords = normalizedDataItem.geometry?.coordinates;

    if (Array.isArray(coords) && coords.length === 2 && previousCenterRef) {
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        previousCenterRef.current = [lat, lng];
      }
    }
  }

  if (blankFormTemplate) {
    const { formData: nextFormData } = forms.populateBlankForm({
      schema,
      blankFormTemplate,
      normalizedDataItem,
    });

    if (nextFormData) {
      setCommittedDataItem(structuredClone(nextFormData));
      setFormData?.(nextFormData);
      setSkipInitialization?.(true);
    }
  }

  setDraftGeometry?.(null);
  setSelectedDataItem(normalizedDataItem);
}

export async function handleDelete({
  schema,
  selectedDataItem,
  system,
  apis,
  dataUtils,
  setData,
  setDraftGeometry,
  setSelectedDataItem,
  setSchema,
}) {
  const dataItemId = selectedDataItem?._id;
  if (!dataItemId || !selectedDataItem?.updatedAt || !schema?.updatedAt) return;

  const confirmed = await system.confirm({
    message: "Are you sure you want to delete this data item?",
    confirmText: "Delete",
    cancelText: "Cancel",
  });

  if (!confirmed) return;

  const { data: apiResponse, message } = await apis.engineApi.remove(
    dataItemId,
    schema._id,
    schema.updatedAt,
    selectedDataItem.updatedAt,
  );

  notifyLines(system, message);

  const deletedId = apiResponse?.data?._id;
  if (!deletedId) return;
  if (String(deletedId) !== String(dataItemId)) return;

  const deletedLayer = Number(selectedDataItem.layer || 1);

  if (deletedLayer === 1) {
    dataUtils.removeDataItemsFromList(setData, (item) => {
      if (String(item?._id) === String(dataItemId)) {
        return true;
      }

      return (
        Number(item?.layer) === 2 &&
        String(item?.parentDataItemId) === String(dataItemId)
      );
    });
  } else {
    dataUtils.removeDataItemFromList(setData, dataItemId);
  }

  applyApiSchemaMetadata({ schema, setSchema, apiResponse });

  setDraftGeometry?.(null);
  setSelectedDataItem(null);
}
