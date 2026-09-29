// src/layers/utils/blankLayerFromSchema.js

import { LAYER_TOOL_LIMITS } from "../../../shared/validation/validationConstants.js";

/*
 * The layer counterpart to src/forms/blankFormFromSchema.js - one
 * blank, fully-shaped layer object built from the project's own schema,
 * held in the engine runtime as `blankLayerTemplate` and rebuilt only
 * when the project changes (same useMemo keying the form template
 * already uses).
 *
 * `classification` is left null deliberately: it's set by which Add
 * tool builds the layer (Add Patch Layer vs. Add Corridor Layer) and is
 * immutable afterward, so there is no sensible default to bake in here.
 *
 * `schema` is accepted for symmetry with blankFormFromSchema (and so
 * this can grow schema-driven defaults later); nothing in a layer's own
 * shape depends on the schema today.
 */
export function blankLayerFromSchema(schema) {
  if (!schema) return null;

  return {
    _id: null,
    projectId: schema._id ?? null,
    name: "",
    description: "",
    classification: null,
    fillColor: LAYER_TOOL_LIMITS.defaultColors.fillColor,
    borderColor: LAYER_TOOL_LIMITS.defaultColors.borderColor,
    /* Optional - null means the layer is built from the whole dataset. */
    boundaryId: null,
    boundaryFilterType: LAYER_TOOL_LIMITS.defaultBoundaryFilterType,
    filterState: {},
    opacity: LAYER_TOOL_LIMITS.defaultOpacity,
    visible: true,
    order: null,
    createdAt: null,
    updatedAt: null,
  };
}
