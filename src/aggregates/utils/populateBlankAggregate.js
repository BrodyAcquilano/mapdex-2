// src/aggregates/utils/populateBlankAggregate.js

import { AGGREGATE_TOOL_LIMITS } from "../../../shared/validation/validationConstants.js";

/*
 * The aggregate counterpart to src/forms/populateBlankForm.js - copies
 * a saved aggregate's own values onto a fresh clone of
 * blankAggregateTemplate, so the result always has every key the
 * template defines even when the saved document predates one of them.
 *
 * That last part is the point: an aggregate saved before boundaryFilterType
 * existed has no such field, and reading it straight off the document
 * would put `undefined` into an edit payload that
 * validateUpdateAggregatePayload then rejects. Falling back to the
 * template's own default here is what keeps older aggregates editable.
 */
export function populateBlankAggregate({ blankAggregateTemplate, aggregate }) {
  if (!blankAggregateTemplate) return { aggregateData: null };
  if (!aggregate) return { aggregateData: structuredClone(blankAggregateTemplate) };

  const populated = structuredClone(blankAggregateTemplate);

  populated._id = aggregate._id ?? null;
  populated.projectId = aggregate.projectId ?? populated.projectId;
  populated.name = aggregate.name || "";
  populated.description = aggregate.description || "";

  populated.fillColor = aggregate.fillColor || populated.fillColor;
  populated.borderColor = aggregate.borderColor || populated.borderColor;

  populated.boundaryId = aggregate.boundaryId ?? null;

  populated.boundaryFilterType = AGGREGATE_TOOL_LIMITS.boundaryFilterTypeOptions.includes(
    aggregate.boundaryFilterType,
  )
    ? aggregate.boundaryFilterType
    : AGGREGATE_TOOL_LIMITS.defaultBoundaryFilterType;

  populated.filterState =
    aggregate.filterState && typeof aggregate.filterState === "object"
      ? structuredClone(aggregate.filterState)
      : {};

  populated.fields = Array.isArray(aggregate.fields)
    ? structuredClone(aggregate.fields)
    : [];

  populated.opacity = Number.isFinite(Number(aggregate.opacity))
    ? Number(aggregate.opacity)
    : populated.opacity;

  populated.visible = aggregate.visible !== false;
  populated.order = aggregate.order ?? null;

  populated.createdAt = aggregate.createdAt ?? null;
  populated.updatedAt = aggregate.updatedAt ?? null;

  return { aggregateData: populated };
}

/*
 * populateBlankBoundary lives in src/boundaries/utils/
 * blankBoundaryFromSchema.js alongside its own template builder - see
 * that file's comment on why boundaries aren't part of this feature.
 */
