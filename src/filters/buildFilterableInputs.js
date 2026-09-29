function isExcludedFilterType(type) {
  return (
    type === "website" ||
    type === "phoneNumber" ||
    type === "email" ||
    type === "notes"
  );
}

export function buildFilterableInputs(schema) {
  if (!schema) return [];

  const result = [];

  if (schema.engineKey === "presence") {
    result.push({
      id: "userName",
      type: "userName",
      source: "user",
    });
  }

  if (
    (schema?.time?.type === "Event" ||
      schema?.time?.type === "Motion") &&
    schema?.time?.isFilter === true
  ) {
    result.push({
      id: "time",
      type: "time",
      schemaInput: schema.time,
      source: "time",
    });
  }

  if (schema.geometry?.isFilter === true) {
    result.push({
      id: "geometry",
      type: "geometry",
      schemaInput: schema.geometry,
      source: "geometry",
    });
  }

  if (!schema.sections) return result;

  for (let s = 0; s < schema.sections.length; s++) {
    const section = schema.sections[s];

    for (let i = 0; i < section.inputs.length; i++) {
      const input = section.inputs[i];

      if (isExcludedFilterType(input.type)) continue;
      if (!input.isFilter) continue;

      result.push({
        id: input.id,
        type: input.type,
        sectionIndex: s,
        inputIndex: i,
        schemaInput: input,
        source: "section",
      });
    }
  }

  return result;
}