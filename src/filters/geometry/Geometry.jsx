import {
  GEOMETRY_LIMITS,
  DEFAULT_BOUNDARY_FILTER_TYPE,
  BOUNDARY_MODE_BBOX,
  BOUNDARY_MODE_BOUNDARY,
} from "../../../shared/validation/validationConstants.js";
import { isGeometryWithinBoundary } from "../../boundaries/utils/clipToBoundary.js";
import {
  resolveFilterBoundaryGeometry,
  isFilterBoundaryActive,
} from "../../../shared/boundaries/filterBoundaryGeometry.js";

import "../../forms/inputs/Quantitative.css";

/*
 * The geometry filter has three independent parts that happen to share
 * one filterState entry:
 *
 *  - a lat/lng bounding box (the original behavior),
 *  - a set of geometry *types* to include, added later so a layer can
 *    be built from only the types that make sense for it (a corridor
 *    layer is typically lines, a patch layer typically polygons - see
 *    src/layers/), and
 *  - a saved boundary to clip to, stored as `boundaryId` plus the
 *    `boundaryFilterType` mode describing how it clips.
 *
 * They are cumulative: a box and a boundary both applied means an item
 * must satisfy both. That's deliberate, per Brody's own call - the
 * boundary is not a different *mode* of the box, it's a second,
 * independent spatial constraint.
 *
 * The boundary part is the one filter in Mapdex that can't answer for
 * itself: it stores an id, and resolving that to a real polygon needs
 * the project's boundaries, which live outside filterState entirely
 * (GlobalRuntime owns the list). So matchesGeometryFilter takes a
 * boundariesById lookup, which every caller of matchesAllActiveFilters
 * has to supply. An unresolvable id filters nothing rather than
 * filtering everything out - a boundary deleted out from under a saved
 * layer should degrade to "no boundary clip", not silently empty it.
 *
 * The type part is deliberately OR logic, unlike every other filter in
 * Mapdex (a data item must pass filter A *and* B *and* ... N). A data
 * item passes if its own single geometry type is any one of the checked
 * types - it obviously can't be all of them at once. Checkboxes rather
 * than a dropdown for exactly that reason: a dropdown could only ever
 * express one type at a time plus an "any" escape hatch, where the real
 * need is picking an arbitrary subset to include.
 *
 * `types` missing from a stored filterState means "no type filtering"
 * rather than "nothing passes" - filterStates saved before this filter
 * existed (inside saved layers and aggregates, which persist their own
 * filterState verbatim) have no `types` key at all, and must keep
 * behaving exactly as they did.
 */
function getAllowedGeometryTypes(schemaGeometry) {
  const schemaTypes = schemaGeometry?.types;

  if (Array.isArray(schemaTypes) && schemaTypes.length > 0) {
    return schemaTypes;
  }

  return GEOMETRY_LIMITS.typeOptions;
}

function getSelectedGeometryTypes(filterValue, allowedTypes) {
  const selected = filterValue?.types;

  if (!Array.isArray(selected)) {
    return allowedTypes;
  }

  return allowedTypes.filter((type) => selected.includes(type));
}

/*
 * The bespoke bounding-box containment helpers that used to live here
 * (getFilterBounds / coordinateIsWithinBounds / pointIsWithinBounds /
 * lineStringIsWithinBounds / polygonIsWithinBounds /
 * multiPolygonIsWithinBounds / geometryIsWithinBounds) are gone. A
 * bounding box is just a rectangular boundary, so it is now resolved to
 * a Polygon by filterBoundaryGeometry.js and clipped with the exact
 * same isGeometryWithinBoundary every saved boundary uses - which also
 * gives a box the three filter types it never had.
 */
/*
 * The filter panel's own geometry section.
 *
 * Everything about the boundary half is READ-ONLY here - the mode, its
 * filter type, and whichever of the bounding box or the picked boundary
 * that mode implies. All of it is edited in BoundaryPickerPanel, which
 * the Select Boundary button hands off to.
 *
 * That split is deliberate (Brody's own call): the mode and the values
 * it governs only make sense side by side, and offering the box here
 * while the boundary lived elsewhere is exactly how the panel ended up
 * able to express two contradictory spatial filters at once.
 *
 * Geometry *types* stay editable here - they're an independent filter
 * that happens to share this section, not part of the boundary at all.
 *
 * onSelectBoundary is optional: a page that hasn't wired the
 * sub-workflow up renders no boundary block rather than a dead button.
 */
