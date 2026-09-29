// shared/validation/lineStringValidation.js

import { GEOMETRY_LIMITS } from "./validationConstants.js";

const DEFAULT_LINE_COLOR = "#3388ff";

const EARTH_RADIUS_METERS = 6371000;

// Same-machine, same-inputs recomputation should match essentially
// exactly; these just guard against float rounding across engines.
const LINE_DISTANCE_TOLERANCE_METERS = 1e-6;
const LINE_MIDPOINT_TOLERANCE_DEGREES = 1e-9;
const LINE_CENTROID_TOLERANCE_DEGREES = 1e-9;

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

export function isValidLngLatPair(pair) {
  if (!Array.isArray(pair) || pair.length !== 2) {
    return false;
  }

  const lng = pair[0];
  const lat = pair[1];

  if (
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    typeof lat !== "number" ||
    !Number.isFinite(lat)
  ) {
    return false;
  }

  if (
    lat < GEOMETRY_LIMITS.latitudeMin ||
    lat > GEOMETRY_LIMITS.latitudeMax
  ) {
    return false;
  }

  if (
    lng < GEOMETRY_LIMITS.longitudeMin ||
    lng > GEOMETRY_LIMITS.longitudeMax
  ) {
    return false;
  }

  if (
    String(lat).length > GEOMETRY_LIMITS.coordinateMaxLength ||
    String(lng).length > GEOMETRY_LIMITS.coordinateMaxLength
  ) {
    return false;
  }

  return true;
}

export function isValidHexColor(value) {
  return (
    typeof value === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(value)
  );
}

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return fallback;
}

/*
 * Wraps a longitude back into the normal -180..180 range - see
 * polygonValidation.js's own identically-named helper for the full
 * comment (duplicated here rather than imported, matching this file's
 * existing pattern of small helpers kept per-file).
 */
function normalizeLongitude(lng) {
  return ((lng + 180) % 360 + 360) % 360 - 180;
}

/*
 * Returns a copy of `points` with longitudes "unwrapped" so a path
 * crossing the antimeridian reads as a short, locally continuous line
 * instead of the ~358 degree jump the raw coordinates would otherwise
 * represent - see polygonValidation.js's own identically-named helper
 * for the full comment.
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

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/*
 * Real-world length of a LineString in meters (haversine, summed
 * across every segment) - not just an abstract degree-distance, so it
 * can actually be used for things like travel-time-from-speed later.
 */
export function computeLineDistanceMeters(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  let total = 0;

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const [lng1, lat1] = coordinates[i];
    const [lng2, lat2] = coordinates[i + 1];

    if (
      !Number.isFinite(lng1) ||
      !Number.isFinite(lat1) ||
      !Number.isFinite(lng2) ||
      !Number.isFinite(lat2)
    ) {
      return null;
    }

    total += haversineMeters(lat1, lng1, lat2, lng2);
  }

  return total;
}

/*
 * The point at exactly half the line's real-world length, walking the
 * segments (by haversine length) and interpolating - not just the
 * middle vertex index, which can be off-center on unevenly spaced
 * lines. Used for anchoring map popups and, later, whole-line drag.
 */
export function computeLineMidpoint(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const segmentLengths = [];
  let totalLength = 0;

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const [lng1, lat1] = coordinates[i];
    const [lng2, lat2] = coordinates[i + 1];

    if (
      !Number.isFinite(lng1) ||
      !Number.isFinite(lat1) ||
      !Number.isFinite(lng2) ||
      !Number.isFinite(lat2)
    ) {
      return null;
    }

    const length = haversineMeters(lat1, lng1, lat2, lng2);
    segmentLengths.push(length);
    totalLength += length;
  }

  if (totalLength === 0) {
    const [lng, lat] = coordinates[0];
    return { lat, lng };
  }

  const halfLength = totalLength / 2;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i += 1) {
    const segmentLength = segmentLengths[i];

    if (accumulated + segmentLength >= halfLength) {
      const remaining = halfLength - accumulated;
      const fraction = segmentLength === 0 ? 0 : remaining / segmentLength;

      const [lng1, lat1] = coordinates[i];
      const [lng2, lat2] = coordinates[i + 1];

      /*
       * lng2 gets shifted by a whole 360 here, not lerped raw, if this
       * one segment itself crosses the antimeridian (e.g. 179 -> -179,
       * an actual ~2 degree step) - otherwise a naive lerp between the
       * raw values would walk the "long way" across the whole map
       * instead of the short hop across the dateline. The result is
       * normalized back into -180..180 after interpolating, since a
       * midpoint is just one storable point with no wraparound-
       * representation ambiguity the way a bbox range has.
       */
      let unwrappedLng2 = lng2;
      const deltaLng = lng2 - lng1;
      if (deltaLng > 180) unwrappedLng2 -= 360;
      else if (deltaLng < -180) unwrappedLng2 += 360;

      return {
        lat: lat1 + (lat2 - lat1) * fraction,
        lng: normalizeLongitude(lng1 + (unwrappedLng2 - lng1) * fraction),
      };
    }

    accumulated += segmentLength;
  }

  const [lng, lat] = coordinates[coordinates.length - 1];
  return { lat, lng };
}

