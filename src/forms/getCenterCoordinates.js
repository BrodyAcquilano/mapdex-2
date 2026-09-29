export function getCenterCoordinates(dataItem) {
  const geometryType = dataItem?.geometry?.type;

  if (geometryType === "Point") {
    const coords = dataItem?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) return null;

    const lng = Number(coords[0]);
    const lat = Number(coords[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  }

  if (geometryType === "Polygon" || geometryType === "MultiPoint" || geometryType === "MultiPolygon") {
    const centroid = dataItem?.geometry?.centroid;
    const lat = Number(centroid?.lat);
    const lng = Number(centroid?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  }

  /*
   * LineString itself was never handled here before MultiLineString
   * existed (this function simply wasn't called for it) - both it and
   * MultiLineString store their own popup anchor in the same
   * centroid field (shared/validation/lineStringValidation.js/
   * multiLineStringValidation.js), so they share this one branch
   * rather than LineString staying unhandled while only its multi-
   * counterpart got support.
   */
  if (geometryType === "LineString" || geometryType === "MultiLineString") {
    const centroid = dataItem?.geometry?.centroid;
    const lat = Number(centroid?.lat);
    const lng = Number(centroid?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  }

  return null;
}