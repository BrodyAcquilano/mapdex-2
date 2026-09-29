import { sanitizePolygonGeometry } from "../../../shared/validation/polygonValidation.js";
import { sanitizeLineStringGeometry } from "../../../shared/validation/lineStringValidation.js";
import { sanitizeMultiPointGeometry } from "../../../shared/validation/multiPointValidation.js";
import { sanitizeMultiLineStringGeometry } from "../../../shared/validation/multiLineStringValidation.js";
import { sanitizeMultiPolygonGeometry } from "../../../shared/validation/multiPolygonValidation.js";
import { GEOMETRY_LIMITS } from "../../../shared/validation/validationConstants.js";

const DEFAULT_LINE_COLOR = "#3388ff";
const DEFAULT_BORDER_COLOR = "#2563eb";
const DEFAULT_FILL_COLOR = "#3b82f6";

const DEFAULT_POINT_BORDER_COLOR = "#1d4ed8";

function coordinatesEqual(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a[0] === b[0] &&
    a[1] === b[1]
  );
}

function isValidCoordinate(coordinate) {
  return (
    Array.isArray(coordinate) &&
    coordinate.length === 2 &&
    Number.isFinite(Number(coordinate[0])) &&
    Number.isFinite(Number(coordinate[1]))
  );
}

function orientation(a, b, c) {
  const value =
    (b[0] - a[0]) * (c[1] - a[1]) -
    (b[1] - a[1]) * (c[0] - a[0]);

  if (Math.abs(value) < 1e-12) {
    return 0;
  }

  return value > 0 ? 1 : -1;
}

function onSegment(a, b, c) {
  return (
    b[0] >= Math.min(a[0], c[0]) &&
    b[0] <= Math.max(a[0], c[0]) &&
    b[1] >= Math.min(a[1], c[1]) &&
    b[1] <= Math.max(a[1], c[1])
  );
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;

  return false;
}

/*
 * Returns a copy of `points` with longitudes "unwrapped" - shifted by
 * whole multiples of 360 wherever two consecutive points jump by more
 * than 180 degrees - so a path that crosses the antimeridian (e.g.
 * 179 -> -179, an actual ~2 degree step) reads as a short, locally
 * continuous line instead of the ~358 degree jump the raw coordinates
 * would otherwise represent. orientation/segmentsIntersect below are
 * plain planar (Cartesian) geometry with no native concept of
 * longitude wrapping, so this is what keeps polygonRingSelfIntersects/
 * wouldPolygonCandidateIntersect from misreading a real antimeridian
 * crossing as a self-intersecting shape - per Brody's own call, a
 * front-end-only draw-tool concern (self-intersection is never
 * validated server-side - see shared/validation/polygonValidation.js's
 * own comment), so this only ever affects this in-memory math, never
 * what's actually computed/stored (coordinates, and the bbox/centroid
 * derived from them, stay exactly as shared/validation/*.js already
 * compute them everywhere else).
 */
function unwrapRingLongitudes(points) {
  if (!Array.isArray(points) || points.length === 0) return [];

  let offset = 0;
  const unwrapped = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const previousLng = points[i - 1][0];
    const currentPoint = points[i];

    const delta = currentPoint[0] - previousLng;

    if (delta > 180) {
      offset -= 360;
    } else if (delta < -180) {
      offset += 360;
    }

    unwrapped.push([currentPoint[0] + offset, currentPoint[1]]);
  }

  return unwrapped;
}

function getOpenPolygonRing(geometry) {
  const ring = geometry?.coordinates?.[0];

  if (!Array.isArray(ring)) {
    return [];
  }

  if (
    ring.length >= 2 &&
    coordinatesEqual(ring[0], ring[ring.length - 1])
  ) {
    return ring.slice(0, -1);
  }

  return ring;
}