/*
 * The centroid of the closed shape you'd get by connecting this
 * line's last point back to its first, treating its vertices as a
 * polygon ring - the same area-weighted formula
 * shared/validation/polygonValidation.js's computePolygonCentroid
 * uses for a genuine Polygon, applied here to a line instead. Unlike
 * the arc-length midpoint (computeLineMidpoint above, which is always
 * a point that lies ON the line), this can land off the line itself,
 * similar to how a Polygon's centroid isn't necessarily inside every
 * concave shape - useful as an alternative popup anchor for lines
 * that loop or double back on themselves.
 *
 * Falls back to the plain average of the line's vertices when that
 * shape has ~zero enclosed area (a perfectly straight line, or a
 * 2-point line, which has no interior at all), the same way
 * computePolygonCentroid falls back for a degenerate polygon ring.
 */
export function computeLineCentroid(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  for (const pair of coordinates) {
    if (!isValidLngLatPair(pair)) return null;
  }

  /*
   * Closed first (raw), then unwrapped as one continuous sequence (see
   * unwrapRingLongitudes' own comment) - closing before unwrapping,
   * rather than after, is what lets the closing edge itself (last
   * point back to first) get the same correct shortest-hop treatment
   * as every other edge, instead of naively reconnecting to the
   * first point's own unshifted position regardless of how far the
   * line's own longitude drifted by its last vertex. The final result
   * is normalized back into -180..180 below, since a centroid is just
   * one storable point with no wraparound-representation ambiguity the
   * way a bbox range has.
   */
  const closedRing = unwrapRingLongitudes([
    ...coordinates,
    coordinates[0],
  ]);

  const unwrappedCoordinates = closedRing.slice(0, -1);

  let areaTwice = 0;
  let cx = 0;
  let cy = 0;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (let i = 0; i < closedRing.length - 1; i += 1) {
    const current = closedRing[i];
    const next = closedRing[i + 1];

    const x0 = Number(current[0]);
    const y0 = Number(current[1]);
    const x1 = Number(next[0]);
    const y1 = Number(next[1]);

    if (x0 < minLng) minLng = x0;
    if (x0 > maxLng) maxLng = x0;
    if (y0 < minLat) minLat = y0;
    if (y0 > maxLat) maxLat = y0;

    const cross = x0 * y1 - x1 * y0;
    areaTwice += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  const area = areaTwice / 2;

  function averageOfVertices() {
    let lngSum = 0;
    let latSum = 0;

    for (const pair of unwrappedCoordinates) {
      lngSum += Number(pair[0]);
      latSum += Number(pair[1]);
    }

    return {
      lat: latSum / unwrappedCoordinates.length,
      lng: normalizeLongitude(lngSum / unwrappedCoordinates.length),
    };
  }

  if (Math.abs(area) < 1e-12) {
    return averageOfVertices();
  }

  const candidateLng = cx / (6 * area);
  const candidateLat = cy / (6 * area);

  /*
   * A LineString's own "centroid" is the area centroid of the shape
   * formed by artificially closing it (connecting its last point back
   * to its first) - a genuinely enclosed ring's area centroid always
   * lies within its own bounding box, but a road (or any other mostly-
   * straight path) closes into a ring with an almost-zero enclosed
   * area despite not being perfectly straight. Dividing by that near-
   * zero area amplifies ordinary floating-point noise into a result
   * that can land wildly outside the line entirely - confirmed against
   * a real Cambridge GeoHub road import, where a 4-point road segment
   * whose shoelace area came out to ~8e-11 (comfortably above the
   * exact-zero '< 1e-12' check, but still numerically unstable to
   * divide by) produced a "centroid" almost half a degree of longitude
   * away from the actual road - which the popup then anchored to,
   * appearing to point at a completely unrelated spot on the map. A
   * small relative padding (scaled to the ring's own extent, not a
   * fixed degree amount) still allows a legitimately near-boundary
   * centroid through; anything further out falls back to the plain
   * vertex average instead, the same fallback the exact-zero case
   * already used.
   */
  const paddingLng = (maxLng - minLng) * 1e-6;
  const paddingLat = (maxLat - minLat) * 1e-6;

  const isWithinBounds =
    candidateLng >= minLng - paddingLng &&
    candidateLng <= maxLng + paddingLng &&
    candidateLat >= minLat - paddingLat &&
    candidateLat <= maxLat + paddingLat;

  if (!isWithinBounds) {
    return averageOfVertices();
  }

  return {
    lat: candidateLat,
    lng: normalizeLongitude(candidateLng),
  };
}

/*
 * Client-side helper analogous to sanitizePolygonGeometry: attaches a
 * freshly computed distance/midpoint/centroid to a raw LineString
 * geometry. Used when a line is drawn or moved (draftGeometry.js) and
 * when a motion record is saved (MainApp.jsx) - the single shared
 * entry point for both, so there's no separate front-end-only
 * calculation that could drift from what the server recomputes to
 * validate.
 *
 * Always recomputed from the cleaned coordinates, never trusting an
 * already-present distance/midpoint/centroid (an import source's own,
 * or anything else on the raw payload) - per Brody's own call, after
 * a real-world import turned up a LineString whose own numerically
 * unstable centroid (see computeLineCentroid's own comment) could have
 * silently slipped through if this had preferred that already-present
 * value instead of recomputing it here. Recomputing means the derived
 * fields always match the coordinates they came from, and a
 * genuinely bad geometry is far more likely to be caught by
 * validateLineStringGeometry's own recompute-and-compare check
 * afterward, rather than an untrustworthy external value passing
 * through unchecked.
 */
export function sanitizeLineStringGeometry(rawGeometry) {
  if (!rawGeometry || typeof rawGeometry !== "object") return null;
  if (rawGeometry.type !== "LineString") return null;

  const coordinates = rawGeometry.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const cleanedCoordinates = coordinates.map((pair) => {
    if (!isValidLngLatPair(pair)) return null;
    return [Number(pair[0]), Number(pair[1])];
  });

  if (cleanedCoordinates.some((pair) => pair === null)) return null;

  const distance = computeLineDistanceMeters(cleanedCoordinates);
  const midpoint = computeLineMidpoint(cleanedCoordinates);
  const centroid = computeLineCentroid(cleanedCoordinates);

  if (distance == null || !midpoint || !centroid) return null;

  return {
    type: "LineString",
    coordinates: cleanedCoordinates,
    lineColor: normalizeHexColor(rawGeometry.lineColor, DEFAULT_LINE_COLOR),
    distance,
    midpoint,
    centroid,
  };
}

/*
 * Strict validator for a LineString geometry that includes real
 * coordinates (add, and the move/drag route): requires distance and
 * midpoint to be present and to match what's recomputed from the
 * coordinates, mirroring how validatePolygonGeometry checks bbox and
 * centroid. Rejects rather than silently recomputing/overwriting, so
 * a mismatch here means the payload was tampered with.
 */
export function validateLineStringGeometry(geometry) {
  if (
    !hasExactKeys(geometry, [
      "type",
      "coordinates",
      "lineColor",
      "distance",
      "midpoint",
      "centroid",
    ])
  ) {
    return false;
  }

  if (geometry.type !== "LineString") return false;

  const coordinates = geometry.coordinates;

  if (!Array.isArray(coordinates)) return false;
  if (coordinates.length < 2) return false;

  if (
    coordinates.length >
    GEOMETRY_LIMITS.maxCoordinatesPerGeometry
  ) {
    return false;
  }

  for (const pair of coordinates) {
    if (!isValidLngLatPair(pair)) return false;
  }

  if (!isValidHexColor(geometry.lineColor)) {
    return false;
  }

  const distance = geometry.distance;

  if (typeof distance !== "number" || !Number.isFinite(distance)) {
    return false;
  }

  const computedDistance = computeLineDistanceMeters(coordinates);

  if (computedDistance == null) return false;

  if (
    Math.abs(distance - computedDistance) >
    LINE_DISTANCE_TOLERANCE_METERS
  ) {
    return false;
  }

  const midpoint = geometry.midpoint;

  if (!isPlainObject(midpoint)) return false;

  const midpointLat = Number(midpoint.lat);
  const midpointLng = Number(midpoint.lng);

  if (!Number.isFinite(midpointLat) || !Number.isFinite(midpointLng)) {
    return false;
  }

  const computedMidpoint = computeLineMidpoint(coordinates);

  if (!computedMidpoint) return false;

  if (
    Math.abs(midpointLat - computedMidpoint.lat) >
    LINE_MIDPOINT_TOLERANCE_DEGREES
  ) {
    return false;
  }

  if (
    Math.abs(midpointLng - computedMidpoint.lng) >
    LINE_MIDPOINT_TOLERANCE_DEGREES
  ) {
    return false;
  }

  const centroid = geometry.centroid;

  if (!isPlainObject(centroid)) return false;

  const centroidLat = Number(centroid.lat);
  const centroidLng = Number(centroid.lng);

  if (
    !Number.isFinite(centroidLat) ||
    !Number.isFinite(centroidLng)
  ) {
    return false;
  }

  const computedCentroid = computeLineCentroid(coordinates);

  if (!computedCentroid) return false;

  if (
    Math.abs(centroidLat - computedCentroid.lat) >
    LINE_CENTROID_TOLERANCE_DEGREES
  ) {
    return false;
  }

  if (
    Math.abs(centroidLng - computedCentroid.lng) >
    LINE_CENTROID_TOLERANCE_DEGREES
  ) {
    return false;
  }

  return true;
}

/*
 * Update-mode validator: the regular update route only ever changes
 * color for an existing LineString (never coordinates - that's only
 * ever done through add or the move/drag route), so the payload is
 * expected to carry just type + lineColor. Anything else present
 * (coordinates included) is rejected outright rather than validated,
 * since a legitimate update never needs to send it.
 */
export function validateLineStringGeometryForUpdate(geometry) {
  if (!hasExactKeys(geometry, ["type", "lineColor"])) {
    return false;
  }

  if (geometry.type !== "LineString") return false;

  return isValidHexColor(geometry.lineColor);
}
