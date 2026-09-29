// src/boundaries/utils/clipToBoundary.js

import {
  BOUNDARY_FILTER_TYPE_OPTIONS,
  DEFAULT_BOUNDARY_FILTER_TYPE,
} from "../../../shared/validation/validationConstants.js";

/*
 * Spatially clips a project's own data items to a boundary. Used by
 * both the Aggregates and Layers tools - three modes, chosen per
 * aggregate/layer (`boundaryFilterType` - see BOUNDARY_FILTER_TYPE_OPTIONS' own
 * comment in validationConstants.js), applied *before* the ordinary
 * filterState filters run so the two stack in a predictable order.
 *
 * Hand-rolled rather than pulled from @turf (which is a declared
 * dependency but entirely unused): Mapdex computes all of its own
 * geometry math this way already (bbox/centroid/shoelace area, with
 * their own antimeridian handling, across shared/validation/*), and a
 * boundary here is a far simpler shape than the general case turf
 * solves for. Boundary validation (aggregateValidation.js's own
 * isValidBoundaryMultiPolygonGeometry) requires every polygon entry to
 * hold exactly one ring, so **a boundary never has holes** - which
 * removes the usual even-odd/hole bookkeeping and makes "inside the
 * boundary" simply "inside any one of its rings".
 */

function getBoundaryRings(boundaryGeometry) {
  const coordinates = boundaryGeometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];

  if (boundaryGeometry.type === "Polygon") {
    const ring = coordinates[0];
    return Array.isArray(ring) ? [ring] : [];
  }

  if (boundaryGeometry.type === "MultiPolygon") {
    return coordinates
      .map((polygonEntry) => polygonEntry?.[0])
      .filter((ring) => Array.isArray(ring));
  }

  return [];
}

/*
 * Standard ray-casting parity test. Points exactly on an edge are not
 * guaranteed either way (the classic degenerate case) - acceptable
 * here, since a data item landing precisely on a hand-drawn boundary's
 * edge is vanishingly rare and either answer is defensible.
 */
function isPointInRing(lng, lat, ring) {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.[0]);
    const yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]);
    const yj = Number(ring[j]?.[1]);

    if (!Number.isFinite(xi) || !Number.isFinite(yi)) continue;
    if (!Number.isFinite(xj) || !Number.isFinite(yj)) continue;

    const straddlesRay = yi > lat !== yj > lat;
    if (!straddlesRay) continue;

    const intersectX = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (lng < intersectX) inside = !inside;
  }

  return inside;
}

function isPointInBoundary(lng, lat, rings) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;

  return rings.some((ring) => isPointInRing(lng, lat, ring));
}

function orientation(ax, ay, bx, by, cx, cy) {
  const value = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);

  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function isOnSegment(ax, ay, bx, by, px, py) {
  return (
    Math.min(ax, bx) <= px &&
    px <= Math.max(ax, bx) &&
    Math.min(ay, by) <= py &&
    py <= Math.max(ay, by)
  );
}

function segmentsIntersect(a, b, c, d) {
  const [ax, ay] = a;
  const [bx, by] = b;
  const [cx, cy] = c;
  const [dx, dy] = d;

  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);

  if (o1 !== o2 && o3 !== o4) return true;

  /* Collinear touching cases. */
  if (o1 === 0 && isOnSegment(ax, ay, bx, by, cx, cy)) return true;
  if (o2 === 0 && isOnSegment(ax, ay, bx, by, dx, dy)) return true;
  if (o3 === 0 && isOnSegment(cx, cy, dx, dy, ax, ay)) return true;
  if (o4 === 0 && isOnSegment(cx, cy, dx, dy, bx, by)) return true;

  return false;
}

function isFinitePair(pair) {
  return (
    Array.isArray(pair) &&
    pair.length >= 2 &&
    Number.isFinite(Number(pair[0])) &&
    Number.isFinite(Number(pair[1]))
  );
}

/*
 * Every coordinate pair in a geometry, flattened - the nesting depth
 * differs per type (Point is one pair, MultiPolygon is four levels
 * deep), so this walks the array rather than switching on type.
 */
function collectCoordinatePairs(node, output) {
  if (!Array.isArray(node)) return output;

  if (isFinitePair(node) && !Array.isArray(node[0])) {
    output.push([Number(node[0]), Number(node[1])]);
    return output;
  }

  for (const child of node) {
    collectCoordinatePairs(child, output);
  }

  return output;
}