export function polygonRingSelfIntersects(ring) {
  if (ring.length < 3) {
    return true;
  }

  const closedRing = unwrapRingLongitudes([
    ...ring,
    ring[0],
  ]);

  const segmentCount = closedRing.length - 1;

  for (let i = 0; i < segmentCount; i += 1) {
    const a = closedRing[i];
    const b = closedRing[i + 1];

    for (let j = i + 1; j < segmentCount; j += 1) {
      const adjacent =
        j === i + 1;

      const firstAndLast =
        i === 0 &&
        j === segmentCount - 1;

      if (
        adjacent ||
        firstAndLast
      ) {
        continue;
      }

      const c = closedRing[j];
      const d = closedRing[j + 1];

      if (
        segmentsIntersect(
          a,
          b,
          c,
          d,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

export function createDraftGeometry(geometryTool) {
  if (geometryTool === "point") {
    return {
      type: "Point",
      coordinates: [],
      borderColor: DEFAULT_BORDER_COLOR,
      fillColor: DEFAULT_FILL_COLOR,
    };
  }

  if (geometryTool === "line") {
    return {
      type: "LineString",
      coordinates: [],
      lineColor: DEFAULT_LINE_COLOR,
    };
  }

  if (geometryTool === "polygon") {
    return {
      type: "Polygon",
      coordinates: [[]],
      bbox: null,
      centroid: null,
      borderColor: DEFAULT_BORDER_COLOR,
      fillColor: DEFAULT_FILL_COLOR,
    };
  }

  /*
   * MultiPoint has no "parts" concept the way MultiLineString/
   * MultiPolygon do below - every click just appends one more point
   * to this single flat array, the same as a LineString draft's own
   * coordinates, just rendered as separate dots instead of a
   * connected line. No "end part" button is needed for it.
   */
  if (geometryTool === "multipoint") {
    return {
      type: "MultiPoint",
      coordinates: [],
      bbox: null,
      centroid: null,
      borderColor: DEFAULT_BORDER_COLOR,
      fillColor: DEFAULT_FILL_COLOR,
    };
  }

  /*
   * A MultiLineString/MultiPolygon draft's own coordinates hold one
   * entry per part (line/polygon), same shape their final stored
   * geometry uses, with the LAST entry always the "current" part
   * still being clicked into - see getCurrentDraftPart/
   * commitCurrentDraftPart below. Starts with exactly one (empty)
   * part, the same way a plain LineString/Polygon draft starts with
   * one empty coordinates/ring array.
   */
  if (geometryTool === "multiline") {
    return {
      type: "MultiLineString",
      coordinates: [[]],
      bbox: null,
      centroid: null,
      lineColor: DEFAULT_LINE_COLOR,
    };
  }

  if (geometryTool === "multipolygon") {
    return {
      type: "MultiPolygon",
      coordinates: [[[]]],
      bbox: null,
      centroid: null,
      borderColor: DEFAULT_BORDER_COLOR,
      fillColor: DEFAULT_FILL_COLOR,
    };
  }

  return null;
}

/*
 * Converts an already-saved geometry of ANY of the 6 types into the
 * draft the "add sub-geometry" edit tool starts from - re-entering a
 * draw-like workflow that adds a whole new point/line/polygon onto
 * what's already there, rather than editing an existing vertex. A
 * plain Point/LineString/Polygon is promoted to its Multi- equivalent
 * (its own single item becomes "part 0"); an already-Multi geometry
 * keeps every one of its own existing parts untouched. Either way, a
 * fresh empty "current" part/slot is appended, ready for the next
 * click to build into - MultiLineString/MultiPolygon parts follow
 * createDraftGeometry's own "[]"/"[[]]" empty-part convention above;
 * MultiPoint has no parts concept at all (see that same comment), so
 * nothing extra is appended there - the next click just appends
 * directly, the same as always.
 *
 * Deliberately never pushes anything onto geometryEditHistory itself -
 * the caller (each map library's own GeometryLayer.jsx, right where
 * selecting an item with this tool sets draftGeometry to this
 * function's own return value) treats this converted draft as the
 * undo floor: every click that adds a new vertex/part afterward pushes
 * a history snapshot first (mirroring every other edit tool), so
 * repeatedly pressing Back can only ever undo what THIS session added,
 * landing back on exactly this converted-but-unmodified state and no
 * further - the original geometry's own points/lines/polygons are
 * never reachable to remove through this tool (that's what the
 * separate Remove/Remove Sub-Geometry tools are for).
 *
 * A Polygon's own coordinates ([ring], already closed) and a
 * MultiPolygon's own individual part (also [ring], already closed -
 * see moveMultiVertex's own comment) share the exact same shape, so
 * cloning either directly into a MultiPolygon part needs no reshaping;
 * same idea for LineString's flat coordinates matching a
 * MultiLineString part directly.
 */
export function createAddSubgeometryDraft(geometry) {
  if (geometry?.type === "Point") {
    return {
      type: "MultiPoint",
      coordinates: [structuredClone(geometry.coordinates)],
      bbox: null,
      centroid: null,
      borderColor: geometry.borderColor ?? DEFAULT_BORDER_COLOR,
      fillColor: geometry.fillColor ?? DEFAULT_FILL_COLOR,
    };
  }

  if (geometry?.type === "MultiPoint") {
    return {
      ...structuredClone(geometry),
      bbox: null,
      centroid: null,
    };
  }

  if (geometry?.type === "LineString") {
    return {
      type: "MultiLineString",
      coordinates: [structuredClone(geometry.coordinates), []],
      bbox: null,
      centroid: null,
      lineColor: geometry.lineColor ?? DEFAULT_LINE_COLOR,
    };
  }

  if (geometry?.type === "MultiLineString") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    return {
      ...structuredClone(geometry),
      coordinates: [...structuredClone(parts), []],
      bbox: null,
      centroid: null,
    };
  }

  if (geometry?.type === "Polygon") {
    return {
      type: "MultiPolygon",
      coordinates: [structuredClone(geometry.coordinates), [[]]],
      bbox: null,
      centroid: null,
      borderColor: geometry.borderColor ?? DEFAULT_BORDER_COLOR,
      fillColor: geometry.fillColor ?? DEFAULT_FILL_COLOR,
    };
  }

  if (geometry?.type === "MultiPolygon") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    return {
      ...structuredClone(geometry),
      coordinates: [...structuredClone(parts), [[]]],
      bbox: null,
      centroid: null,
    };
  }

  return null;
}

/*
 * The vertices of the "current" part of a MultiLineString/
 * MultiPolygon draft - always its own last entry, the one still being
 * clicked into (see createDraftGeometry's own comment on this shape).
 * For MultiPolygon, each part is itself a [ring]-shaped array
 * (matching a standalone Polygon's own coordinates), so this unwraps
 * that one extra level and reuses getOpenPolygonRing's own closed/
 * open handling; for MultiLineString a part is already just a flat
 * point array, no unwrapping needed.
 */
function getCurrentDraftPartRing(geometry) {
  const parts = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  const current = parts[parts.length - 1];

  if (geometry?.type === "MultiLineString") {
    return Array.isArray(current) ? current : [];
  }

  if (geometry?.type === "MultiPolygon") {
    return getOpenPolygonRing({
      coordinates: Array.isArray(current) ? current : [[]],
    });
  }

  return [];
}

export function wouldPolygonCandidateIntersect(
  geometry,
  candidate,
) {
  if (!isValidCoordinate(candidate)) {
    return true;
  }

  const ring = getOpenPolygonRing(geometry);

  if (ring.length === 0) {
    return false;
  }

  const last = ring[ring.length - 1];

  if (coordinatesEqual(last, candidate)) {
    return true;
  }

  if (ring.length < 2) {
    return false;
  }

  /*
   * Unwraps the current ring together with the candidate in one pass
   * (see unwrapRingLongitudes' own comment) - the candidate ends up as
   * the very last entry, already positioned relative to the ring's own
   * last point the same way every other step in the ring already is.
   */
  const unwrapped = unwrapRingLongitudes([...ring, candidate]);
  const unwrappedLast = unwrapped[unwrapped.length - 2];
  const unwrappedCandidate = unwrapped[unwrapped.length - 1];

  for (let i = 0; i < ring.length - 2; i += 1) {
    if (
      segmentsIntersect(
        unwrappedLast,
        unwrappedCandidate,
        unwrapped[i],
        unwrapped[i + 1],
      )
    ) {
      return true;
    }
  }

  return false;
}

/*
 * Same self-intersection check as wouldPolygonCandidateIntersect
 * above, applied to a MultiPolygon draft's own current (last) part
 * instead of a plain Polygon draft's single ring.
 */
export function wouldMultiPolygonCandidateIntersect(geometry, candidate) {
  const parts = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  const current = parts[parts.length - 1];

  return wouldPolygonCandidateIntersect(
    { coordinates: Array.isArray(current) ? current : [[]] },
    candidate,
  );
}

export function canFinishDraftGeometry(geometry, isSingleTypeAllowed = true) {
  if (geometry?.type === "Point") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length === 2 &&
      geometry.coordinates.every(Number.isFinite)
    );
  }

  if (geometry?.type === "LineString") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length >= 2 &&
      geometry.coordinates.every(isValidCoordinate)
    );
  }

  /*
   * Just 1 point is enough to finish now - per Brody's own call, a
   * multi-type draw tool's draft effectively starts out as its
   * singular type and only actually becomes Multi once a second item
   * is started, so a MultiPoint draft with only 1 point is just as
   * finishable as the "point" tool's own single point would be.
   * completeDraftGeometry below is what actually converts a 1-item
   * Multi- draft down to its singular type at Finish time - this
   * function only decides whether Finish is available at all. That
   * 1-item collapse is only valid if the project's schema actually
   * allows the singular Point type, though (isSingleTypeAllowed) -
   * otherwise a 1-point MultiPoint has no valid type to finish as, so
   * a second point has to be started first.
   */
  if (geometry?.type === "MultiPoint") {
    const count = Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;

    return (
      (count >= 2 || (count === 1 && isSingleTypeAllowed)) &&
      geometry.coordinates.every(isValidCoordinate)
    );
  }

  /*
   * Every part (including the one still being clicked into) has to
   * independently meet LineString's own minimum (2 points) for the
   * whole MultiLineString to be finishable - there's no way to
   * discard an incomplete trailing part, so Finish stays disabled
   * until it's complete too, the same as the "End Line" button's own
   * gate (canCommitCurrentDraftPart below). Just 1 part is enough,
   * matching MultiPoint's own minimum above (same isSingleTypeAllowed
   * gate) - completeDraftGeometry converts a 1-part draft down to a
   * plain LineString at Finish time.
   */
  if (geometry?.type === "MultiLineString") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    return (
      (parts.length >= 2 || (parts.length === 1 && isSingleTypeAllowed)) &&
      parts.every(
        (part) => Array.isArray(part) && part.length >= 2 && part.every(isValidCoordinate),
      )
    );
  }

  /*
   * Same idea for MultiPolygon, against Polygon's own minimum (3
   * points, no self-intersection) - 1 part is enough (same
   * isSingleTypeAllowed gate), converted down to a plain Polygon at
   * Finish time by completeDraftGeometry.
   */
  if (geometry?.type === "MultiPolygon") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    return (
      (parts.length >= 2 || (parts.length === 1 && isSingleTypeAllowed)) &&
      parts.every((part) => {
        const ring = getOpenPolygonRing({
          coordinates: Array.isArray(part) ? part : [[]],
        });

        return (
          ring.length >= 3 &&
          ring.every(isValidCoordinate) &&
          !polygonRingSelfIntersects(ring)
        );
      })
    );
  }

  if (geometry?.type === "Polygon") {
    const ring = getOpenPolygonRing(geometry);

    return (
      ring.length >= 3 &&
      ring.every(isValidCoordinate) &&
      !polygonRingSelfIntersects(ring)
    );
  }

  return false;
}

