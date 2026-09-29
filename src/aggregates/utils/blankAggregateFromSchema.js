// src/aggregates/utils/blankAggregateFromSchema.js

import { AGGREGATE_TOOL_LIMITS } from "../../../shared/validation/validationConstants.js";

/*
 * The aggregate counterpart to src/forms/blankFormFromSchema.js - one
 * blank, fully-shaped aggregate object built from the project's own
 * schema, held in the engine runtime as `blankAggregateTemplate` and
 * rebuilt only when the project changes (same useMemo keying on
 * schema._id/configUpdatedAt the form template already uses).
 *
 * Every field an aggregate can carry is present here, so the Add
 * workflow and the edit panel both start from a complete object rather
 * than assembling one key at a time - which is what keeps them lined
 * up with validateCreateAggregatePayload's own exact-keys check, since
 * a missing *or* extra key is rejected outright.
 *
 * `schema` is accepted for symmetry with blankFormFromSchema (and so
 * this can grow schema-driven defaults later); nothing in an
 * aggregate's own shape depends on the schema today, unlike a form's,
 * whose sections/inputs mirror it directly.
 */
export function blankAggregateFromSchema(schema) {
  if (!schema) return null;

  return {
    _id: null,
    projectId: schema._id ?? null,
    name: "",
    description: "",
    fillColor: AGGREGATE_TOOL_LIMITS.defaultColors.fillColor,
    borderColor: AGGREGATE_TOOL_LIMITS.defaultColors.borderColor,
    boundaryId: null,
    boundaryFilterType: AGGREGATE_TOOL_LIMITS.defaultBoundaryFilterType,
    filterState: {},
    fields: [],
    opacity: AGGREGATE_TOOL_LIMITS.defaultOpacity,
    visible: true,
    order: null,
    createdAt: null,
    updatedAt: null,
  };
}

/*
 * The boundary counterpart lives in src/boundaries/utils/
 * blankBoundaryFromSchema.js - boundaries are shared by the Aggregates
 * and Layers pages, so nothing boundary-specific belongs here.
 */
