// src/exports/boundaries/exportBoundaries.js

import { buildBoundaryFeature } from "../../../shared/exports/geoJSONExport.js";
import { downloadGeoJSON } from "../utils/downloadGeoJSON.js";

/*
 * Boundaries export as themselves - a Feature each, with the name,
 * colours and centroid in properties and the bbox after the geometry.
 * There is no schema or data to carry, so these are the simplest of the
 * exports.
 */
export function exportBoundary({ boundary, system }) {
  if (!boundary?._id) return false;

  downloadGeoJSON(
    buildBoundaryFeature(boundary),
    `${boundary.name || "boundary"}-${boundary._id}`,
  );

  system?.notify?.("Boundary exported.");
  return true;
}

/*
 * The Boundaries page's own "export visible boundaries" - whichever are
 * checked visible, as one FeatureCollection.
 */
export function exportBoundaries({ schema, boundaries, system }) {
  const docs = Array.isArray(boundaries) ? boundaries : [];

  if (docs.length === 0) {
    system?.notify?.("No visible boundaries to export.");
    return false;
  }

  const geojson = {
    type: "FeatureCollection",
    features: docs.map(buildBoundaryFeature),
  };

  downloadGeoJSON(geojson, `${schema?.projectName || "project"}-boundaries`);

  system?.notify?.("Boundaries exported.");
  return true;
}
