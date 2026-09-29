// shared/boundaries/filterBoundaryGeometry.js

import {
  GEOMETRY_LIMITS,
  BOUNDARY_MODE_BBOX,
  BOUNDARY_MODE_BOUNDARY,
  DEFAULT_BOUNDARY_FILTER_TYPE,
} from "../validation/validationConstants.js";

/*
 * Resolves a geometry filter's boundary - whichever mode it is in -
 * down to a single Polygon.
 *
 * This is the piece that makes the two modes interchangeable
 * everywhere downstream. A bounding box IS a boundary, just a
 * rectangular one, so once it is expressed as a polygon the same
 * clipping code, the same map overlay and the same export path serve
 * both modes, and "Centroid Inside"/"Fully Inside"/"Any Overlap" mean
 * the same thing against either.
 *
 * Returns null when the filter isn't constraining anything - no mode
 * chosen, a Selected Boundary with nothing picked (or an id that no
 * longer resolves), or a Bounding Box with no bounds entered. Callers
 * treat null as "no clip" rather than "nothing passes", so a boundary
 * deleted out from under a saved layer degrades instead of emptying it.
 */
function parseBound(value, min, max) {
  if (value == null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  return Math.max(min, Math.min(max, parsed));
}

/*
 * A partial box is still a real constraint - "everything north of this
 * latitude" is meaningful - so unset edges fall back to the world
 * limits rather than voiding the filter.
 */
export function bboxPolygonFromFilterValue(filterValue) {
  const lngMin = parseBound(
    filterValue?.longitude?.min,
    GEOMETRY_LIMITS.longitudeMin,
    GEOMETRY_LIMITS.longitudeMax,
  );
  const lngMax = parseBound(
    filterValue?.longitude?.max,
    GEOMETRY_LIMITS.longitudeMin,
    GEOMETRY_LIMITS.longitudeMax,
  );
  const latMin = parseBound(
    filterValue?.latitude?.min,
    GEOMETRY_LIMITS.latitudeMin,
    GEOMETRY_LIMITS.latitudeMax,
  );
  const latMax = parseBound(
    filterValue?.latitude?.max,
    GEOMETRY_LIMITS.latitudeMin,
    GEOMETRY_LIMITS.latitudeMax,
  );

  if (lngMin == null && lngMax == null && latMin == null && latMax == null) {
    return null;
  }

  const west = lngMin ?? GEOMETRY_LIMITS.longitudeMin;
  const east = lngMax ?? GEOMETRY_LIMITS.longitudeMax;
  const south = latMin ?? GEOMETRY_LIMITS.latitudeMin;
  const north = latMax ?? GEOMETRY_LIMITS.latitudeMax;

  /*
   * Counter-clockwise, closed - the GeoJSON right-hand rule Mapbox
   * follows for an outer ring.
   */
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

export function resolveFilterBoundaryGeometry(filterValue, boundariesById) {
  const mode = filterValue?.boundaryMode;

  if (mode === BOUNDARY_MODE_BBOX) {
    return bboxPolygonFromFilterValue(filterValue);
  }

  if (mode === BOUNDARY_MODE_BOUNDARY) {
    if (!filterValue?.boundaryId) return null;

    const boundary =
      boundariesById instanceof Map
        ? boundariesById.get(String(filterValue.boundaryId))
        : (boundariesById || []).find(
            (candidate) => String(candidate._id) === String(filterValue.boundaryId),
          );

    return boundary?.geometry || null;
  }

  return null;
}

/*
 * The whole world, as a polygon. The fallback every unconstrained
 * filter resolves to - see resolveFilterBoundaryShape.
 */
export function worldPolygon() {
  const west = GEOMETRY_LIMITS.longitudeMin;
  const east = GEOMETRY_LIMITS.longitudeMax;
  const south = GEOMETRY_LIMITS.latitudeMin;
  const north = GEOMETRY_LIMITS.latitudeMax;

  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

/*
 * The boundary as a DRAWABLE / EXPORTABLE shape. Unlike
 * resolveFilterBoundaryGeometry above, this NEVER returns null: there
 * is always a boundary, because an unconstrained filter is simply one
 * bounded by the world itself.
 *
 * That is what makes the rest of the system simpler (Brody's own
 * call). An export always has a boundary feature to write, an
 * aggregate always has a shape to draw, and nothing downstream needs a
 * "what if there is no boundary" branch. Rendering a whole-world
 * rectangle is more honest than rendering nothing: it is exactly what
 * the filter is saying.
 *
 * Every unconstrained case lands here: a bounding box with some, or
 * none, of its edges entered (missing edges fall back to the world
 * limits), and Selected Boundary with nothing picked or an id that no
 * longer resolves.
 *
 * Crucially this does NOT make the filter active - that stays
 * isFilterBoundaryActive's job, and an empty box or unpicked boundary
 * is still inactive, so data items are never run through a pointless
 * whole-world clip. Drawing and exporting ask a different question
 * from filtering, which is why they use a different function.
 */
export function resolveFilterBoundaryShape(filterValue, boundariesById) {
  if (filterValue?.boundaryMode === BOUNDARY_MODE_BBOX) {
    return bboxPolygonFromFilterValue(filterValue) || worldPolygon();
  }

  return resolveFilterBoundaryGeometry(filterValue, boundariesById) || worldPolygon();
}

/*
 * Whether the filter constrains anything at all. Deliberately separate
 * from resolving the geometry: a caller that only needs the yes/no (the
 * filter-activity check, which runs per render) shouldn't have to build
 * a polygon to get it.
 */
export function isFilterBoundaryActive(filterValue) {
  const mode = filterValue?.boundaryMode;

  if (mode === BOUNDARY_MODE_BBOX) {
    return (
      !!filterValue?.longitude?.min ||
      !!filterValue?.longitude?.max ||
      !!filterValue?.latitude?.min ||
      !!filterValue?.latitude?.max
    );
  }

  if (mode === BOUNDARY_MODE_BOUNDARY) {
    return !!filterValue?.boundaryId;
  }

  return false;
}

/*
 * The fields that belong to each mode, blanked for the other. Switching
 * modes goes through here so a filter can't keep a stale bounding box
 * while pointing at a boundary, or vice versa.
 */
export function applyBoundaryModeToFilterValue(filterValue, boundaryMode) {
  const base = {
    ...filterValue,
    boundaryMode,
    boundaryFilterType:
      filterValue?.boundaryFilterType || DEFAULT_BOUNDARY_FILTER_TYPE,
  };

  if (boundaryMode === BOUNDARY_MODE_BBOX) {
    return {
      ...base,
      longitude: filterValue?.longitude || { min: "", max: "" },
      latitude: filterValue?.latitude || { min: "", max: "" },
      boundaryId: null,
    };
  }

  return {
    ...base,
    longitude: null,
    latitude: null,
    boundaryId: filterValue?.boundaryId ?? null,
  };
}

/*
 * The lookup the geometry filter needs to turn a stored boundaryId
 * back into a polygon. Built once per boundaries change by callers
 * rather than per data item - filtering runs this across a whole
 * dataset.
 */
export function buildBoundariesById(boundaries) {
  return new Map((boundaries || []).map((boundary) => [String(boundary._id), boundary]));
}