/*
 * Every edge (consecutive coordinate pair) in a geometry. Points and
 * MultiPoints have none, which is what makes "Any Overlap" fall back
 * to a pure vertex test for them.
 */
function collectSegments(geometry) {
  const segments = [];

  const addRun = (run) => {
    const pairs = collectCoordinatePairs(run, []);

    for (let i = 1; i < pairs.length; i++) {
      segments.push([pairs[i - 1], pairs[i]]);
    }
  };

  const { type, coordinates } = geometry;

  if (type === "LineString") addRun(coordinates);
  if (type === "Polygon" || type === "MultiLineString") {
    (coordinates || []).forEach(addRun);
  }
  if (type === "MultiPolygon") {
    (coordinates || []).forEach((polygonEntry) =>
      (polygonEntry || []).forEach(addRun),
    );
  }

  return segments;
}

function getRepresentativePoint(geometry) {
  if (geometry?.type === "Point") {
    const coordinates = geometry.coordinates;
    if (!isFinitePair(coordinates)) return null;

    return { lng: Number(coordinates[0]), lat: Number(coordinates[1]) };
  }

  const centroid = geometry?.centroid;
  const lng = Number(centroid?.lng);
  const lat = Number(centroid?.lat);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  return { lng, lat };
}

export function isGeometryWithinBoundary(geometry, boundaryGeometry, boundaryFilterType) {
  if (!geometry?.type) return false;

  const rings = getBoundaryRings(boundaryGeometry);
  if (rings.length === 0) return false;

  if (boundaryFilterType === "Centroid Inside") {
    const point = getRepresentativePoint(geometry);
    if (!point) return false;

    return isPointInBoundary(point.lng, point.lat, rings);
  }

  const pairs = collectCoordinatePairs(geometry.coordinates, []);
  if (pairs.length === 0) return false;

  if (boundaryFilterType === "Fully Inside") {
    return pairs.every(([lng, lat]) => isPointInBoundary(lng, lat, rings));
  }

  if (boundaryFilterType === "Any Overlap") {
    if (pairs.some(([lng, lat]) => isPointInBoundary(lng, lat, rings))) {
      return true;
    }

    /*
     * A shape can overlap without any of its own vertices being inside
     * - a road passing straight through with both ends outside, or an
     * area large enough to swallow the boundary whole. The first is an
     * edge crossing; the second shows up as a boundary vertex sitting
     * inside the item, which is why that direction is tested too.
     */
    const segments = collectSegments(geometry);

    for (const ring of rings) {
      for (let i = 1; i < ring.length; i++) {
        const edgeStart = [Number(ring[i - 1][0]), Number(ring[i - 1][1])];
        const edgeEnd = [Number(ring[i][0]), Number(ring[i][1])];

        for (const [segmentStart, segmentEnd] of segments) {
          if (segmentsIntersect(segmentStart, segmentEnd, edgeStart, edgeEnd)) {
            return true;
          }
        }
      }
    }

    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      const itemRings =
        geometry.type === "Polygon"
          ? [geometry.coordinates?.[0]]
          : (geometry.coordinates || []).map((polygonEntry) => polygonEntry?.[0]);

      return rings.some((ring) =>
        ring.some((pair) => {
          if (!isFinitePair(pair)) return false;

          return itemRings.some(
            (itemRing) =>
              Array.isArray(itemRing) &&
              isPointInRing(Number(pair[0]), Number(pair[1]), itemRing),
          );
        }),
      );
    }

    return false;
  }

  return true;
}

/*
 * Clips a whole dataset. A missing boundary geometry means "no
 * clipping" rather than "nothing passes", so an aggregate whose
 * boundary was deleted still shows its filterState results instead of
 * silently reading as empty.
 */
export function clipDataToBoundary(data, boundaryGeometry, boundaryFilterType) {
  const safeData = Array.isArray(data) ? data : [];
  if (!boundaryGeometry?.type) return safeData;

  const mode = BOUNDARY_FILTER_TYPE_OPTIONS.includes(boundaryFilterType)
    ? boundaryFilterType
    : DEFAULT_BOUNDARY_FILTER_TYPE;

  return safeData.filter((dataItem) =>
    isGeometryWithinBoundary(dataItem?.geometry, boundaryGeometry, mode),
  );
}
