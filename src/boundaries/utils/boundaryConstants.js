// src/boundaries/utils/boundaryConstants.js

import { BOUNDARY_TOOL_LIMITS } from "../../../shared/validation/validationConstants.js";

export const BOUNDARY_NAME_MAX_LENGTH = BOUNDARY_TOOL_LIMITS.nameMaxLength;

/*
 * The color a brand-new boundary starts with in AggregateEditPanel.jsx's
 * own Add Boundary form (mode="add") - just a starting point the user
 * can change before saving, same role DEFAULT_AGGREGATE_COLORS plays
 * for a new aggregate. Distinct from DEFAULT_BOUNDARY_DISPLAY_COLORS
 * below, which is a map-rendering FALLBACK for a boundary that has no
 * stored color at all (e.g. one created before boundaries had their
 * own color field).
 */
export const DEFAULT_BOUNDARY_COLORS = {
  fillColor: "#0ea5e9",
  borderColor: "#0369a1",
};

/*
 * Map-rendering fallback for a boundary with no stored fillColor/
 * borderColor of its own - used on the Aggregates page's Boundaries
 * tab/mode, and for the Add Aggregate workflow's own "pick a boundary"
 * preview (every boundary shown the same neutral color there, since
 * that view is about picking a boundary by name, not telling them
 * apart visually). A boundary's own real color, once it has one, is
 * purely a display convenience for telling several boundaries apart on
 * the map - it's unrelated to any aggregate built on it, which always
 * uses its own fillColor/borderColor instead (see
 * validationConstants.js's own BOUNDARY_TOOL_LIMITS comment).
 */
export const DEFAULT_BOUNDARY_DISPLAY_COLORS = {
  fillColor: "#6b7280",
  borderColor: "#374151",
};
