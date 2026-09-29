// src/map/popup/getRepresentativeLngLat.js

function isFiniteCoordinatePair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return false;

  return (
    Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]))
  );
}

/*
 * True geometric midpoint of a LineString by arc length (not just the
 * middle vertex index, which can be off-center when vertices are
 * unevenly spaced), walking the segments and interpolating the point
 * at half the total length.
 */
function getLineMidpoint(coordinates) {
  const validCoordinates = coordinates.filter(isFiniteCoordinatePair);

  if (validCoordinates.length < 2) {
    return validCoordinates[0] || null;
  }

  const segmentLengths = [];
  let totalLength = 0;

  for (let i = 0; i < validCoordinates.length - 1; i += 1) {
    const [lng1, lat1] = validCoordinates[i];
    const [lng2, lat2] = validCoordinates[i + 1];

    const length = Math.hypot(lng2 - lng1, lat2 - lat1);

    segmentLengths.push(length);
    totalLength += length;
  }

  if (totalLength === 0) {
    return validCoordinates[0];
  }

  const halfLength = totalLength / 2;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i += 1) {
    const segmentLength = segmentLengths[i];

    if (accumulated + segmentLength >= halfLength) {
      const remaining = halfLength - accumulated;
      const fraction = segmentLength === 0 ? 0 : remaining / segmentLength;

      const [lng1, lat1] = validCoordinates[i];
      const [lng2, lat2] = validCoordinates[i + 1];

      return [
        lng1 + (lng2 - lng1) * fraction,
        lat1 + (lat2 - lat1) * fraction,
      ];
    }

    accumulated += segmentLength;
  }

  return validCoordinates[validCoordinates.length - 1];
}

/*
 * Picks a single [lng, lat] point to anchor a popup to, shared by both
 * the Mapbox and Leaflet selected-item popups so they point at the
 * same spot: Points anchor at themselves, lines anchor at their
 * stored centroid (shared/validation/lineStringValidation.js
 * - the centroid of the shape formed by treating the line's own
 * vertices as a closed ring, which can be a better popup anchor than
 * a point that's necessarily on the line itself for a line that loops
 * or doubles back), and polygons use their stored centroid
 * (geometry.centroid, populated by shared/validation/polygonValidation.js),
 * falling back to the first ring coordinate if it's ever missing.
 */
export function getRepresentativeLngLat(geometry, centroid) {
  if (!geometry) return null;

  if (geometry.type === "Point") {
    return isFiniteCoordinatePair(geometry.coordinates)
      ? geometry.coordinates
      : null;
  }

  if (geometry.type === "LineString") {
    /*
     * Saved lines already carry a computed, authoritative
     * centroid - use it instead of recomputing a live
     * approximation. Only an in-progress draft (not yet run through
     * completeDraftGeometry) would lack it, in which case this falls
     * back to the live arc-length midpoint as a reasonable
     * approximation until the line is finished.
     */
    const storedCentroidLat = Number(geometry.centroid?.lat);
    const storedCentroidLng = Number(geometry.centroid?.lng);

    if (
      Number.isFinite(storedCentroidLat) &&
      Number.isFinite(storedCentroidLng)
    ) {
      return [storedCentroidLng, storedCentroidLat];
    }

    const coordinates = geometry.coordinates;

    if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

    return getLineMidpoint(coordinates);
  }

  if (geometry.type === "Polygon") {
    const centroidLng = Number(centroid?.lng);
    const centroidLat = Number(centroid?.lat);

    if (Number.isFinite(centroidLng) && Number.isFinite(centroidLat)) {
      return [centroidLng, centroidLat];
    }

    const outerRing = geometry.coordinates?.[0];

    if (Array.isArray(outerRing) && isFiniteCoordinatePair(outerRing[0])) {
      return outerRing[0];
    }

    return null;
  }

  /*
   * MultiPoint/MultiPolygon anchor at their own stored group centroid
   * (shared/validation/multiPointValidation.js/multiPolygonValidation.js
   * - the average of each individual point/polygon's own centroid) -
   * one popup for the whole item, not one per sub-shape, since
   * selecting any part of a multi-geometry selects the whole thing.
   */
  if (geometry.type === "MultiPoint" || geometry.type === "MultiPolygon") {
    const centroidLng = Number(centroid?.lng);
    const centroidLat = Number(centroid?.lat);

    if (Number.isFinite(centroidLng) && Number.isFinite(centroidLat)) {
      return [centroidLng, centroidLat];
    }

    if (geometry.type === "MultiPoint") {
      const firstPoint = geometry.coordinates?.[0];
      return isFiniteCoordinatePair(firstPoint) ? firstPoint : null;
    }

    const firstRing = geometry.coordinates?.[0]?.[0];

    if (Array.isArray(firstRing) && isFiniteCoordinatePair(firstRing[0])) {
      return firstRing[0];
    }

    return null;
  }

  /*
   * MultiLineString anchors at its own stored group centroid
   * (shared/validation/multiLineStringValidation.js - the average of
   * each individual line's own centroid), falling back to the
   * first line's own live midpoint for an in-progress draft the same
   * way LineString does above.
   */
  if (geometry.type === "MultiLineString") {
    const storedCentroidLat = Number(geometry.centroid?.lat);
    const storedCentroidLng = Number(geometry.centroid?.lng);

    if (
      Number.isFinite(storedCentroidLat) &&
      Number.isFinite(storedCentroidLng)
    ) {
      return [storedCentroidLng, storedCentroidLat];
    }

    const firstLine = geometry.coordinates?.[0];

    if (!Array.isArray(firstLine) || firstLine.length === 0) return null;

    return getLineMidpoint(firstLine);
  }

  return null;
}
