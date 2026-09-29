// src/forms/populateBlankFormSchema.js

import { daysOfWeek } from "../../shared/validation/formValueHelpers.js";

export function populateBlankForm({
  schema,
  blankFormTemplate,
  normalizedDataItem,
}) {
  if (!schema || !blankFormTemplate || !normalizedDataItem) {
    return { formData: null };
  }

  const initializedForm = structuredClone(blankFormTemplate);

  /* --------------------------------------------------
     Copy identity + layer fields
  -------------------------------------------------- */

  initializedForm._id = normalizedDataItem._id ?? null;

  const layer = Number(normalizedDataItem.layer || 1);
  initializedForm.layer = layer;

  initializedForm.parentDataItemId =
    layer === 2 ? (normalizedDataItem.parentDataItemId ?? null) : null;

  /* --------------------------------------------------
     Copy presence user metadata
  -------------------------------------------------- */

  if (schema.engineKey === "presence") {
    initializedForm.userName = normalizedDataItem.userName || "";
  }

  /* --------------------------------------------------
     Copy geometry
  -------------------------------------------------- */

  const resolvedGeometry =
  normalizedDataItem.geometry;

if (
  resolvedGeometry?.type &&
  typeof resolvedGeometry === "object"
) {
  initializedForm.geometry =
    structuredClone(resolvedGeometry);
}

  /* --------------------------------------------------
   Copy time
-------------------------------------------------- */

  const resolvedTimeType = normalizedDataItem.time?.type;

  if (resolvedTimeType) {
    if (!initializedForm.time || typeof initializedForm.time !== "object") {
      initializedForm.time = {};
    }

    initializedForm.time.type = resolvedTimeType;
    initializedForm.time.timezone = normalizedDataItem.time?.timezone || "";

    if (resolvedTimeType === "Event") {
      initializedForm.time.mode = normalizedDataItem.time?.mode;

      initializedForm.time.dates = Array.isArray(normalizedDataItem.time?.dates)
        ? structuredClone(normalizedDataItem.time.dates)
        : [];
    }

    if (resolvedTimeType === "Motion") {
      initializedForm.time.mode =
        normalizedDataItem.time?.mode ?? initializedForm.time.mode;

      initializedForm.time.samples = Array.isArray(
        normalizedDataItem.time?.samples,
      )
        ? structuredClone(normalizedDataItem.time.samples)
        : [];
    }
  }

  /* --------------------------------------------------
     Copy section + input values from a normalized data item
  -------------------------------------------------- */

  for (const dataSection of normalizedDataItem.sections || []) {
    const sectionIndex = normalizedDataItem.sectionIndexById?.get(
      dataSection.id,
    );

    if (sectionIndex == null) continue;

    for (const dataInput of dataSection.inputs || []) {
      const loc = normalizedDataItem.inputIndexById?.get(dataInput.id);
      if (!loc) continue;

      const { sectionIndex: sIdx, inputIndex: iIdx } = loc;

      const formInput = initializedForm.sections?.[sIdx]?.inputs?.[iIdx];
      if (!formInput) continue;

      const schemaInput = schema.sections?.[sIdx]?.inputs?.[iIdx];
      if (!schemaInput) continue;

      if (schemaInput.type === "dropdown") {
        const value = dataInput.value;

        if (value === "") {
          formInput.value = "";
        } else if (schemaInput.options?.includes(value)) {
          formInput.value = value;
        } else {
          formInput.value = schemaInput.isRequired
            ? schemaInput.options?.[0] || ""
            : "";
        }

        continue;
      }

      if (schemaInput.type === "checkbox") {
        formInput.value = dataInput.value === true;

        if (schemaInput.isApplicableOption === true) {
          formInput.isApplicable =
            dataInput.isApplicable === false ? false : true;
        }

        continue;
      }

      if (schemaInput.type === "hours") {
        const incoming = dataInput.openHours;

        if (incoming && typeof incoming === "object") {
          formInput.openHours = Object.fromEntries(
            daysOfWeek.map((day) => [
              day,
              Array.isArray(incoming[day])
                ? structuredClone(incoming[day])
                : [],
            ]),
          );
        }

        continue;
      }

      if (
        schemaInput.type === "number" ||
        schemaInput.type === "percentage" ||
        schemaInput.type === "capacity"
      ) {
        const modes = Array.isArray(schemaInput.modeOptions)
          ? schemaInput.modeOptions
          : schemaInput.type === "capacity"
            ? ["Single Value", "Min-Max Range"]
            : ["Single Value", "Min-Max Range", "Min Only", "Max Only"];

        const mode =
          dataInput?.mode === "" || dataInput?.mode == null
            ? ""
            : modes.includes(dataInput.mode)
              ? dataInput.mode
              : "";

        formInput.mode = mode;
        formInput.singleValue =
          mode === "Single Value" ? (dataInput.singleValue ?? null) : null;
        formInput.min =
          mode === "Min-Max Range" || mode === "Min Only"
            ? (dataInput.min ?? null)
            : null;
        formInput.max =
          mode === "Min-Max Range" || mode === "Max Only"
            ? (dataInput.max ?? null)
            : null;

        continue;
      }

      if (schemaInput.type === "ageRange") {
        const modes = Array.isArray(schemaInput.ageModeOptions)
          ? schemaInput.ageModeOptions
          : ["All Ages", "Min-Max Range", "Min Only", "Max Only"];

        const mode =
          dataInput?.mode === "" || dataInput?.mode == null
            ? ""
            : modes.includes(dataInput.mode)
              ? dataInput.mode
              : "";

        formInput.mode = mode;
        formInput.min =
          mode === "Min-Max Range" || mode === "Min Only"
            ? (dataInput.min ?? null)
            : null;
        formInput.max =
          mode === "Min-Max Range" || mode === "Max Only"
            ? (dataInput.max ?? null)
            : null;

        continue;
      }

      if (schemaInput.type === "priceRangeArray") {
        const incomingCategories = dataInput.categories;

        formInput.categories =
          incomingCategories &&
          typeof incomingCategories === "object" &&
          !Array.isArray(incomingCategories)
            ? structuredClone(incomingCategories)
            : {};

        continue;
      }

      if (schemaInput.type === "tagList") {
        formInput.tags = Array.isArray(dataInput.tags)
          ? structuredClone(dataInput.tags)
          : [];
        continue;
      }

      formInput.value = dataInput.value;
    }
  }

  /* --------------------------------------------------
     Copy extensions
  -------------------------------------------------- */

  const incomingExtensions = normalizedDataItem.extensions;

  if (incomingExtensions && typeof incomingExtensions === "object") {
    for (const [id, value] of Object.entries(incomingExtensions)) {
      if (id in initializedForm.extensions) {
        initializedForm.extensions[id] = value;
      }
    }
  }

  /* --------------------------------------------------
     Copy timestamps
  -------------------------------------------------- */

  initializedForm.createdAt = normalizedDataItem.createdAt ?? null;
  initializedForm.updatedAt = normalizedDataItem.updatedAt ?? null;

  return {
    formData: initializedForm,
  };
}