/*
 * The number of vertices placed so far in an in-progress LineString or
 * Polygon draft (Points aren't built up vertex-by-vertex, so this is
 * always 0 for them). Drives the undo button's visibility - it should
 * only show once there's actually something to remove. For
 * MultiLineString/MultiPolygon, this is the CURRENT part's own count
 * only (not a total across every part) - undo only ever pops from the
 * part still being clicked into, so that's the count that actually
 * matters for the undo button's own visibility.
 */
export function getDraftVertexCount(geometry) {
  if (geometry?.type === "LineString") {
    return Array.isArray(geometry.coordinates)
      ? geometry.coordinates.length
      : 0;
  }

  if (geometry?.type === "Polygon") {
    return getOpenPolygonRing(geometry).length;
  }

  if (geometry?.type === "MultiPoint") {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }

  if (geometry?.type === "MultiLineString" || geometry?.type === "MultiPolygon") {
    return getCurrentDraftPartRing(geometry).length;
  }

  return 0;
}

/*
 * Whether the "undo" button (UndoDrawingButton.jsx) has anything left
 * to do. For most types this is just getDraftVertexCount >= 1 - but
 * for MultiLineString/MultiPolygon, undo should also stay available
 * once the current part is empty (right after EndPartDrawingButton.jsx
 * committed the previous one) as long as there's a previous part to
 * back up into - removeLastDraftVertex above is what actually does
 * that "reopen the previous part" step. Only truly out of undos once
 * there's just one part left and it's already empty, matching "there
 * is no back when there's only one line/polygon and it has no
 * points."
 */
export function canUndoDraftVertex(geometry) {
  if (geometry?.type === "MultiLineString" || geometry?.type === "MultiPolygon") {
    if (getDraftVertexCount(geometry) >= 1) return true;

    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return parts.length > 1;
  }

  return getDraftVertexCount(geometry) >= 1;
}

/*
 * Removes the most recently placed vertex from an in-progress
 * LineString or Polygon draft, for the "undo" button in the draw
 * workflow. The ring is always still open at this stage (the
 * DrawController never appends a closing duplicate coordinate until
 * the draft is actually finished), so this is a plain pop from the
 * end - no special-casing for a closed ring is needed.
 */
export function removeLastDraftVertex(geometry) {
  if (geometry?.type === "LineString") {
    const coordinates = Array.isArray(geometry.coordinates)
      ? geometry.coordinates
      : [];

    if (coordinates.length === 0) return geometry;

    return {
      ...geometry,
      coordinates: coordinates.slice(0, -1),
    };
  }

  if (geometry?.type === "Polygon") {
    const ring = getOpenPolygonRing(geometry);

    if (ring.length === 0) return geometry;

    return {
      ...geometry,
      coordinates: [ring.slice(0, -1)],
    };
  }

  if (geometry?.type === "MultiPoint") {
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    if (coordinates.length === 0) return geometry;

    return {
      ...geometry,
      coordinates: coordinates.slice(0, -1),
    };
  }

  if (geometry?.type === "MultiLineString") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const currentIndex = parts.length - 1;
    const current = getCurrentDraftPartRing(geometry);

    if (current.length > 0) {
      return {
        ...geometry,
        coordinates: parts.map((part, index) =>
          index === currentIndex ? current.slice(0, -1) : part,
        ),
      };
    }

    /*
     * The current part is already empty (this can only happen right
     * after EndPartDrawingButton.jsx just committed the previous one
     * and started this new, still-untouched part) - back up "into"
     * that previous part instead, per Brody's own call: drop this
     * empty part and make the previous one current again, so its own
     * last point is what the next undo removes. No-op if this is the
     * only part and it's already empty - nothing to undo yet.
     */
    if (parts.length > 1) {
      return {
        ...geometry,
        coordinates: parts.slice(0, -1),
      };
    }

    return geometry;
  }

  if (geometry?.type === "MultiPolygon") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const currentIndex = parts.length - 1;
    const ring = getCurrentDraftPartRing(geometry);

    if (ring.length > 0) {
      return {
        ...geometry,
        coordinates: parts.map((part, index) =>
          index === currentIndex ? [ring.slice(0, -1)] : part,
        ),
      };
    }

    /*
     * Same idea as MultiLineString above, but the previous part is a
     * CLOSED ring (EndPartDrawingButton.jsx's own
     * commitCurrentDraftPart closes it before starting the new empty
     * one) - reopening it means dropping its own closing duplicate
     * point before making it current again, the same transformation
     * getOpenPolygonRing already does for a plain Polygon draft.
     */
    if (parts.length > 1) {
      const previousRing = getOpenPolygonRing({ coordinates: parts[parts.length - 2] });

      return {
        ...geometry,
        coordinates: [...parts.slice(0, -2), [previousRing]],
        bbox: null,
        centroid: null,
      };
    }

    return geometry;
  }

  return geometry;
}

