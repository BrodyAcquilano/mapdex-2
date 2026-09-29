// src/boundaries/utils/blankBoundaryFromSchema.js

/*
 * Boundary counterparts to src/forms/blankFormFromSchema.js and
 * populateBlankForm.js. Boundaries live in their own collection with
 * their own create payload, and are shared by both the Aggregates and
 * Layers pages, so they get their own template rather than being folded
 * into either feature's own.
 */
export function blankBoundaryFromSchema(schema, defaultColors) {
  if (!schema) return null;

  return {
    _id: null,
    projectId: schema._id ?? null,
    name: "",
    fillColor: defaultColors?.fillColor ?? null,
    borderColor: defaultColors?.borderColor ?? null,
    geometry: null,
    createdAt: null,
    updatedAt: null,
  };
}

export function populateBlankBoundary({ blankBoundaryTemplate, boundary }) {
  if (!blankBoundaryTemplate) return { boundaryData: null };
  if (!boundary) return { boundaryData: structuredClone(blankBoundaryTemplate) };

  const populated = structuredClone(blankBoundaryTemplate);

  populated._id = boundary._id ?? null;
  populated.projectId = boundary.projectId ?? populated.projectId;
  populated.name = boundary.name || "";
  populated.fillColor = boundary.fillColor || populated.fillColor;
  populated.borderColor = boundary.borderColor || populated.borderColor;

  populated.geometry = boundary.geometry ? structuredClone(boundary.geometry) : null;

  populated.createdAt = boundary.createdAt ?? null;
  populated.updatedAt = boundary.updatedAt ?? null;

  return { boundaryData: populated };
}
