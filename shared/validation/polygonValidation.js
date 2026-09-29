// shared/neighbourhoods/validation.js

const DEFAULT_BORDER_COLOR = "#2563eb";
const DEFAULT_FILL_COLOR = "#3b82f6";

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidLngLatPair(pair) {
  return (
    Array.isArray(pair) &&
    pair.length >= 2 &&
    isFiniteNumber(pair[0]) &&
    isFiniteNumber(pair[1]) &&
    pair[0] >= -180 &&
    pair[0] <= 180 &&
    pair[1] >= -85 &&
    pair[1] <= 85
  );
}

export function pairsMatch(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length >= 2 &&
    b.length >= 2 &&
    Number(a[0]) === Number(b[0]) &&
    Number(a[1]) === Number(b[1])
  );
}

export function sanitizeBBox(rawBBox) {
  if (!Array.isArray(rawBBox) || rawBBox.length !== 4) {
    return null;
  }

  const nums = rawBBox.map((v) => Number(v));

  if (!nums.every(Number.isFinite)) {
    return null;
  }

  const [minLng, minLat, maxLng, maxLat] = nums;

  if (
    minLng < -180 ||
    minLng > 180 ||
    maxLng < -180 ||
    maxLng > 180 ||
    minLat < -85 ||
    minLat > 85 ||
    maxLat < -85 ||
    maxLat > 85
  ) {
    return null;
  }

  if (minLng > maxLng || minLat > maxLat) {
    return null;
  }

  return [minLng, minLat, maxLng, maxLat];
}

export function sanitizeCentroid(rawCentroid) {
  if (!rawCentroid || typeof rawCentroid !== "object") {
    return null;
  }

  const lat = Number(rawCentroid.lat);
  const lng = Number(rawCentroid.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -85 || lat > 85 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng };
}

export function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return fallback;
}

/*
 * Wraps a longitude back into the normal -180..180 range - the inverse
 * of unwrapRingLongitudes below, used once a computation done in
 * "unwrapped" (locally continuous, possibly outside -180..180) space
 * needs to become a single storable point again. A centroid is just
 * one point, so this has no representation ambiguity the way a
 * wrapped-bbox's own "which side is west" convention would; it always
 * has exactly one correct normalized value.
 */
function normalizeLongitude(lng) {
  return ((lng + 180) % 360 + 360) % 360 - 180;
}

/*
 * Returns a copy of `points` with longitudes "unwrapped" - shifted by
 * whole multiples of 360 wherever two consecutive points jump by more
 * than 180 degrees - so a path that crosses the antimeridian (e.g.
 * 179 -> -179, an actual ~2 degree step) reads as a short, locally
 * continuous line for area/centroid math instead of the ~358 degree
 * jump the raw coordinates would otherwise represent. The shoelace
 * formula below has no native concept of longitude wrapping, so this
 * is what keeps a dateline-crossing ring's own centroid from landing
 * somewhere nonsensical. Mirrors src/map/utils/draftGeometry.js's own
 * identically-named helper (used there for the self-intersection
 * checks) - kept as a separate copy here rather than a shared import,
 * matching this file's own existing pattern of small helpers
 * duplicated per validation file rather than centralized.
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

export function computeBBox(geometry) {
  const ring = geometry?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const pair of ring) {
    if (!isValidLngLatPair(pair)) return null;

    const lng = Number(pair[0]);
    const lat = Number(pair[1]);

    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }

  return [minLng, minLat, maxLng, maxLat];
}

export function computePolygonCentroid(geometry) {
  const rawRing = geometry?.coordinates?.[0];
  if (!Array.isArray(rawRing) || rawRing.length < 4) return null;

  for (const pair of rawRing) {
    if (!isValidLngLatPair(pair)) return null;
  }

  /*
   * Unwrapped once up front - see unwrapRingLongitudes' own comment -
   * so a ring that crosses the antimeridian gets a correct area/
   * centroid instead of the shoelace formula misreading the ~358
   * degree jump a raw dateline crossing (e.g. 179 -> -179) would
   * otherwise look like. The final result gets normalized back into
   * -180..180 below, since a centroid is just one storable point with
   * no wraparound-representation ambiguity the way a bbox range has.
   */
  const ring = unwrapRingLongitudes(rawRing);

  let areaTwice = 0;
  let cx = 0;
  let cy = 0;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (let i = 0; i < ring.length - 1; i += 1) {
    const current = ring[i];
    const next = ring[i + 1];

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
    let count = 0;

    for (let i = 0; i < ring.length - 1; i += 1) {
      const pair = ring[i];
      lngSum += Number(pair[0]);
      latSum += Number(pair[1]);
      count += 1;
    }

    if (!count) return null;

    return {
      lat: latSum / count,
      lng: normalizeLongitude(lngSum / count),
    };
  }

  if (Math.abs(area) < 1e-12) {
    return averageOfVertices();
  }

  const candidateLng = cx / (6 * area);
  const candidateLat = cy / (6 * area);

  /*
   * A genuine area-weighted centroid of a simple ring always lies
   * within its own bounding box. When the enclosed area is extremely
   * small relative to the coordinates involved - a near-straight,
   * barely-bent ring, common when this is really a LineString's own
   * artificially-closed "ring" (lineStringValidation.js's own
   * computeLineCentroid, which mirrors this same fallback) rather
   * than a genuine area - dividing by that tiny area amplifies
   * ordinary floating-point noise into a result that can land wildly
   * outside the shape entirely, even though the exact-zero check above
   * only catches a perfectly straight ring, not one that merely bends
   * by a negligible amount. A small relative padding (scaled to the
   * ring's own extent, not a fixed degree amount) still allows a
   * legitimately near-boundary centroid through.
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

export function sanitizePolygonGeometry(rawGeometry) {
  if (!rawGeometry || typeof rawGeometry !== "object") return null;
  if (rawGeometry.type !== "Polygon") return null;

  const coordinates = rawGeometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

  const outerRing = coordinates[0];
  if (!Array.isArray(outerRing) || outerRing.length < 4) return null;

  const cleanedOuterRing = outerRing.map((pair) => {
    if (!isValidLngLatPair(pair)) return null;
    return [Number(pair[0]), Number(pair[1])];
  });

  if (cleanedOuterRing.some((pair) => pair === null)) return null;

  const first = cleanedOuterRing[0];
  const last = cleanedOuterRing[cleanedOuterRing.length - 1];

  if (!pairsMatch(first, last)) {
    cleanedOuterRing.push([...first]);
  }

  if (cleanedOuterRing.length < 4) return null;

  const cleanedGeometry = {
    type: "Polygon",
    coordinates: [cleanedOuterRing],
  };

  /*
   * Always recomputed from the cleaned coordinates, never trusting an
   * already-present bbox/centroid (an import source's own, or
   * anything else on the raw payload) - per Brody's own call, after a
   * real-world import turned up a LineString whose own numerically
   * unstable centroid (see computeLineCentroid's own comment) could
   * have silently slipped through if this had preferred that already-
   * present value instead. Recomputing here means the derived fields
   * always match the coordinates they were computed from, and a
   * genuinely bad geometry is far more likely to be caught by
   * validatePolygonGeometry's own recompute-and-compare check
   * afterward, rather than an untrustworthy external value passing
   * through unchecked.
   */
  const bbox = computeBBox(cleanedGeometry);
  const centroid = computePolygonCentroid(cleanedGeometry);

  if (!bbox || !centroid) return null;

  cleanedGeometry.bbox = bbox;
  cleanedGeometry.centroid = centroid;
  cleanedGeometry.borderColor = normalizeHexColor(
    rawGeometry.borderColor,
    DEFAULT_BORDER_COLOR,
  );
  cleanedGeometry.fillColor = normalizeHexColor(
    rawGeometry.fillColor,
    DEFAULT_FILL_COLOR,
  );

  return cleanedGeometry;
}