/*
 * Whether the current part of a MultiLineString/MultiPolygon draft
 * has enough vertices to be committed as its own finished line/
 * polygon, with a new empty part started to keep drawing into - the
 * "End Line"/"Close Polygon" button's own enabled state (see
 * DrawingActionButtons.jsx). Matches the same minimum LineString
 * (2)/Polygon (3, no self-intersection) needs to finish on its own.
 */
export function canCommitCurrentDraftPart(geometry) {
  if (geometry?.type === "MultiLineString") {
    return getCurrentDraftPartRing(geometry).length >= 2;
  }

  if (geometry?.type === "MultiPolygon") {
    const ring = getCurrentDraftPartRing(geometry);
    return ring.length >= 3 && !polygonRingSelfIntersects(ring);
  }

  return false;
}

/*
 * Closes off the current in-progress part of a MultiLineString/
 * MultiPolygon draft (closing a polygon ring the same way
 * completeDraftGeometry's own Polygon branch does) and appends a new,
 * empty part to keep drawing into.
 */
export function commitCurrentDraftPart(geometry) {
  if (!canCommitCurrentDraftPart(geometry)) return geometry;

  if (geometry.type === "MultiLineString") {
    return {
      ...structuredClone(geometry),
      coordinates: [...structuredClone(geometry.coordinates), []],
    };
  }

  if (geometry.type === "MultiPolygon") {
    const ring = getCurrentDraftPartRing(geometry);
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    const closedCurrent = [[
      ...structuredClone(ring),
      structuredClone(ring[0]),
    ]];

    return {
      ...structuredClone(geometry),
      coordinates: [
        ...structuredClone(parts.slice(0, -1)),
        closedCurrent,
        [[]],
      ],
      bbox: null,
      centroid: null,
    };
  }

  return geometry;
}

function getMinVertexCount(geometryType) {
  if (geometryType === "LineString") return 2;
  if (geometryType === "Polygon") return 3;
  return 0;
}

/*
 * Whether the "remove point" edit tool can take another vertex off
 * this geometry - blocked once it's down to the minimum a valid
 * LineString (2) or Polygon (3) needs, matching what
 * validateLineStringGeometry/validatePolygonGeometry would reject
 * anyway, but checked here so the tool doesn't let the user try (and
 * fail at Finish) in the first place.
 */
export function canRemoveVertex(geometry) {
  if (geometry?.type !== "LineString" && geometry?.type !== "Polygon") {
    return false;
  }

  return getDraftVertexCount(geometry) > getMinVertexCount(geometry.type);
}

/*
 * Removes the vertex at a specific index from a LineString/Polygon
 * draft, for the "remove point" edit tool - unlike
 * removeLastDraftVertex above (which only ever pops the end, for
 * undoing the in-progress draw workflow), this can remove from
 * anywhere in the shape.
 */
export function removeVertexAtIndex(geometry, index) {
  if (!canRemoveVertex(geometry)) return null;

  if (geometry.type === "LineString") {
    const coordinates = Array.isArray(geometry.coordinates)
      ? geometry.coordinates
      : [];

    if (index < 0 || index >= coordinates.length) return null;

    return {
      ...structuredClone(geometry),
      coordinates: coordinates.filter((_, i) => i !== index),
    };
  }

  if (geometry.type === "Polygon") {
    const ring = getOpenPolygonRing(geometry);

    if (index < 0 || index >= ring.length) return null;

    const nextRing = ring.filter((_, i) => i !== index);

    return {
      ...structuredClone(geometry),

      coordinates: [[
        ...structuredClone(nextRing),
        structuredClone(nextRing[0]),
      ]],

      // No longer valid after removing a vertex.
      bbox: null,
      centroid: null,
    };
  }

  return null;
}

/*
 * Whether the "add midpoint" edit tool can add another vertex to this
 * geometry, capped at the same maxCoordinatesPerGeometry the shared
 * validators (shared/validation/lineStringValidation.js,
 * polygonValidation.js) enforce.
 */
export function canInsertMidpoint(geometry) {
  if (geometry?.type !== "LineString" && geometry?.type !== "Polygon") {
    return false;
  }

  return (
    getDraftVertexCount(geometry) < GEOMETRY_LIMITS.maxCoordinatesPerGeometry
  );
}

/*
 * Whether two vertex indices in a LineString/Polygon draft sit next
 * to each other along the shape, for the "add midpoint" edit tool's
 * two-click gesture. For a Polygon, index 0 and the last index are
 * also adjacent, since the ring wraps back around to close itself.
 */
export function areVertexIndicesAdjacent(geometry, indexA, indexB) {
  if (indexA === indexB) return false;

  const count = getDraftVertexCount(geometry);

  if (count < 2) return false;

  if (Math.abs(indexA - indexB) === 1) return true;

  if (geometry?.type === "Polygon") {
    const lowest = Math.min(indexA, indexB);
    const highest = Math.max(indexA, indexB);

    return lowest === 0 && highest === count - 1;
  }

  return false;
}

/*
 * Inserts a new vertex at the planar midpoint between two adjacent
 * vertices (see areVertexIndicesAdjacent) into a LineString/Polygon
 * draft, for the "add midpoint" edit tool. For a Polygon, inserting
 * between the last vertex and the first (the ring's closing segment,
 * the one wraparound-adjacent pair) appends the new vertex at the end
 * of the open ring, since that segment isn't "between" two interior
 * array positions the way every other adjacent pair is.
 */
