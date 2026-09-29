// src/layers/utils/computeLayerMembers.js

import { buildFilterableInputs } from "../../filters/buildFilterableInputs.js";
import { getActiveFilters } from "../../filters/filterActivity.js";
import { matchesAllActiveFilters } from "../../filters/matchesFilters.js";

const CORRIDOR_INELIGIBLE_GEOMETRY_TYPES = ["Point", "MultiPoint"];

/*
 * A corridor represents something linear a single point has no extent
 * to participate in, so Point/MultiPoint items never belong to a
 * corridor layer no matter what its filterState says. This is enforced
 * every time membership is recomputed rather than by validating stored
 * data: a layer's membership is a live re-filter of the current
 * dataset, never a frozen list, so a point that only starts matching a
 * corridor layer's filterState later could not have been blocked at
 * save time either.
 *
 * The FilterPanel's own "Geometry Types" checkboxes (src/filters/
 * geometry/Geometry.jsx) can already exclude points up front, and
 * usually will - this stays as the backstop for the case where they
 * aren't unchecked, and is what lets the Add Corridor workflow show the
 * exclusion on the map from the moment the tool is picked rather than
 * only once the layer is saved.
 */
export function isCorridorEligibleDataItem(dataItem) {
  return !CORRIDOR_INELIGIBLE_GEOMETRY_TYPES.includes(dataItem?.geometry?.type);
}

export function excludeCorridorIneligibleData(data) {
  return (Array.isArray(data) ? data : []).filter(isCorridorEligibleDataItem);
}

/*
 * Whether a project can host a corridor layer at all - a project whose
 * schema only allows Point/MultiPoint has nothing a corridor could ever
 * be built from, so its Add Corridor tool is disabled outright
 * (LayersToolMenu.jsx) rather than letting a user filter their way to a
 * guaranteed-empty layer.
 */
export function schemaSupportsCorridorLayers(schema) {
  const types = schema?.geometry?.types;

  if (!Array.isArray(types)) return true;

  return types.some((type) => !CORRIDOR_INELIGIBLE_GEOMETRY_TYPES.includes(type));
}

/*
 * A saved layer stores the *filter* that defines it (`filterState`),
 * not a frozen list of ids - see the matching comment in shared/
 * validation/layerValidation.js's own isValidFilterState. This is the
 * one place that turns a layer's stored filterState back into the
 * data items currently matching it, by reusing the exact same
 * client-side filter engine (buildFilterableInputs/getActiveFilters/
 * matchesAllActiveFilters) GlobalRuntime.jsx already runs for the
 * ordinary live filteredData - so a layer never goes stale: a new data
 * item that happens to satisfy the same filter shows up in the layer
 * automatically, with no need to re-save it.
 *
 * `data` must already be normalized (dataUtils.normalizeData) -
 * matchesAllActiveFilters reads each item's own sectionById/inputById
 * Maps, which only exist after normalization. runtime.data already is
 * (see MainApp.jsx's own "Fetch Data" effect), so callers should pass
 * that, not raw API data.
 */
/*
 * `boundariesById` is a Map of boundary id -> boundary document, needed
 * only so the geometry filter can resolve a stored boundaryId.
 *
 * There is no separate spatial clip stage any more. A layer's boundary
 * lives inside its own filterState.geometry now, so the clip is simply
 * part of the ordinary filter pass - one source of truth, one place it
 * is applied. This used to take a resolved `boundaryGeometry` and run
 * clipDataToBoundary before the filters, back when a layer stored its
 * boundary separately from the filterState and the two had to be
 * stacked in a defined order.
 */
export function getLayerMatchingData(
  layer,
  data,
  schema,
  filterTimeZone,
  boundariesById,
) {
  const safeData = Array.isArray(data) ? data : [];

  /* See isCorridorEligibleDataItem's own comment above. */
  const corridorFiltered =
    layer?.classification === "Corridor"
      ? excludeCorridorIneligibleData(safeData)
      : safeData;

  if (!layer?.filterState || !schema) return corridorFiltered;

  const filterableInputs = buildFilterableInputs(schema);
  const activeFilters = getActiveFilters(filterableInputs, layer.filterState, false);

  if (activeFilters.length === 0) return corridorFiltered;

  return corridorFiltered.filter((dataItem) =>
    matchesAllActiveFilters({
      dataItem,
      activeFilters,
      filterState: layer.filterState,
      schema,
      filterTimeZone,
      boundariesById,
    }),
  );
}