/*
 * Update-mode validator: the regular update route only ever changes
 * color for an existing Polygon (never coordinates - that's only
 * ever done through add; there's no move/drag route for polygons),
 * so the payload is expected to carry just type + borderColor +
 * fillColor. Anything else present (coordinates, bbox, centroid
 * included) is rejected outright rather than validated, since a
 * legitimate update never needs to send it.
 */
export function validatePolygonGeometryForUpdate(rawGeometry) {
  if (!rawGeometry || typeof rawGeometry !== "object") return false;
  if (rawGeometry.type !== "Polygon") return false;

  const allowedKeys = new Set(["type", "borderColor", "fillColor"]);

  if (!Object.keys(rawGeometry).every((key) => allowedKeys.has(key))) {
    return false;
  }

  if (
    normalizeHexColor(rawGeometry.borderColor, null) !==
    rawGeometry.borderColor
  ) {
    return false;
  }

  if (
    normalizeHexColor(rawGeometry.fillColor, null) !== rawGeometry.fillColor
  ) {
    return false;
  }

  return true;
}

export function validatePolygonGeometry(rawGeometry) {
  if (!rawGeometry || typeof rawGeometry !== "object") return false;
  if (rawGeometry.type !== "Polygon") return false;

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
  if (!Array.isArray(coordinates) || coordinates.length !== 1) return false;

  const outerRing = coordinates[0];
  if (!Array.isArray(outerRing) || outerRing.length < 4) return false;

  for (const pair of outerRing) {
    if (!isValidLngLatPair(pair)) return false;
  }

  const first = outerRing[0];
  const last = outerRing[outerRing.length - 1];

  if (!pairsMatch(first, last)) {
    return false;
  }

  const bbox = sanitizeBBox(rawGeometry.bbox);
  if (!bbox) return false;

  const centroid = sanitizeCentroid(rawGeometry.centroid);
  if (!centroid) return false;

  if (normalizeHexColor(rawGeometry.borderColor, null) !== rawGeometry.borderColor) {
    return false;
  }

  if (normalizeHexColor(rawGeometry.fillColor, null) !== rawGeometry.fillColor) {
    return false;
  }

  const computedBBox = computeBBox(rawGeometry);
  if (!computedBBox) return false;

  const bboxMatches =
    bbox.length === computedBBox.length &&
    bbox.every((value, index) => Number(value) === Number(computedBBox[index]));

  if (!bboxMatches) {
    return false;
  }

  const computedCentroid = computePolygonCentroid(rawGeometry);
  if (!computedCentroid) return false;

  const centroidTolerance = 1e-9;

  if (Math.abs(centroid.lat - computedCentroid.lat) > centroidTolerance) {
    return false;
  }

  if (Math.abs(centroid.lng - computedCentroid.lng) > centroidTolerance) {
    return false;
  }

  return true;
}