export function insertMidpointBetweenIndices(geometry, indexA, indexB) {
  if (!canInsertMidpoint(geometry)) return null;
  if (!areVertexIndicesAdjacent(geometry, indexA, indexB)) return null;

  if (geometry.type === "LineString") {
    const coordinates = Array.isArray(geometry.coordinates)
      ? geometry.coordinates
      : [];

    const a = coordinates[indexA];
    const b = coordinates[indexB];

    if (!isValidCoordinate(a) || !isValidCoordinate(b)) return null;

    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

    const insertAt = Math.min(indexA, indexB) + 1;

    return {
      ...structuredClone(geometry),

      coordinates: [
        ...coordinates.slice(0, insertAt),
        midpoint,
        ...coordinates.slice(insertAt),
      ],
    };
  }

  if (geometry.type === "Polygon") {
    const ring = getOpenPolygonRing(geometry);

    const a = ring[indexA];
    const b = ring[indexB];

    if (!isValidCoordinate(a) || !isValidCoordinate(b)) return null;

    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

    const lowest = Math.min(indexA, indexB);
    const highest = Math.max(indexA, indexB);

    const isWraparound = lowest === 0 && highest === ring.length - 1;

    const nextRing = isWraparound
      ? [...ring, midpoint]
      : [
          ...ring.slice(0, lowest + 1),
          midpoint,
          ...ring.slice(lowest + 1),
        ];

    return {
      ...structuredClone(geometry),

      coordinates: [[
        ...nextRing,
        structuredClone(nextRing[0]),
      ]],

      // No longer valid after inserting a vertex.
      bbox: null,
      centroid: null,
    };
  }

  return null;
}

/*
 * ─────────────────────────────
 * Edit-tool support for the three multi- types (move/remove-point/
 * add-midpoint on an already-saved item, not the in-progress draw
 * workflow above). MultiPoint's own vertices have no further nesting
 * - a vertexRef for it is just a plain index, the same shape LineString/
 * Polygon already use. MultiLineString/MultiPolygon's own vertices
 * belong to one of several parts, so a vertexRef for them is instead
 * `{ partIndex, vertexIndex }` - every function below that touches
 * one of those two types expects that shape, not a bare number.
 * ─────────────────────────────
 */

function getMultiPolygonPartRing(geometry, partIndex) {
  const parts = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  const part = parts[partIndex];

  return getOpenPolygonRing({ coordinates: Array.isArray(part) ? part : [[]] });
}

/*
 * Applies a dragged vertex's new coordinate to an already-saved plain
 * Polygon - a shared counterpart to each map library's own DrawLayer.jsx
 * (which keeps a local, unexported copy of this same logic for its own
 * Point/LineString/Polygon "move vertex" tool, working directly against
 * an in-progress edit session's draftGeometry rather than a standalone
 * consumer). Exported here specifically for the Aggregates boundary
 * editor (src/aggregates/, both map renderers' own BoundaryToolLayer.jsx),
 * a genuinely new, non-DrawLayer.jsx consumer that needs the identical
 * behavior - rather than adding a third/fourth local copy. bbox/centroid
 * are cleared, matching every other vertex mutation in this file -
 * completeDraftGeometry always recomputes them fresh from the final
 * coordinates before a save.
 */
export function movePolygonVertex(geometry, vertexIndex, coordinate) {
  if (geometry?.type !== "Polygon" || !Array.isArray(coordinate)) return null;

  const ring = getOpenPolygonRing(geometry);

  if (vertexIndex < 0 || vertexIndex >= ring.length) return null;

  const nextRing = structuredClone(ring);
  nextRing[vertexIndex] = structuredClone(coordinate);

  return {
    ...structuredClone(geometry),

    coordinates: [[
      ...nextRing,
      structuredClone(nextRing[0]),
    ]],

    bbox: null,
    centroid: null,
  };
}

/*
 * Applies a dragged vertex's new coordinate to an already-saved
 * MultiPoint/MultiLineString/MultiPolygon - the multi- counterpart to
 * moveDraftVertex, which each map library's own DrawLayer.jsx keeps a
 * local copy of for Point/LineString/Polygon (see either file's own
 * comment on why that one isn't shared). bbox/centroid/centroid
 * are cleared - no longer valid after a move - the same way a single
 * Polygon's own move already does.
 */
export function moveMultiVertex(geometry, vertexRef, coordinate) {
  if (!geometry || !Array.isArray(coordinate)) return null;

  if (geometry.type === "MultiPoint") {
    const index = vertexRef;
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    if (index < 0 || index >= coordinates.length) return null;

    const nextCoordinates = structuredClone(coordinates);
    nextCoordinates[index] = structuredClone(coordinate);

    return {
      ...structuredClone(geometry),
      coordinates: nextCoordinates,
      bbox: null,
      centroid: null,
    };
  }

  if (geometry.type === "MultiLineString") {
    const { partIndex, vertexIndex } = vertexRef || {};
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const part = parts[partIndex];

    if (!Array.isArray(part) || vertexIndex < 0 || vertexIndex >= part.length) return null;

    const nextParts = parts.map((entry, index) => {
      if (index !== partIndex) return structuredClone(entry);

      const nextPart = structuredClone(entry);
      nextPart[vertexIndex] = structuredClone(coordinate);
      return nextPart;
    });

    return {
      ...structuredClone(geometry),
      coordinates: nextParts,
      bbox: null,
      centroid: null,
    };
  }

  if (geometry.type === "MultiPolygon") {
    const { partIndex, vertexIndex } = vertexRef || {};
    const ring = getMultiPolygonPartRing(geometry, partIndex);

    if (vertexIndex < 0 || vertexIndex >= ring.length) return null;

    const nextRing = structuredClone(ring);
    nextRing[vertexIndex] = structuredClone(coordinate);

    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    const nextParts = parts.map((entry, index) =>
      index === partIndex
        ? [[...nextRing, structuredClone(nextRing[0])]]
        : structuredClone(entry),
    );

    return {
      ...structuredClone(geometry),
      coordinates: nextParts,
      bbox: null,
      centroid: null,
    };
  }

  return null;
}

/*
 * Whether a MultiPolygon vertex move stayed valid - checked against
 * ONLY the one ring the moved vertex belongs to, per Brody's own call:
 * a MultiPolygon's own separate polygons are already allowed to
 * overlap/intersect each other (see multiPolygonValidation.js's own
 * comment), so a move that makes ring A cross ring B is fine - this
 * only rejects a move that makes ring A self-intersect. MultiPoint/
 * MultiLineString have no such constraint (any coordinate is valid for
 * a point; a line is already allowed to self-intersect), so this is
 * MultiPolygon-only, unlike moveMultiVertex above.
 */
export function isMultiPolygonMoveValid(geometry, vertexRef) {
  if (geometry?.type !== "MultiPolygon") return true;

  const ring = getMultiPolygonPartRing(geometry, vertexRef?.partIndex);

  return ring.length >= 3 && !polygonRingSelfIntersects(ring);
}

/*
 * Whether the "remove point" edit tool can take another vertex off
 * this MultiPoint/MultiLineString/MultiPolygon - blocked once the
 * relevant part (the whole geometry, for MultiPoint; just the one
 * part addressed by vertexRef, for the other two) is down to its own
 * minimum. There's no way to remove down to fewer parts/lines/polygons
 * with this tool - only ever fewer points within one - matching "no
 * removing lines, not yet, not in version 1."
 */
