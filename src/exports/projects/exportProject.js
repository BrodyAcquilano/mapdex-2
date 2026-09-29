// src/exports/projects/exportProject.js

import { buildProjectGeoJSON } from "../../../shared/exports/geoJSONExport.js";
import { downloadGeoJSON } from "../utils/downloadGeoJSON.js";

/*
 * The whole project, and the filter panel's own filtered subset.
 *
 * Both take the data already in runtime state rather than re-reading
 * it: the browser holds every item because the read routes handed them
 * over after checking access, so an export is a re-shaping of what the
 * user already has. See ../utils/geoJSONExport.js.
 *
 * `presence` is the one engine whose data never leaves: buildProjectGeoJSON
 * emits no features for it, because a presence item is a person's GPS
 * position. The schema still exports, so the project's shape is
 * describable without exposing where anyone was.
 */
export function exportProject({ schema, data, system }) {
  if (!schema?._id) return false;

  const geojson = buildProjectGeoJSON(schema, Array.isArray(data) ? data : []);

  downloadGeoJSON(geojson, `${schema.projectName || "project"}-${schema._id}`);

  system?.notify?.("Project exported.");
  return true;
}

/*
 * The filter panel's export. `filteredData` is whatever the live filters
 * currently match, so this is the same file as above with a narrower
 * feature list - and refusing an empty one matches what the old route
 * did rather than handing back a file with no features in it.
 */
export function exportFilteredProject({ schema, filteredData, system }) {
  if (!schema?._id) return false;

  const docs = Array.isArray(filteredData) ? filteredData : [];

  if (docs.length === 0) {
    system?.notify?.("No filtered data to export.");
    return false;
  }

  const geojson = buildProjectGeoJSON(schema, docs);

  downloadGeoJSON(geojson, `${schema.projectName || "project"}-${schema._id}-filtered`);

  system?.notify?.("Filtered data exported.");
  return true;
}
