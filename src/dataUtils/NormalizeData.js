export function normalizeData(schema, rawData) {
  const normalizedData = [];

  if (!Array.isArray(rawData)) {
    return normalizedData;
  }

  for (const rawDataItem of rawData) {
    const normalizedDataItem = normalizeDataItem(schema, rawDataItem);
    if (!normalizedDataItem) continue;

    normalizedData.push(normalizedDataItem);
  }

  return normalizedData;
}

export function normalizeDataItem(schema, rawDataItem) {
  const schemaSections = Array.isArray(schema?.sections) ? schema.sections : [];
  if (!rawDataItem) return null;

  const rawSections = Array.isArray(rawDataItem.sections)
    ? rawDataItem.sections
    : [];

  const rawSectionById = new Map();
  for (const section of rawSections) {
    if (section?.id != null) {
      rawSectionById.set(section.id, section);
    }
  }

  const normalizedSections = [];
  const sectionIndexById = new Map();
  const inputIndexById = new Map();

  let remainingSections = rawSectionById.size;

  for (let sectionIndex = 0; sectionIndex < schemaSections.length; sectionIndex++) {
    if (remainingSections === 0) break;

    const schemaSection = schemaSections[sectionIndex];
    sectionIndexById.set(schemaSection.id, sectionIndex);

    const dataSection = rawSectionById.get(schemaSection.id);
    if (!dataSection) continue;

    remainingSections--;

    const rawInputs = Array.isArray(dataSection.inputs)
      ? dataSection.inputs
      : [];

    const rawInputById = new Map();
    for (const input of rawInputs) {
      if (input?.id != null) {
        rawInputById.set(input.id, input);
      }
    }

    const normalizedInputs = [];
    const inputById = new Map();

    let remainingInputs = rawInputById.size;
    const schemaInputs = Array.isArray(schemaSection.inputs)
      ? schemaSection.inputs
      : [];

    for (let inputIndex = 0; inputIndex < schemaInputs.length; inputIndex++) {
      if (remainingInputs === 0) break;

      const schemaInput = schemaInputs[inputIndex];

      inputIndexById.set(schemaInput.id, {
        sectionIndex,
        inputIndex,
      });

      const dataInput = rawInputById.get(schemaInput.id);
      if (!dataInput) continue;

      remainingInputs--;

      const normalizedInput = structuredClone(dataInput);
      normalizedInputs.push(normalizedInput);
      inputById.set(dataInput.id, normalizedInput);
    }

    if (normalizedInputs.length === 0) continue;

    normalizedSections.push({
      id: schemaSection.id,
      inputs: normalizedInputs,
      inputById,
    });
  }

  const sectionById = new Map();
  for (const section of normalizedSections) {
    sectionById.set(section.id, section);
  }

  return {
    ...rawDataItem,
    sections: normalizedSections,
    sectionById,
    sectionIndexById,
    inputIndexById,
  };
}