export function canRemoveMultiVertex(geometry, vertexRef) {
  if (geometry?.type === "MultiPoint") {
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return coordinates.length > 2;
  }

  if (geometry?.type === "MultiLineString") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const part = parts[vertexRef?.partIndex];
    return Array.isArray(part) && part.length > 2;
  }

  if (geometry?.type === "MultiPolygon") {
    return getMultiPolygonPartRing(geometry, vertexRef?.partIndex).length > 3;
  }

  return false;
}

export function removeMultiVertexAt(geometry, vertexRef) {
  if (!canRemoveMultiVertex(geometry, vertexRef)) return null;

  if (geometry.type === "MultiPoint") {
    const index = vertexRef;
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    if (index < 0 || index >= coordinates.length) return null;

    return {
      ...structuredClone(geometry),
      coordinates: coordinates.filter((_, i) => i !== index),
      bbox: null,
      centroid: null,
    };
  }

  if (geometry.type === "MultiLineString") {
    const { partIndex, vertexIndex } = vertexRef || {};
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const part = parts[partIndex];

    if (!Array.isArray(part) || vertexIndex < 0 || vertexIndex >= part.length) return null;

    const nextParts = parts.map((entry, index) =>
      index === partIndex
        ? entry.filter((_, i) => i !== vertexIndex)
        : structuredClone(entry),
    );

    return {
      ...structuredClone(geometry),
      coordinates: nextParts,
      bbox: null,
      centroid: null,
    };
  }

  if (geometry.type === "MultiPolygon") {
    const { partIndex, vertexIndex } = vertexRef || {};
    const ring = getMultiPolygonPartRing(geometry, partIndex);

    if (vertexIndex < 0 || vertexIndex >= ring.length) return null;

    const nextRing = ring.filter((_, i) => i !== vertexIndex);
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    const nextParts = parts.map((entry, index) =>
      index === partIndex
        ? [[...nextRing, structuredClone(nextRing[0])]]
        : structuredClone(entry),
    );

    return {
      ...structuredClone(geometry),
      coordinates: nextParts,
      bbox: null,
      centroid: null,
    };
  }

  return null;
}

/*
 * Whether two vertex refs in a MultiLineString/MultiPolygon belong to
 * the same part and sit next to each other within it - the multi-
 * counterpart to areVertexIndicesAdjacent above. Two vertices in
 * different parts are never adjacent, even if their own vertexIndex
 * values happen to be next to each other, since they don't belong to
 * the same line/polygon.
 */
export function areMultiVertexIndicesAdjacent(geometry, vertexRefA, vertexRefB) {
  const partIndexA = vertexRefA?.partIndex;
  const partIndexB = vertexRefB?.partIndex;
  const indexA = vertexRefA?.vertexIndex;
  const indexB = vertexRefB?.vertexIndex;

  if (partIndexA !== partIndexB) return false;
  if (indexA === indexB) return false;

  if (geometry?.type === "MultiLineString") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const count = Array.isArray(parts[partIndexA]) ? parts[partIndexA].length : 0;

    if (count < 2) return false;

    return Math.abs(indexA - indexB) === 1;
  }

  if (geometry?.type === "MultiPolygon") {
    const count = getMultiPolygonPartRing(geometry, partIndexA).length;

    if (count < 2) return false;

    if (Math.abs(indexA - indexB) === 1) return true;

    const lowest = Math.min(indexA, indexB);
    const highest = Math.max(indexA, indexB);

    return lowest === 0 && highest === count - 1;
  }

  return false;
}

/*
 * Whether the "add midpoint" edit tool can add another vertex to the
 * one part vertexRef addresses, capped at the same
 * maxCoordinatesPerGeometry limit canInsertMidpoint above checks -
 * against just that part's own vertex count, not a total across every
 * part, matching how the total-coordinate-count limit was always
 * meant to apply (shared/validation/multiLineStringValidation.js/
 * multiPolygonValidation.js check the real total at save time; this
 * is only the same "don't even let the tool try" early guard
 * canInsertMidpoint already is for the single-part types).
 */
export function canInsertMultiMidpoint(geometry, vertexRef) {
  if (geometry?.type === "MultiLineString") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const count = Array.isArray(parts[vertexRef?.partIndex])
      ? parts[vertexRef.partIndex].length
      : 0;

    return count < GEOMETRY_LIMITS.maxCoordinatesPerGeometry;
  }

  if (geometry?.type === "MultiPolygon") {
    const count = getMultiPolygonPartRing(geometry, vertexRef?.partIndex).length;

    return count < GEOMETRY_LIMITS.maxCoordinatesPerGeometry;
  }

  return false;
}

/*
 * Inserts a new vertex at the planar midpoint between two adjacent
 * vertices of the same part (see areMultiVertexIndicesAdjacent) into a
 * MultiLineString/MultiPolygon - the multi- counterpart to
 * insertMidpointBetweenIndices above, operating on just the one part
 * both vertexRefs address (already confirmed to be the same part by
 * areMultiVertexIndicesAdjacent).
 */
export function insertMultiMidpointBetweenIndices(geometry, vertexRefA, vertexRefB) {
  if (!canInsertMultiMidpoint(geometry, vertexRefA)) return null;
  if (!areMultiVertexIndicesAdjacent(geometry, vertexRefA, vertexRefB)) return null;

  const partIndex = vertexRefA.partIndex;
  const indexA = vertexRefA.vertexIndex;
  const indexB = vertexRefB.vertexIndex;

  if (geometry.type === "MultiLineString") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const part = Array.isArray(parts[partIndex]) ? parts[partIndex] : [];

    const a = part[indexA];
    const b = part[indexB];

    if (!isValidCoordinate(a) || !isValidCoordinate(b)) return null;

    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const insertAt = Math.min(indexA, indexB) + 1;

    const nextPart = [
      ...part.slice(0, insertAt),
      midpoint,
      ...part.slice(insertAt),
    ];

    const nextParts = parts.map((entry, index) =>
      index === partIndex ? nextPart : entry,
    );

    return {
      ...structuredClone(geometry),
      coordinates: structuredClone(nextParts),
      bbox: null,
      centroid: null,
    };
  }

  if (geometry.type === "MultiPolygon") {
    const ring = getMultiPolygonPartRing(geometry, partIndex);

    const a = ring[indexA];
    const b = ring[indexB];

    if (!isValidCoordinate(a) || !isValidCoordinate(b)) return null;

    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

    const lowest = Math.min(indexA, indexB);
    const highest = Math.max(indexA, indexB);

    const isWraparound = lowest === 0 && highest === ring.length - 1;

    const nextRing = isWraparound
      ? [...ring, midpoint]
      : [
          ...ring.slice(0, lowest + 1),
          midpoint,
          ...ring.slice(lowest + 1),
        ];

    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    const nextParts = parts.map((entry, index) =>
      index === partIndex
        ? [[...nextRing, structuredClone(nextRing[0])]]
        : structuredClone(entry),
    );

    return {
      ...structuredClone(geometry),
      coordinates: nextParts,
      bbox: null,
      centroid: null,
    };
  }

  return null;
}

