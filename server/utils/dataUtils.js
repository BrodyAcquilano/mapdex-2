// server/utils/dataUtils.js

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanInputForStorage(schemaInput, input) {
  if (!schemaInput || !input) return null;

  const { type, displayIfEmpty, displayWhenFalse } = schemaInput;

  if (
    type === "text" ||
    type === "notes" ||
    type === "phoneNumber" ||
    type === "website" ||
    type === "email" ||
    type === "dropdown"
  ) {
    const value = input.value;
    const isEmpty = value === "" || value == null;

    if (isEmpty && !displayIfEmpty) {
      return null;
    }

    return clone(input);
  }

  if (type === "number" || type === "percentage" || type === "capacity") {
    const allowedModes = Array.isArray(schemaInput.modeOptions)
      ? schemaInput.modeOptions
      : [];

    const mode = input.mode;
    const isEmpty = mode == null || mode === "" || !allowedModes.includes(mode);

    if (isEmpty && !displayIfEmpty) {
      return null;
    }

    return clone(input);
  }

  if (type === "checkbox") {
    const value = input.value;

    if (value === false && displayWhenFalse === "none") {
      return null;
    }

    return clone(input);
  }

  if (type === "priceRangeArray") {
    const rawCategories = isPlainObject(input.categories)
      ? input.categories
      : {};

    const cleanedCategories = {};

    for (const [rawCategory, rawRows] of Object.entries(rawCategories)) {
      const category =
        typeof rawCategory === "string"
          ? rawCategory.trim().replace(/\s+/g, " ")
          : "";

      if (!category) continue;
      if (!Array.isArray(rawRows) || rawRows.length === 0) continue;

      cleanedCategories[category] = clone(rawRows);
    }

    const isEmpty = Object.keys(cleanedCategories).length === 0;

    if (isEmpty && !displayIfEmpty) {
      return null;
    }

    return {
      ...clone(input),
      categories: cleanedCategories,
    };
  }

  if (type === "ageRange") {
    const allowedModes = Array.isArray(schemaInput.ageModeOptions)
      ? schemaInput.ageModeOptions
      : [];

    const mode = input.mode;
    const isEmpty = mode == null || mode === "" || !allowedModes.includes(mode);

    if (isEmpty && !displayIfEmpty) {
      return null;
    }

    return clone(input);
  }

  if (type === "hours") {
    const openHours = input.openHours;

    const isEmpty =
      !isPlainObject(openHours) ||
      !Object.values(openHours).some(
        (dayRows) =>
          Array.isArray(dayRows) &&
          dayRows.some((row) => {
            const hasOpen =
              typeof row?.open === "string" && row.open.trim() !== "";
            const hasClose =
              typeof row?.close === "string" && row.close.trim() !== "";

            return hasOpen && hasClose;
          }),
      );

    if (isEmpty && !displayIfEmpty) {
      return null;
    }

    return clone(input);
  }

  if (type === "tagList") {
    const tags = Array.isArray(input.tags)
      ? input.tags.filter((tag) => typeof tag === "string" && tag.trim() !== "")
      : [];

    const isEmpty = tags.length === 0;

    if (isEmpty && !displayIfEmpty) {
      return null;
    }

    return {
      ...clone(input),
      tags,
    };
  }

  return clone(input);
}

function buildStandardSectionFields(schemaSection, formSection) {
  const formInputs = Array.isArray(formSection?.inputs)
    ? formSection.inputs
    : [];

  const cleanedInputs = formInputs.reduce((acc, input, inputIndex) => {
    const schemaInput = schemaSection?.inputs?.[inputIndex];
    if (!schemaInput) return acc;

    const cleanedInput = cleanInputForStorage(schemaInput, input);
    if (cleanedInput) acc.push(cleanedInput);

    return acc;
  }, []);

  if (!cleanedInputs.length) return null;

  return {
    ...clone(formSection),
    inputs: cleanedInputs,
  };
}

