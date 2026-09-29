// shared/validation/multiPointValidation.js

import { GEOMETRY_LIMITS } from "./validationConstants.js";
import { validatePointCoordinates } from "./pointValidation.js";

const DEFAULT_BORDER_COLOR = "#2563eb";
const DEFAULT_FILL_COLOR = "#3b82f6";

const CENTROID_TOLERANCE_DEGREES = 1e-9;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;

  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length) return false;

  const expected = new Set(expectedKeys);
  return keys.every((key) => expected.has(key));
}

function isValidHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();

  return fallback;
}

function toNumberPair(pair) {
  if (!validatePointCoordinates(pair)) return null;

  const lng = typeof pair[0] === "string" ? parseFloat(pair[0]) : Number(pair[0]);
  const lat = typeof pair[1] === "string" ? parseFloat(pair[1]) : Number(pair[1]);

  return [lng, lat];
}

/*
 * Bounding box across every point in the group - a plain min/max scan,
 * the same shape shared/validation/polygonValidation.js's own
 * computeBBox produces for a Polygon's ring.
 *
 * Not antimeridian-aware, unlike Polygon/LineString's own bbox/
 * centroid math (see polygonValidation.js/lineStringValidation.js's
 * own unwrapRingLongitudes) - this group's points have no natural
 * sequential order to "unwrap" along the way a ring or line's own
 * vertices do (they're independent, not a path), so correctly handling
 * a MultiPoint scattered across the dateline needs a genuinely
 * different technique (something like a circular mean of longitudes)
 * rather than a straightforward extension of the ring-unwrap approach.
 * Deferred for now - this round only covers the cases where a
 * sequential unwrap cleanly applies.
 */
export function computeMultiPointBBox(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const pair of coordinates) {
    const cleaned = toNumberPair(pair);
    if (!cleaned) return null;

    const [lng, lat] = cleaned;
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLng, minLat, maxLng, maxLat];
}

/*
 * "Centroid of centroids," the same idea MultiLineString's own
 * centroid and MultiPolygon's own centroid use for their group
 * value - each point's own centroid is just itself, so this reduces to
 * the plain average of every point's own coordinates.
 */
export function computeMultiPointCentroid(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

  let lngSum = 0;
  let latSum = 0;

  for (const pair of coordinates) {
    const cleaned = toNumberPair(pair);
    if (!cleaned) return null;

    lngSum += cleaned[0];
    latSum += cleaned[1];
  }

  return {
    lat: latSum / coordinates.length,
    lng: lngSum / coordinates.length,
  };
}

/*
 * Client-side helper analogous to sanitizePolygonGeometry/
 * sanitizeLineStringGeometry: attaches a freshly computed bbox/
 * centroid to a raw MultiPoint geometry.
 *
 * Always recomputed from the cleaned coordinates, never trusting an
 * already-present bbox/centroid (an import source's own, or anything
 * else on the raw payload) - per Brody's own call, after a real-world
 * import turned up a LineString whose own numerically unstable
 * centroid (see lineStringValidation.js's own computeLineCentroid
 * comment) could have silently slipped through if this had preferred
 * that already-present value instead. Recomputing here means the
 * derived fields always match the coordinates they came from.
 */
export function sanitizeMultiPointGeometry(rawGeometry) {
  if (!rawGeometry || typeof rawGeometry !== "object") return null;
  if (rawGeometry.type !== "MultiPoint") return null;

  const coordinates = rawGeometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const cleanedCoordinates = coordinates.map((pair) => toNumberPair(pair));
  if (cleanedCoordinates.some((pair) => pair === null)) return null;

  const bbox = computeMultiPointBBox(cleanedCoordinates);
  const centroid = computeMultiPointCentroid(cleanedCoordinates);

  if (!bbox || !centroid) return null;

  return {
    type: "MultiPoint",
    coordinates: cleanedCoordinates,
    borderColor: normalizeHexColor(rawGeometry.borderColor, DEFAULT_BORDER_COLOR),
    fillColor: normalizeHexColor(rawGeometry.fillColor, DEFAULT_FILL_COLOR),
    bbox,
    centroid,
  };
}

/*
 * Strict validator for a MultiPoint geometry that includes real
 * coordinates (add, and any future move/drag route): requires bbox and
 * centroid to be present and to match what's recomputed from the
 * coordinates, mirroring validatePolygonGeometry's own bbox/centroid
 * check. At least 2 points, per Brody's own call - a MultiPoint with
 * one point has nothing "multi" about it.
 */
export function validateMultiPointGeometry(geometry) {
  if (
    !hasExactKeys(geometry, [
      "type",
      "coordinates",
      "borderColor",
      "fillColor",
      "bbox",
      "centroid",
    ])
  ) {
    return false;
  }

  if (geometry.type !== "MultiPoint") return false;

  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false;

  if (coordinates.length > GEOMETRY_LIMITS.maxCoordinatesPerGeometry) {
    return false;
  }

  for (const pair of coordinates) {
    if (!validatePointCoordinates(pair)) return false;
  }

  if (!isValidHexColor(geometry.borderColor)) return false;
  if (!isValidHexColor(geometry.fillColor)) return false;

  const bbox = geometry.bbox;
  if (!Array.isArray(bbox) || bbox.length !== 4) return false;
  if (!bbox.every((value) => Number.isFinite(Number(value)))) return false;

  const computedBBox = computeMultiPointBBox(coordinates);
  if (!computedBBox) return false;

  const bboxMatches = bbox.every(
    (value, index) => Number(value) === Number(computedBBox[index]),
  );
  if (!bboxMatches) return false;

  const centroid = geometry.centroid;
  if (!isPlainObject(centroid)) return false;

  const centroidLat = Number(centroid.lat);
  const centroidLng = Number(centroid.lng);
  if (!Number.isFinite(centroidLat) || !Number.isFinite(centroidLng)) return false;

  const computedCentroid = computeMultiPointCentroid(coordinates);
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
 * Update-mode validator: color-only, matching LineString/Polygon's own
 * ForUpdate pattern rather than Point's (which does allow coordinate
 * changes through the regular update route) - the edit panel never
 * offers coordinate editing for a multi-geometry, per Brody's own
 * call, so a legitimate update never needs to send coordinates/bbox/
 * centroid here.
 */
export function validateMultiPointGeometryForUpdate(geometry) {
  if (!hasExactKeys(geometry, ["type", "borderColor", "fillColor"])) {
    return false;
  }

  if (geometry.type !== "MultiPoint") return false;

  return isValidHexColor(geometry.borderColor) && isValidHexColor(geometry.fillColor);
}
