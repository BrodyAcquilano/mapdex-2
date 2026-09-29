// src/boundaries/BoundaryPickerPanel/BoundaryPickerPanel.jsx


import {
  BOUNDARY_FILTER_TYPE_OPTIONS,
  BOUNDARY_MODE_OPTIONS,
  BOUNDARY_MODE_BBOX,
  BOUNDARY_MODE_BOUNDARY,
  DEFAULT_BOUNDARY_FILTER_TYPE,
  GEOMETRY_LIMITS,
} from "../../../shared/validation/validationConstants.js";
import { applyBoundaryModeToFilterValue } from "../../../shared/boundaries/filterBoundaryGeometry.js";
import { clampCoordStr, finalizeCoordFilterValue } from "../utils/bboxInput.js";

import "../../styles/panels.css";
import "./BoundaryPickerPanel.css";

/*
 * Everything about the geometry filter's boundary, in one place: which
 * kind of constraint it is, how it clips, and the constraint itself -
 * either a bounding box or one of the project's saved boundaries.
 *
 * It edits the geometry filter value directly (`value` in, `onChange`
 * out), which is what makes it interchangeable everywhere it appears:
 * the engines' AppAdapter hands it the live filter state, and the
 * Layers and Aggregates Add workflows hand it the same thing as their
 * first step. There is no page-specific configuration left - `hint` is
 * the only thing a caller still words for itself.
 *
 * Consolidating here was the point (Brody's own call). The bounding box
 * used to be edited in the filter panel while the boundary was picked
 * here, which let the panel express two contradictory spatial filters
 * at once; a box and a boundary do the same job, so they are now
 * alternatives chosen by one dropdown, and the filter panel only
 * displays the result.
 *
 * The rows are just the choice - no visibility or opacity controls.
 * Picking no longer paints every boundary on the map to be told apart;
 * the map shades everything OUTSIDE whichever one is picked (the same
 * GeometryFilterLayer overlay the filter panel already uses), so there
 * is only ever one shape on screen and nothing to disambiguate. The
 * opacity sliders still live on the Boundaries page's own list, where
 * several boundaries really are drawn at once.
 */
export default function BoundaryPickerPanel({
  value,
  onChange,
  boundaries,
  hint,
  heading = "Select a Boundary",
}) {
  const filterValue = value || {};
  const boundaryMode = filterValue.boundaryMode || BOUNDARY_MODE_BBOX;
  const isBBox = boundaryMode === BOUNDARY_MODE_BBOX;
  const isBoundary = boundaryMode === BOUNDARY_MODE_BOUNDARY;

  const hasNoBoundarySelected = !filterValue.boundaryId;

  /*
   * Switching mode goes through applyBoundaryModeToFilterValue so the
   * fields belonging to the mode being left are blanked - a filter must
   * never keep a stale box while pointing at a boundary.
   */
  function handleModeChange(nextMode) {
    onChange?.(applyBoundaryModeToFilterValue(filterValue, nextMode));
  }

  function handleFilterTypeChange(nextFilterType) {
    onChange?.({ ...filterValue, boundaryFilterType: nextFilterType });
  }

  function handleSelectBoundary(boundaryId) {
    onChange?.({ ...filterValue, boundaryId: boundaryId ?? null });
  }

  const maxLen = GEOMETRY_LIMITS.coordinateMaxLength;

  const axisLimits = {
    longitude: {
      min: GEOMETRY_LIMITS.longitudeMin,
      max: GEOMETRY_LIMITS.longitudeMax,
      maxLen,
    },
    latitude: {
      min: GEOMETRY_LIMITS.latitudeMin,
      max: GEOMETRY_LIMITS.latitudeMax,
      maxLen,
    },
  };

  /*
   * One bound input. `field` is "min"/"max", which is also the key into
   * `limits` holding that end's own placeholder/clamp value. A partial
   * box is a real constraint, so leaving an edge blank is expected.
   */
  function renderBoundField(axis, field) {
    const limits = axisLimits[axis];
    const inputId = `boundary-picker-${axis}-${field}`;

    return (
      <div className="inline-row">
        <label className="label-container" htmlFor={inputId}>
          {field === "min" ? "Min" : "Max"}:
        </label>

        <input
          id={inputId}
          className="value-container"
          type="text"
          inputMode="decimal"
          maxLength={maxLen}
          value={filterValue[axis]?.[field] || ""}
          onChange={(event) =>
            onChange?.({
              ...filterValue,
              [axis]: {
                ...(filterValue[axis] || {}),
                [field]: clampCoordStr(event.target.value, {
                  ...limits,
                  finalize: false,
                }),
              },
            })
          }
          onBlur={() =>
            onChange?.(finalizeCoordFilterValue(filterValue, axis, field, limits))
          }
          placeholder={String(limits[field])}
        />
      </div>
    );
  }

  return (
    <div className="panel boundary-picker-panel" role="region" aria-label={heading}>
      <div className="boundary-picker-panel-header">
        <h2>{heading}</h2>
      </div>

      {hint && <p className="boundary-picker-panel-hint">{hint}</p>}

      <div className="boundary-picker-panel-field">
        <label htmlFor="boundary-picker-mode">Boundary Mode</label>
        <select
          id="boundary-picker-mode"
          value={boundaryMode}
          onChange={(event) => handleModeChange(event.target.value)}
        >
          {BOUNDARY_MODE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {/*
        * The filter type applies to either mode - a bounding box is just
        * a rectangular boundary - so it sits above the mode-specific
        * controls rather than inside one of them.
        */}
      <div className="boundary-picker-panel-field">
        <label htmlFor="boundary-picker-filter-type">Boundary Filter Type</label>
        <select
          id="boundary-picker-filter-type"
          value={filterValue.boundaryFilterType || DEFAULT_BOUNDARY_FILTER_TYPE}
          onChange={(event) => handleFilterTypeChange(event.target.value)}
        >
          {BOUNDARY_FILTER_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {isBBox && (
        <>
          <div className="form-group">
            <label className="label-container">Longitude:</label>
            {renderBoundField("longitude", "min")}
            {renderBoundField("longitude", "max")}
          </div>

          <div className="form-group">
            <label className="label-container">Latitude:</label>
            {renderBoundField("latitude", "min")}
            {renderBoundField("latitude", "max")}
          </div>
        </>
      )}

      {isBoundary && (
        <ul className="boundary-picker-panel-list">
          <li className="boundary-picker-panel-row">
            <button
              type="button"
              className={`boundary-picker-panel-item ${hasNoBoundarySelected ? "selected" : ""}`}
              onClick={() => handleSelectBoundary(null)}
            >
              No Boundary
            </button>
          </li>

          {(boundaries || []).map((boundary) => (
            <li key={boundary._id} className="boundary-picker-panel-row">
              <button
                type="button"
                className={`boundary-picker-panel-item ${
                  String(filterValue.boundaryId) === String(boundary._id) ? "selected" : ""
                }`}
                onClick={() => handleSelectBoundary(boundary._id)}
              >
                <span
                  className="boundary-picker-panel-swatch"
                  style={{
                    backgroundColor: boundary.fillColor,
                    borderColor: boundary.borderColor,
                  }}
                />
                {boundary.name}
              </button>
            </li>
          ))}

          {(!boundaries || boundaries.length === 0) && (
            <li className="boundary-picker-panel-empty">No boundaries yet.</li>
          )}
        </ul>
      )}
    </div>
  );
}