function buildCheckboxGateSectionFields(schemaSection, formSection) {
  const schemaInputs = Array.isArray(schemaSection?.inputs)
    ? schemaSection.inputs
    : [];

  const formInputs = Array.isArray(formSection?.inputs)
    ? formSection.inputs
    : [];

  const primaryInputKeys = Array.isArray(
    schemaSection?.checkboxGateConfig?.primaryInputKeys,
  )
    ? schemaSection.checkboxGateConfig.primaryInputKeys
    : [];

  const secondaryInputMap = isPlainObject(
    schemaSection?.checkboxGateConfig?.secondaryInputMap,
  )
    ? schemaSection.checkboxGateConfig.secondaryInputMap
    : {};

  const schemaInputByKey = new Map();

  for (const schemaInput of schemaInputs) {
    if (schemaInput?.inputKey) {
      schemaInputByKey.set(schemaInput.inputKey, schemaInput);
    }
  }

  const formInputByKey = new Map();

  for (let i = 0; i < formInputs.length; i += 1) {
    const schemaInput = schemaInputs[i];
    const formInput = formInputs[i];

    if (schemaInput?.inputKey) {
      formInputByKey.set(schemaInput.inputKey, formInput);
    }
  }

  const allowedSecondaryKeys = new Set();

  for (const primaryKey of primaryInputKeys) {
    const primaryFormInput = formInputByKey.get(primaryKey);
    if (primaryFormInput?.value !== true) continue;

    const secondaryKeys = Array.isArray(secondaryInputMap[primaryKey])
      ? secondaryInputMap[primaryKey]
      : [];

    for (const secondaryKey of secondaryKeys) {
      const secondarySchemaInput = schemaInputByKey.get(secondaryKey);
      if (!secondarySchemaInput) continue;
      if (secondarySchemaInput.secondaryFor !== primaryKey) continue;

      allowedSecondaryKeys.add(secondaryKey);
    }
  }

  const cleanedInputs = formInputs.reduce((acc, input, inputIndex) => {
    const schemaInput = schemaInputs[inputIndex];
    if (!schemaInput) return acc;

    const isSecondary =
      typeof schemaInput.secondaryFor === "string" &&
      schemaInput.secondaryFor.trim() !== "";

    if (isSecondary && !allowedSecondaryKeys.has(schemaInput.inputKey)) {
      return acc;
    }

    const cleanedInput = cleanInputForStorage(schemaInput, input);
    if (cleanedInput) acc.push(cleanedInput);

    return acc;
  }, []);

  if (!cleanedInputs.length) return null;

  return {
    ...clone(formSection),
    inputs: cleanedInputs,
  };
}

/*
 * On a regular update, the payload for LineString/Polygon only ever
 * carries colors (see shared/validation/lineStringValidation.js and
 * polygonValidation.js's *ForUpdate validators - coordinates and the
 * computed distance/midpoint or bbox/centroid are never resubmitted
 * that way, only add and the move/drag route send those). So those
 * two types need the incoming color fields merged onto the existing
 * stored geometry, not written wholesale in place of it, or a
 * color-only edit would silently wipe out the coordinates and every
 * computed field along with them.
 *
 * existingGeometry is only ever passed by the update routes; add
 * (and add-batch) routes have no existing document to merge onto, so
 * they omit it and this falls through to a plain clone of the full
 * incoming geometry, same as before.
 */