export function renderGeometryFilterSection({
  schema,
  filterState,
  setFilterState,
  boundaries,
  onSelectBoundary,
}) {
  if (!schema?.geometry) return null;
  if (!schema.geometry.isFilter) return null;

  const schemaGeometry = schema.geometry;

  const filterValue =
    filterState?.geometry && typeof filterState.geometry === "object"
      ? filterState.geometry
      : createGeometryFilterState(schemaGeometry);

  const setFilterValue = (newValue) =>
    setFilterState((prev) => ({
      ...prev,
      geometry: newValue,
    }));

  const label = schemaGeometry.label || "Geometry";

  const allowedTypes = getAllowedGeometryTypes(schemaGeometry);
  const selectedTypes = getSelectedGeometryTypes(filterValue, allowedTypes);

  const toggleGeometryType = (type, isChecked) => {
    const nextTypes = isChecked
      ? allowedTypes.filter(
          (allowedType) => allowedType === type || selectedTypes.includes(allowedType),
        )
      : selectedTypes.filter((selectedType) => selectedType !== type);

    setFilterValue({ ...filterValue, types: nextTypes });
  };

  const selectedFilterBoundary = filterValue.boundaryId
    ? (boundaries || []).find(
        (boundary) => String(boundary._id) === String(filterValue.boundaryId),
      )
    : null;

  /*
   * What the boundary half currently amounts to, in one line. An
   * inactive filter says so plainly rather than showing empty fields -
   * a mode with nothing filled in constrains nothing, and the panel
   * shouldn't imply otherwise.
   */
  const renderBoundaryValue = () => {
    if (filterValue.boundaryMode === BOUNDARY_MODE_BBOX) {
      const bounds = [
        ["Longitude", filterValue.longitude],
        ["Latitude", filterValue.latitude],
      ]
        .map(([axisLabel, axis]) => {
          const min = axis?.min;
          const max = axis?.max;

          if (!min && !max) return null;

          return `${axisLabel} ${min || "-∞"} to ${max || "∞"}`;
        })
        .filter(Boolean);

      return bounds.length > 0 ? bounds.join(", ") : "No bounds set";
    }

    if (selectedFilterBoundary) return selectedFilterBoundary.name;

    return filterValue.boundaryId ? "Boundary no longer exists" : "No Boundary";
  };

  return (
    <div className="section" role="region" aria-labelledby="section-title-geometry-filter">
      <h3 id="section-title-geometry-filter">{label}</h3>

      <div className="form-group" role="group" aria-labelledby="filter-geometry-types-label">
        <span id="filter-geometry-types-label" className="label-container">
          Geometry Types:
        </span>

        {allowedTypes.map((type) => (
          <div key={type} className="inline-checkbox-row">
            <div className="checkbox-container">
              <input
                id={`filter-geometry-type-${type}`}
                type="checkbox"
                checked={selectedTypes.includes(type)}
                onChange={(e) => toggleGeometryType(type, e.target.checked)}
              />
            </div>

            <label htmlFor={`filter-geometry-type-${type}`} className="label-container">
              {type}
            </label>
          </div>
        ))}
      </div>

      {onSelectBoundary && (
        <div className="form-group">
          <div className="inline-row">
            <span className="label-container">Boundary Mode:</span>
            <span className="value-container">
              {filterValue.boundaryMode || BOUNDARY_MODE_BBOX}
            </span>
          </div>

          <div className="inline-row">
            <span className="label-container">Boundary Filter Type:</span>
            <span className="value-container">
              {filterValue.boundaryFilterType || DEFAULT_BOUNDARY_FILTER_TYPE}
            </span>
          </div>

          <div className="inline-row">
            <span className="label-container">Boundary:</span>
            <span className="value-container">{renderBoundaryValue()}</span>
          </div>

          <div className="buttons-container-two">
            <button type="button" className="clear-button" onClick={onSelectBoundary}>
              Select Boundary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function matchesGeometryFilter(
  filterValue,
  geometryData,
  boundariesById,
) {
  if (!filterValue) return true;
  if (!geometryData?.type) return false;

  /*
   * OR logic, and only over the types actually stored on the filter -
   * the allowed-types list isn't needed here, since an absent `types`
   * already means "every type passes" and a present one is the exact
   * set to include.
   */
  if (Array.isArray(filterValue.types)) {
    if (!filterValue.types.includes(geometryData.type)) {
      return false;
    }
  }

  /*
   * One path for both boundary modes: a bounding box is resolved to a
   * rectangular polygon, a selected boundary to its own, and either way
   * the same clip runs with the same filter type. null means the filter
   * isn't constraining anything - see resolveFilterBoundaryGeometry for
   * the cases that produce it.
   */
  const boundaryGeometry = resolveFilterBoundaryGeometry(filterValue, boundariesById);

  if (!boundaryGeometry) return true;

  return isGeometryWithinBoundary(
    geometryData,
    boundaryGeometry,
    filterValue.boundaryFilterType || DEFAULT_BOUNDARY_FILTER_TYPE,
  );
}

/*
 * The geometry filter's own resting state.
 *
 * boundaryMode is ALWAYS set - Bounding Box by default. There is no
 * "None" mode because neither mode needs one: a Bounding Box with no
 * bounds entered and a Selected Boundary with nothing picked each
 * already mean "no constraint", and a None option would just be a
 * third way to say what both modes can already express (Brody's own
 * call). Choosing a mode therefore says nothing about whether the
 * filter is active - only how to read that, which is what
 * isFilterBoundaryActive does.
 *
 * The fields belonging to the other mode stay null, so a stored filter
 * never carries a stale box while pointing at a boundary.
 */
export function createGeometryFilterState(schemaGeometry) {
  return {
    types: [...getAllowedGeometryTypes(schemaGeometry)],
    boundaryMode: BOUNDARY_MODE_BBOX,
    boundaryFilterType: DEFAULT_BOUNDARY_FILTER_TYPE,
    longitude: { min: "", max: "" },
    latitude: { min: "", max: "" },
    boundaryId: null,
  };
}

export function isGeometryFilterActive(value, schemaGeometry) {
  /*
   * The chosen mode decides how activity is read - a bounding box needs
   * a bound entered, a selected boundary needs one picked. See
   * isFilterBoundaryActive.
   */
  if (isFilterBoundaryActive(value)) return true;

  /*
   * Only counts as active once at least one allowed type is actually
   * excluded - the default state has every allowed type checked, which
   * filters nothing out and so must not light the panel up as an
   * applied filter or make every data item run this check for nothing.
   */
  if (!Array.isArray(value?.types)) return false;

  const allowedTypes = getAllowedGeometryTypes(schemaGeometry);

  return allowedTypes.some(
    (type) => !value.types.includes(type),
  );
}