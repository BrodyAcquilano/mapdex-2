// shared/validation/multiLineStringValidation.js

import { GEOMETRY_LIMITS } from "./validationConstants.js";
import {
  isValidLngLatPair,
  isValidHexColor,
  computeLineCentroid,
} from "./lineStringValidation.js";

const DEFAULT_LINE_COLOR = "#3388ff";

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

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();

  return fallback;
}

function cleanLine(line) {
  if (!Array.isArray(line) || line.length < 2) return null;

  const cleaned = line.map((pair) => {
    if (!isValidLngLatPair(pair)) return null;
    return [Number(pair[0]), Number(pair[1])];
  });

  if (cleaned.some((pair) => pair === null)) return null;

  return cleaned;
}

/*
 * Bounding box across every point in every line in the group - one
 * combined box, not one per line (see this file's own header comment
 * on why per-line fields were dropped for the multi- versions).
 */
export function computeMultiLineBBox(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const line of lines) {
    if (!Array.isArray(line)) return null;

    for (const pair of line) {
      if (!isValidLngLatPair(pair)) return null;

      const lng = Number(pair[0]);
      const lat = Number(pair[1]);

      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
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

/*
 * "Centroid of centroids" - each line's own centroid (the same
 * closed-ring-area formula lineStringValidation.js's own
 * computeLineCentroid uses for a single LineString), averaged
 * together into one group value, rather than storing every line's own
 * value. Per-line midpoint/distance/centroid stop being
 * useful once several lines are grouped into one data item - there's
 * no single "the line" left to walk a travel distance along or insert
 * a midpoint into, per Brody's own call - so this one group-level
 * value (just enough to anchor a popup) is all that's kept. The split
 * tool, later, is what breaks a MultiLineString back into individual
 * LineStrings if those per-line fields are ever needed again.
 *
 * Each individual line's own centroid is already antimeridian-aware
 * (computeLineCentroid, above, unwraps that one line's own vertices),
 * but averaging several lines' centroids together here is not - if the
 * lines themselves are scattered on opposite sides of the dateline (as
 * opposed to one line crossing it, which is already handled), a plain
 * arithmetic mean of their centroids has the same "independent points,
 * no sequential path to unwrap along" issue multiPointValidation.js's
 * own computeMultiPointBBox/Centroid do - deferred alongside those for
 * the same reason.
 */
export function computeMultiLineCentroid(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return null;

  let latSum = 0;
  let lngSum = 0;

  for (const line of lines) {
    const centroid = computeLineCentroid(line);
    if (!centroid) return null;

    latSum += centroid.lat;
    lngSum += centroid.lng;
  }

  return {
    lat: latSum / lines.length,
    lng: lngSum / lines.length,
  };
}

/*
 * Client-side helper analogous to sanitizeLineStringGeometry/
 * sanitizePolygonGeometry: attaches a freshly computed bbox/centroid
 * to a raw MultiLineString geometry.
 *
 * Always recomputed from the cleaned lines, never trusting an
 * already-present bbox/centroid (an import source's own, or anything
 * else on the raw payload) - per Brody's own call, after a real-world
 * import turned up a LineString whose own numerically unstable
 * centroid (see lineStringValidation.js's own computeLineCentroid
 * comment - the same area-of-artificially-closed-ring math this
 * file's own computeMultiLineCentroid builds on, per line) could have
 * silently slipped through if this had preferred that already-present
 * value instead. Recomputing here means the derived fields always
 * match the coordinates they came from.
 */
export function sanitizeMultiLineStringGeometry(rawGeometry) {
  if (!rawGeometry || typeof rawGeometry !== "object") return null;
  if (rawGeometry.type !== "MultiLineString") return null;

  const coordinates = rawGeometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const cleanedLines = coordinates.map((line) => cleanLine(line));
  if (cleanedLines.some((line) => line === null)) return null;

  const bbox = computeMultiLineBBox(cleanedLines);
  const centroid = computeMultiLineCentroid(cleanedLines);

  if (!bbox || !centroid) return null;

  return {
    type: "MultiLineString",
    coordinates: cleanedLines,
    lineColor: normalizeHexColor(rawGeometry.lineColor, DEFAULT_LINE_COLOR),
    bbox,
    centroid,
  };
}

/*
 * Strict validator for a MultiLineString geometry that includes real
 * coordinates (add, and any future move/drag route): requires bbox
 * and centroid to be present and match what's recomputed.
 * Every line independently needs at least 2 points (LineString's own
 * rule, applied per line) - no restriction on whether they intersect
 * each other (lines were already allowed to self-intersect before
 * this). Requires at least 2 lines - a multi-type is only ever allowed
 * to exist with 2+ items, matching MultiPoint's own minimum: the draw
 * tools require 2+ to finish, and the "remove sub-geometry" edit tool
 * converts down to a plain LineString rather than ever leaving a
 * 1-item MultiLineString, so a payload can't legitimately reach here
 * with just 1 (import-time reconciliation for already-malformed
 * externally-sourced data is a separate, later concern).
 */
export function validateMultiLineStringGeometry(geometry) {
  if (
    !hasExactKeys(geometry, [
      "type",
      "coordinates",
      "lineColor",
      "bbox",
      "centroid",
    ])
  ) {
    return false;
  }

  if (geometry.type !== "MultiLineString") return false;

  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false;

  let totalPoints = 0;

  for (const line of coordinates) {
    if (!Array.isArray(line) || line.length < 2) return false;

    for (const pair of line) {
      if (!isValidLngLatPair(pair)) return false;
    }

    totalPoints += line.length;
  }

  if (totalPoints > GEOMETRY_LIMITS.maxCoordinatesPerGeometry) return false;

  if (!isValidHexColor(geometry.lineColor)) return false;

  const bbox = geometry.bbox;
  if (!Array.isArray(bbox) || bbox.length !== 4) return false;
  if (!bbox.every((value) => Number.isFinite(Number(value)))) return false;

  const computedBBox = computeMultiLineBBox(coordinates);
  if (!computedBBox) return false;

  if (!bbox.every((value, index) => Number(value) === Number(computedBBox[index]))) {
    return false;
  }

  const centroid = geometry.centroid;
  if (!isPlainObject(centroid)) return false;

  const lat = Number(centroid.lat);
  const lng = Number(centroid.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  const computed = computeMultiLineCentroid(coordinates);
  if (!computed) return false;

  if (Math.abs(lat - computed.lat) > CENTROID_TOLERANCE_DEGREES) return false;
  if (Math.abs(lng - computed.lng) > CENTROID_TOLERANCE_DEGREES) return false;

  return true;
}

/*
 * Update-mode validator: the regular update route only ever changes
 * color for an existing MultiLineString (never coordinates - that's
 * only ever done through add), matching LineString's own ForUpdate
 * pattern.
 */
export function validateMultiLineStringGeometryForUpdate(geometry) {
  if (!hasExactKeys(geometry, ["type", "lineColor"])) return false;
  if (geometry.type !== "MultiLineString") return false;

  return isValidHexColor(geometry.lineColor);
}