function cleanGeometryForStorage(formGeometry, existingGeometry) {
  if (!isPlainObject(formGeometry)) return null;

  /*
   * Unlike every other type below, Point has no *ForUpdate validator
   * (see shared/validation/dataValidation.js's own validateGeometryPayload
   * - geometryType === "Point" always calls the full validatePointGeometry,
   * regardless of mode), so a regular update's payload always carries
   * Point's complete geometry - type, coordinates, borderColor, and
   * fillColor - already validated before this function runs. Taking
   * the colors straight from formGeometry (rather than merging onto
   * existingGeometry the way LineString/Polygon/the multi- types do
   * below) is correct here for that reason - there previously was no
   * merge OR direct read, which silently dropped a Point's own colors
   * on every regular update.
   */
  if (formGeometry.type === "Point") {
    const coords = formGeometry.coordinates;

    if (!Array.isArray(coords) || coords.length !== 2) {
      return null;
    }

    const lng = Number(coords[0]);
    const lat = Number(coords[1]);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return null;
    }

    return {
      type: "Point",
      coordinates: [lng, lat],
      borderColor: formGeometry.borderColor,
      fillColor: formGeometry.fillColor,
    };
  }

  if (formGeometry.type === "LineString") {
    if (
      isPlainObject(existingGeometry) &&
      existingGeometry.type === "LineString"
    ) {
      return {
        ...clone(existingGeometry),
        lineColor: formGeometry.lineColor,
      };
    }

    return clone(formGeometry);
  }

  if (formGeometry.type === "Polygon") {
    if (
      isPlainObject(existingGeometry) &&
      existingGeometry.type === "Polygon"
    ) {
      return {
        ...clone(existingGeometry),
        borderColor: formGeometry.borderColor,
        fillColor: formGeometry.fillColor,
      };
    }

    return clone(formGeometry);
  }

  if (formGeometry.type === "MultiPoint") {
    if (
      isPlainObject(existingGeometry) &&
      existingGeometry.type === "MultiPoint"
    ) {
      return {
        ...clone(existingGeometry),
        borderColor: formGeometry.borderColor,
        fillColor: formGeometry.fillColor,
      };
    }

    return clone(formGeometry);
  }

  if (formGeometry.type === "MultiLineString") {
    if (
      isPlainObject(existingGeometry) &&
      existingGeometry.type === "MultiLineString"
    ) {
      return {
        ...clone(existingGeometry),
        lineColor: formGeometry.lineColor,
      };
    }

    return clone(formGeometry);
  }

  if (formGeometry.type === "MultiPolygon") {
    if (
      isPlainObject(existingGeometry) &&
      existingGeometry.type === "MultiPolygon"
    ) {
      return {
        ...clone(existingGeometry),
        borderColor: formGeometry.borderColor,
        fillColor: formGeometry.fillColor,
      };
    }

    return clone(formGeometry);
  }

  if (formGeometry.type) {
    return {
      type: formGeometry.type,
    };
  }

  return null;
}

function cleanMotionSamplesForStorage(samples) {
  if (!Array.isArray(samples)) return [];

  return samples
    .map((sample) => {
      if (!isPlainObject(sample)) return null;

      const lat = Number(sample.lat);
      const lng = Number(sample.lng);
      const timestampISO = sample.timestampISO;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      if (typeof timestampISO !== "string" || timestampISO.trim() === "") {
        return null;
      }

      return {
        lat,
        lng,
        timestampISO,
      };
    })
    .filter(Boolean);
}

function cleanTimeForStorage(formTime) {
  if (!isPlainObject(formTime)) return null;

  if (formTime.type === "Event") {
    const dates = Array.isArray(formTime.dates)
      ? formTime.dates.filter((row) => row?.start)
      : [];

    return {
      type: "Event",
      mode: formTime.mode,
      timezone: formTime.timezone,
      dates: clone(dates),
    };
  }

  if (formTime.type === "Motion") {
    return {
      type: "Motion",
      mode: formTime.mode,
      timezone: formTime.timezone,
      samples: cleanMotionSamplesForStorage(formTime.samples),
    };
  }

  if (formTime.type === "None") {
    return {
      type: "None",
      timezone: formTime.timezone,
    };
  }

  if (formTime.type) {
    return {
      type: formTime.type,
      timezone: formTime.timezone,
    };
  }

  return null;
}

function cleanSectionsForStorage(schema, formData) {
  if (!Array.isArray(schema?.sections) || !Array.isArray(formData?.sections)) {
    return [];
  }

  return formData.sections
    .map((formSection, sectionIndex) => {
      const schemaSection = schema.sections[sectionIndex];
      if (!schemaSection) return null;

      if (schemaSection.conditionalSection === "checkboxGate") {
        return buildCheckboxGateSectionFields(schemaSection, formSection);
      }

      return buildStandardSectionFields(schemaSection, formSection);
    })
    .filter(Boolean);
}

export function buildDataItemFieldsFromForm(
  schema,
  formData,
  { includeExtensions = false, existingGeometry = null } = {},
) {
  if (!schema || !formData) return null;

  const fields = {
    geometry: cleanGeometryForStorage(formData.geometry, existingGeometry),
    time: cleanTimeForStorage(formData.time),
    sections: cleanSectionsForStorage(schema, formData),
  };

  if (includeExtensions) {
    fields.extensions = clone(formData.extensions || {});
  }

  return fields;
}