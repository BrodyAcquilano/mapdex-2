// shared/validation/multiPolygonValidation.js

import { GEOMETRY_LIMITS } from "./validationConstants.js";
import {
  isValidLngLatPair,
  pairsMatch,
  normalizeHexColor,
  computeBBox,
  computePolygonCentroid,
} from "./polygonValidation.js";

const DEFAULT_BORDER_COLOR = "#2563eb";
const DEFAULT_FILL_COLOR = "#3b82f6";

const CENTROID_TOLERANCE_DEGREES = 1e-9;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/*
 * Each entry in a MultiPolygon's own coordinates is itself a Polygon's
 * worth of rings - [ring] here, not just ring, mirroring GeoJSON's
 * real MultiPolygon shape (an array of Polygon coordinate arrays).
 * Mapdex's own Polygon never supports holes (see
 * polygonValidation.js's own single-ring-only check), so every entry
 * here is expected to hold exactly one ring, same as a standalone
 * Polygon's own coordinates.
 */
function cleanPolygonRing(polygonEntry) {
  const ring = Array.isArray(polygonEntry) ? polygonEntry[0] : null;
  if (!Array.isArray(ring) || ring.length < 4) return null;

  const cleaned = ring.map((pair) => {
    if (!isValidLngLatPair(pair)) return null;
    return [Number(pair[0]), Number(pair[1])];
  });

  if (cleaned.some((pair) => pair === null)) return null;

  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (!pairsMatch(first, last)) cleaned.push([...first]);

  if (cleaned.length < 4) return null;

  return cleaned;
}

/*
 * Bounding box across every ring in the group - one combined box, not
 * one per polygon (see this file's own header comment on why per-
 * polygon fields were dropped for the multi- version). Reuses
 * polygonValidation.js's own computeBBox per ring, since that already
 * takes a `{ coordinates: [ring] }`-shaped geometry.
 */
export function computeMultiPolygonBBox(rings) {
  if (!Array.isArray(rings) || rings.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const ring of rings) {
    const bbox = computeBBox({ coordinates: [ring] });
    if (!bbox) return null;

    const [ringMinLng, ringMinLat, ringMaxLng, ringMaxLat] = bbox;

    if (ringMinLng < minLng) minLng = ringMinLng;
    if (ringMinLat < minLat) minLat = ringMinLat;
    if (ringMaxLng > maxLng) maxLng = ringMaxLng;
    if (ringMaxLat > maxLat) maxLat = ringMaxLat;
  }

  return [minLng, minLat, maxLng, maxLat];
}

/*
 * "Centroid of centroids" - each polygon's own true area centroid
 * (polygonValidation.js's own computePolygonCentroid, per ring),
 * averaged together into one group value, rather than storing every
 * polygon's own value. No overlap/intersection restriction is imposed
 * between the individual polygons - matching RFC7946 itself (which is
 * silent on this), not the stricter OGC Simple Features validity
 * rules, per Brody's own call.
 *
 * Each individual ring's own centroid is already antimeridian-aware
 * (computePolygonCentroid, above, unwraps that one ring's own
 * vertices), but averaging several rings' centroids together here is
 * not - if the rings themselves are scattered on opposite sides of the
 * dateline (as opposed to one ring crossing it, which is already
 * handled), this has the same "independent points, no sequential path
 * to unwrap along" issue multiPointValidation.js's own
 * computeMultiPointBBox/Centroid do - deferred alongside those for the
 * same reason.
 */
export function computeMultiPolygonCentroid(rings) {
  if (!Array.isArray(rings) || rings.length === 0) return null;

  let latSum = 0;
  let lngSum = 0;

  for (const ring of rings) {
    const centroid = computePolygonCentroid({ coordinates: [ring] });
    if (!centroid) return null;

    latSum += centroid.lat;
    lngSum += centroid.lng;
  }

  return {
    lat: latSum / rings.length,
    lng: lngSum / rings.length,
  };
}

/*
 * Client-side helper analogous to sanitizePolygonGeometry: attaches a
 * freshly computed bbox/centroid to a raw MultiPolygon geometry.
 *
 * Always recomputed from the cleaned rings, never trusting an
 * already-present bbox/centroid (an import source's own, or anything
 * else on the raw payload) - per Brody's own call, after a real-world
 * import turned up a LineString whose own numerically unstable
 * centroid (see lineStringValidation.js's own computeLineCentroid
 * comment - the same shoelace-area math this file's own
 * computePolygonCentroid uses, per ring) could have silently slipped
 * through if this had preferred that already-present value instead.
 * Recomputing here means the derived fields always match the
 * coordinates they came from.
 */