/*
 * Whether a whole sub-item - one point of a MultiPoint, one line of a
 * MultiLineString, one polygon of a MultiPolygon - can be removed
 * outright, for the "remove sub-geometry" edit tool. Distinct from
 * canRemoveMultiVertex above, which only ever removes a single vertex
 * within one part, never a whole part - this is the tool for "there
 * are too many lines/polygons/points in this item," not "this one
 * line/polygon has an extra point on it." Each type keeps its own
 * real minimum: MultiPoint needs at least 2 points to remain valid
 * (multiPointValidation.js's own validateMultiPointGeometry), while
 * MultiLineString/MultiPolygon each just need at least 1 part.
 */
/*
 * A removal that leaves 2+ items behind is always allowed - it never
 * changes the geometry's own type. A removal that would leave exactly
 * 1 item is only allowed if the project's schema actually allows the
 * singular type it would collapse to (isSingleTypeAllowed) - otherwise
 * that conversion has nowhere valid to land, so the item has to keep
 * at least 2 sub-geometries. When it IS allowed, removeSubgeometryAt
 * below converts the draft to its singular type equivalent instead of
 * leaving a 1-item Multi behind, per Brody's own call.
 */
export function canRemoveSubgeometry(geometry, isSingleTypeAllowed = true) {
  if (geometry?.type === "MultiPoint") {
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const count = coordinates.length;
    return count > 2 || (count === 2 && isSingleTypeAllowed);
  }

  if (geometry?.type === "MultiLineString" || geometry?.type === "MultiPolygon") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const count = parts.length;
    return count > 2 || (count === 2 && isSingleTypeAllowed);
  }

  return false;
}

/*
 * Removes an entire sub-item at partIndex - one point (MultiPoint), or
 * one whole line/polygon part (MultiLineString/MultiPolygon) -
 * clearing bbox/centroid/centroid the same way every other
 * mutation here does, since completeDraftGeometry always recomputes
 * them fresh from the remaining coordinates before a save, regardless
 * of what was here beforehand.
 *
 * When the removal leaves exactly 1 item, the returned geometry's own
 * type is converted to the singular equivalent (MultiPoint -> Point,
 * MultiLineString -> LineString, MultiPolygon -> Polygon) instead of
 * staying a 1-item Multi - per Brody's own call, a multi-type is only
 * ever allowed to exist with 2+ items (see canFinishDraftGeometry and
 * the multi- validators), so a manual removal down to 1 has to convert
 * rather than produce a Multi that could never have been drawn or
 * validated in the first place. The one remaining part's own
 * coordinates already match its singular type's own coordinates shape
 * directly (a MultiPolygon part is already `[ring]`, same as Polygon's
 * own coordinates; a MultiLineString part is already a flat coordinate
 * array, same as LineString's own coordinates), so no reshaping beyond
 * unwrapping the outer parts array is needed. Pressing Back afterward
 * restores the pre-removal (still-Multi, still 2+ items) snapshot from
 * geometryEditHistory, converting it back automatically since Back
 * just restores the whole draftGeometry object type included.
 */
export function removeSubgeometryAt(geometry, partIndex, isSingleTypeAllowed = true) {
  if (!canRemoveSubgeometry(geometry, isSingleTypeAllowed)) return null;

  if (geometry.type === "MultiPoint") {
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    if (partIndex < 0 || partIndex >= coordinates.length) return null;

    const remaining = coordinates.filter((_, index) => index !== partIndex);

    if (remaining.length === 1) {
      return {
        type: "Point",
        coordinates: structuredClone(remaining[0]),
        borderColor: geometry.borderColor,
        fillColor: geometry.fillColor,
      };
    }

    return {
      ...structuredClone(geometry),
      coordinates: remaining,
      bbox: null,
      centroid: null,
    };
  }

  if (geometry.type === "MultiLineString") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    if (partIndex < 0 || partIndex >= parts.length) return null;

    const remaining = parts.filter((_, index) => index !== partIndex);

    if (remaining.length === 1) {
      return {
        type: "LineString",
        coordinates: structuredClone(remaining[0]),
        lineColor: geometry.lineColor,
        distance: null,
        midpoint: null,
        centroid: null,
      };
    }

    return {
      ...structuredClone(geometry),
      coordinates: remaining,
      bbox: null,
      centroid: null,
    };
  }

  if (geometry.type === "MultiPolygon") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    if (partIndex < 0 || partIndex >= parts.length) return null;

    const remaining = parts.filter((_, index) => index !== partIndex);

    if (remaining.length === 1) {
      return {
        type: "Polygon",
        coordinates: structuredClone(remaining[0]),
        borderColor: geometry.borderColor,
        fillColor: geometry.fillColor,
        bbox: null,
        centroid: null,
      };
    }

    return {
      ...structuredClone(geometry),
      coordinates: remaining,
      bbox: null,
      centroid: null,
    };
  }

  return null;
}

