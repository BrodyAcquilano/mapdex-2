// src/boundaries/utils/parseBoundaryImportFile.js

import { sanitizeBoundaryGeometry } from "../../../shared/validation/aggregateValidation.js";

/*
 * Recursively collects every Polygon/MultiPolygon geometry anywhere in
 * a parsed GeoJSON structure - a bare geometry, a Feature, a
 * FeatureCollection, or a GeometryCollection (including one nested
 * inside a Feature/FeatureCollection). Import only ever succeeds when
 * exactly one turns up across the *whole* file, per Brody's own rule -
 * this is deliberately strict rather than "use the first one found",
 * since a file with more than one boundary-shaped geometry has no
 * unambiguous single answer for which one the user actually meant.
 */
function collectPolygonGeometries(node, found) {
  if (!node || typeof node !== "object") return;

  if (node.type === "Polygon" || node.type === "MultiPolygon") {
    found.push(node);
    return;
  }

  if (node.type === "GeometryCollection" && Array.isArray(node.geometries)) {
    for (const geometry of node.geometries) {
      collectPolygonGeometries(geometry, found);
    }
    return;
  }

  if (node.type === "Feature") {
    collectPolygonGeometries(node.geometry, found);
    return;
  }

  if (node.type === "FeatureCollection" && Array.isArray(node.features)) {
    for (const feature of node.features) {
      collectPolygonGeometries(feature, found);
    }
  }
}

/*
 * Reads and strictly parses one uploaded file as a boundary import -
 * returns { geometry } (already sanitized: bbox/centroid attached, no
 * color) on success, or { error } naming why it was rejected. Never
 * throws - every failure path (bad JSON, wrong shape, more than one
 * candidate, an invalid polygon) returns an `error` string instead.
 */
export async function parseBoundaryImportFile(file) {
  if (!file) return { error: "No file selected." };

  let parsed;

  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    return { error: "That file isn't valid JSON." };
  }

  const found = [];
  collectPolygonGeometries(parsed, found);

  if (found.length === 0) {
    return { error: "No Polygon or MultiPolygon geometry found in that file." };
  }

  if (found.length > 1) {
    return {
      error: `Found ${found.length} Polygon/MultiPolygon geometries - import only accepts a file with exactly one.`,
    };
  }

  const geometry = sanitizeBoundaryGeometry(found[0]);

  if (!geometry) {
    return { error: "That geometry isn't a valid Polygon or MultiPolygon." };
  }

  return { geometry };
}