export function sanitizeMultiPolygonGeometry(rawGeometry) {
  if (!rawGeometry || typeof rawGeometry !== "object") return null;
  if (rawGeometry.type !== "MultiPolygon") return null;

  const coordinates = rawGeometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const cleanedRings = coordinates.map((polygonEntry) => cleanPolygonRing(polygonEntry));
  if (cleanedRings.some((ring) => ring === null)) return null;

  const bbox = computeMultiPolygonBBox(cleanedRings);
  const centroid = computeMultiPolygonCentroid(cleanedRings);

  if (!bbox || !centroid) return null;

  return {
    type: "MultiPolygon",
    coordinates: cleanedRings.map((ring) => [ring]),
    borderColor: normalizeHexColor(rawGeometry.borderColor, DEFAULT_BORDER_COLOR),
    fillColor: normalizeHexColor(rawGeometry.fillColor, DEFAULT_FILL_COLOR),
    bbox,
    centroid,
  };
}

/*
 * Strict validator for a MultiPolygon geometry that includes real
 * coordinates (add, and any future move/drag route): every polygon
 * independently needs to meet Polygon's own existing rules (single
 * ring, at least 4 positions with the ring closed, no holes) - applied
 * per polygon here, exactly the same way a standalone
 * validatePolygonGeometry call would check one. No rule requiring the
 * individual polygons not to overlap or intersect one another.
 * Requires at least 2 polygons - a multi-type is only ever allowed to
 * exist with 2+ items, matching MultiPoint's own minimum: the draw
 * tools require 2+ to finish, and the "remove sub-geometry" edit tool
 * converts down to a plain Polygon rather than ever leaving a 1-item
 * MultiPolygon, so a payload can't legitimately reach here with just 1
 * (import-time reconciliation for already-malformed externally-sourced
 * data is a separate, later concern).
 */
export function validateMultiPolygonGeometry(rawGeometry) {
  if (!rawGeometry || typeof rawGeometry !== "object") return false;
  if (rawGeometry.type !== "MultiPolygon") return false;

  const allowedKeys = new Set([
    "type",
    "coordinates",
    "bbox",
    "centroid",
    "borderColor",
    "fillColor",
  ]);

  if (!Object.keys(rawGeometry).every((key) => allowedKeys.has(key))) {
    return false;
  }

  const coordinates = rawGeometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false;

  let totalPoints = 0;
  const rings = [];

  for (const polygonEntry of coordinates) {
    if (!Array.isArray(polygonEntry) || polygonEntry.length !== 1) return false;

    const ring = polygonEntry[0];
    if (!Array.isArray(ring) || ring.length < 4) return false;

    for (const pair of ring) {
      if (!isValidLngLatPair(pair)) return false;
    }

    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!pairsMatch(first, last)) return false;

    totalPoints += ring.length;
    rings.push(ring);
  }

  if (totalPoints > GEOMETRY_LIMITS.maxCoordinatesPerGeometry) return false;

  if (normalizeHexColor(rawGeometry.borderColor, null) !== rawGeometry.borderColor) {
    return false;
  }

  if (normalizeHexColor(rawGeometry.fillColor, null) !== rawGeometry.fillColor) {
    return false;
  }

  const bbox = rawGeometry.bbox;
  if (!Array.isArray(bbox) || bbox.length !== 4) return false;

  const computedBBox = computeMultiPolygonBBox(rings);
  if (!computedBBox) return false;

  const bboxMatches = bbox.every(
    (value, index) => Number(value) === Number(computedBBox[index]),
  );
  if (!bboxMatches) return false;

  const centroid = rawGeometry.centroid;
  if (!isPlainObject(centroid)) return false;

  const centroidLat = Number(centroid.lat);
  const centroidLng = Number(centroid.lng);
  if (!Number.isFinite(centroidLat) || !Number.isFinite(centroidLng)) return false;

  const computedCentroid = computeMultiPolygonCentroid(rings);
  if (!computedCentroid) return false;

  if (Math.abs(centroidLat - computedCentroid.lat) > CENTROID_TOLERANCE_DEGREES) {
    return false;
  }

  if (Math.abs(centroidLng - computedCentroid.lng) > CENTROID_TOLERANCE_DEGREES) {
    return false;
  }

  return true;
}

/*
 * Update-mode validator: the regular update route only ever changes
 * color for an existing MultiPolygon (never coordinates), matching
 * Polygon's own ForUpdate pattern.
 */
export function validateMultiPolygonGeometryForUpdate(rawGeometry) {
  if (!rawGeometry || typeof rawGeometry !== "object") return false;
  if (rawGeometry.type !== "MultiPolygon") return false;

  const allowedKeys = new Set(["type", "borderColor", "fillColor"]);
  if (!Object.keys(rawGeometry).every((key) => allowedKeys.has(key))) return false;

  if (normalizeHexColor(rawGeometry.borderColor, null) !== rawGeometry.borderColor) {
    return false;
  }

  if (normalizeHexColor(rawGeometry.fillColor, null) !== rawGeometry.fillColor) {
    return false;
  }

  return true;
}