export function completeDraftGeometry(geometry, isSingleTypeAllowed = true) {
  if (!canFinishDraftGeometry(geometry, isSingleTypeAllowed)) {
    return null;
  }

  if (geometry.type === "Point") {
    return {
      type: "Point",

      coordinates:
        structuredClone(
          geometry.coordinates,
        ),

      borderColor:
        geometry.borderColor ??
        DEFAULT_POINT_BORDER_COLOR,

      fillColor:
        geometry.fillColor ??
        DEFAULT_FILL_COLOR,
    };
  }

  if (geometry.type === "LineString") {
    return sanitizeLineStringGeometry(
      structuredClone(geometry),
    );
  }

  if (geometry.type === "Polygon") {
    const ring =
      getOpenPolygonRing(
        geometry,
      );

    const closedGeometry = {
      ...structuredClone(geometry),

      coordinates: [[
        ...structuredClone(ring),
        structuredClone(ring[0]),
      ]],

      bbox: null,
      centroid: null,
    };

    return sanitizePolygonGeometry(
      closedGeometry,
    );
  }

  /*
   * A draw tool's own Multi- draft starts out effectively as its
   * singular type and only actually becomes Multi once a second item
   * is started (see canFinishDraftGeometry's own comment) - so
   * finishing with only 1 point/line/polygon converts down to the
   * plain singular type here, the same conversion removeSubgeometryAt
   * below does when a removal leaves only 1 behind. 2+ items finish as
   * a genuine Multi- geometry as before.
   */
  if (geometry.type === "MultiPoint") {
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    if (coordinates.length === 1) {
      return {
        type: "Point",
        coordinates: structuredClone(coordinates[0]),
        borderColor: geometry.borderColor ?? DEFAULT_POINT_BORDER_COLOR,
        fillColor: geometry.fillColor ?? DEFAULT_FILL_COLOR,
      };
    }

    return sanitizeMultiPointGeometry(structuredClone(geometry));
  }

  if (geometry.type === "MultiLineString") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    if (parts.length === 1) {
      return sanitizeLineStringGeometry({
        type: "LineString",
        coordinates: structuredClone(parts[0]),
        lineColor: geometry.lineColor ?? DEFAULT_LINE_COLOR,
      });
    }

    return sanitizeMultiLineStringGeometry(structuredClone(geometry));
  }

  if (geometry.type === "MultiPolygon") {
    const parts = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    if (parts.length === 1) {
      const ring = getOpenPolygonRing({
        coordinates: Array.isArray(parts[0]) ? parts[0] : [[]],
      });

      return sanitizePolygonGeometry({
        type: "Polygon",

        coordinates: [[
          ...structuredClone(ring),
          structuredClone(ring[0]),
        ]],

        borderColor: geometry.borderColor ?? DEFAULT_BORDER_COLOR,
        fillColor: geometry.fillColor ?? DEFAULT_FILL_COLOR,
      });
    }

    const closedParts = parts.map((part) => {
      const ring = getOpenPolygonRing({
        coordinates: Array.isArray(part) ? part : [[]],
      });

      return [[
        ...structuredClone(ring),
        structuredClone(ring[0]),
      ]];
    });

    const closedGeometry = {
      ...structuredClone(geometry),
      coordinates: closedParts,
      bbox: null,
      centroid: null,
    };

    return sanitizeMultiPolygonGeometry(closedGeometry);
  }

  return null;
}

/*
 * The single point the "move geometry" edit tool renders its
 * draggable handle at - a saved item's own centroid for every type
 * except Point, which has no separate centroid field and is instead
 * moved by its own one coordinate directly (translateGeometryByDelta
 * below already handles that correctly with no special-casing, since
 * shifting a Point's own coordinate by the drag delta is exactly what
 * moving it by "its own centroid" would mean anyway).
 */
export function getGeometryHandlePosition(geometry) {
  if (!geometry) return null;

  if (geometry.type === "Point") {
    return isValidCoordinate(geometry.coordinates)
      ? { lng: geometry.coordinates[0], lat: geometry.coordinates[1] }
      : null;
  }

  const centroid = geometry.centroid;
  const lat = Number(centroid?.lat);
  const lng = Number(centroid?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

/*
 * Recurses through however many coordinate levels a geometry's own
 * `coordinates` has - Point's own flat [lng, lat] pair, up through
 * MultiPolygon's own array-of-parts-of-rings-of-pairs - shifting every
 * actual coordinate pair it finds by the same (dLng, dLat). Detecting
 * "this is a pair, stop recursing" by checking whether its own first
 * entry is a number (a pair) rather than another array (a deeper
 * level) means translateGeometryByDelta below needs no per-type
 * branching at all.
 */
function shiftCoordinatesDeep(coordinates, dLng, dLat) {
  if (!Array.isArray(coordinates)) return coordinates;

  if (typeof coordinates[0] === "number") {
    return [coordinates[0] + dLng, coordinates[1] + dLat];
  }

  return coordinates.map((entry) => shiftCoordinatesDeep(entry, dLng, dLat));
}

/*
 * Rigidly translates every coordinate in `geometry` by the same
 * (dLng, dLat) - the "move geometry" edit tool's own whole-shape drag,
 * as opposed to "move" (Move Vertex), which only ever moves one vertex
 * at a time.
 *
 * bbox/centroid (whichever the type already carries) are shifted by
 * the exact same delta rather than recomputed from scratch - a rigid
 * translation preserves both of these exactly, in plain degree space:
 * bbox's own min/max shift by the same amount as everything else (a
 * translation preserves ordering, so the min stays the min and the max
 * stays the max), and a centroid (an average, whether a Polygon's own
 * area-weighted one or a Multi- type's "average of its own parts' own
 * centroids") shifts by that same constant since averaging is linear -
 * both are pure planar (lng/lat) computations with no real-world
 * distance involved.
 *
 * distance and a LineString's own arc-length midpoint are NOT
 * preserved by a coordinate shift, and are nulled out here rather than
 * shifted, so completeDraftGeometry's own sanitizeLineStringGeometry
 * call recomputes them fresh from the translated coordinates. Both are
 * derived via the haversine formula (computeLineDistanceMeters/
 * computeLineMidpoint in shared/validation/lineStringValidation.js),
 * which depends on each point's *absolute* latitude (cos(lat1)*cos(
 * lat2) in the formula), not just the relative offsets between points
 * - so shifting every coordinate by the same dLat changes the real-
 * world distance between them (a degree of longitude covers a
 * different physical distance at a different latitude), even though
 * the geometry's shape in plain degree space is unchanged. Leaving the
 * old (now-wrong) values in place, or naively shifting them, both
 * failed shared/validation's own recompute-and-compare check the
 * moment a drag included any north/south movement.
 */
export function translateGeometryByDelta(geometry, dLng, dLat) {
  if (!geometry || !Number.isFinite(dLng) || !Number.isFinite(dLat)) {
    return null;
  }

  const next = {
    ...structuredClone(geometry),
    coordinates: shiftCoordinatesDeep(geometry.coordinates, dLng, dLat),
  };

  if (Array.isArray(next.bbox) && next.bbox.length === 4) {
    next.bbox = [
      Number(next.bbox[0]) + dLng,
      Number(next.bbox[1]) + dLat,
      Number(next.bbox[2]) + dLng,
      Number(next.bbox[3]) + dLat,
    ];
  }

  if (next.centroid) {
    const lat = Number(next.centroid.lat);
    const lng = Number(next.centroid.lng);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      next.centroid = { lat: lat + dLat, lng: lng + dLng };
    }
  }

  /*
   * sanitizeLineStringGeometry now always recomputes distance/
   * midpoint/centroid unconditionally rather than preferring an
   * already-present value (see that function's own comment), so
   * deleting these two here isn't load-bearing for correctness the
   * way it once was - kept anyway since there's no reason to carry a
   * stale, about-to-be-recomputed value on the draft in the meantime.
   */
  delete next.midpoint;
  delete next.distance;

  return next;
}