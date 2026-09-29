// shared/validation/aggregateValidation.js

import { exceedsMaxLength } from "./formValueHelpers.js";
import {
  isValidLngLatPair,
  pairsMatch,
  sanitizeBBox,
  sanitizeCentroid,
  computeBBox,
  computePolygonCentroid,
  sanitizePolygonGeometry,
} from "./polygonValidation.js";
import {
  computeMultiPolygonBBox,
  computeMultiPolygonCentroid,
  sanitizeMultiPolygonGeometry,
} from "./multiPolygonValidation.js";
import {
  GEOMETRY_LIMITS,
  BOUNDARY_TOOL_LIMITS,
  AGGREGATE_TOOL_LIMITS,
  AGGREGATE_FIELD_OPERATIONS_BY_TYPE,
} from "./validationConstants.js";

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  if (!isPlainObject(value)) return false;

  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isValidObjectIdString(value) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  return /^[a-f\d]{24}$/i.test(trimmed);
}

function isValidName(value, maxLength) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  return !exceedsMaxLength(trimmed, maxLength);
}

function isValidDescription(value) {
  if (value === null || value === "") return true;
  if (typeof value !== "string") return false;

  return !exceedsMaxLength(value, AGGREGATE_TOOL_LIMITS.descriptionMaxLength);
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function isValidColor(value) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value);
}

function isValidOpacity(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1;
}

function isValidFilterState(value) {
  if (!isPlainObject(value)) return false;

  try {
    return JSON.stringify(value).length <= AGGREGATE_TOOL_LIMITS.maxFilterStateBytes;
  } catch {
    return false;
  }
}

/*
 * A boundary is a Polygon/MultiPolygon with no color of its own (see
 * validationConstants.js's own BOUNDARY_TOOL_LIMITS comment) - this
 * deliberately doesn't reuse polygonValidation.js's/
 * multiPolygonValidation.js's own validatePolygonGeometry/
 * validateMultiPolygonGeometry, which both *require* borderColor/
 * fillColor to be present. It does reuse their lower-level, color-free
 * building blocks (the pair/bbox/centroid math) so a boundary's own
 * derived fields are computed identically to a regular data item's.
 */
function isValidBoundaryPolygonGeometry(geometry) {
  if (!hasOnlyKeys(geometry, ["type", "coordinates", "bbox", "centroid"])) return false;
  if (geometry.type !== "Polygon") return false;

  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 1) return false;

  const outerRing = coordinates[0];
  if (!Array.isArray(outerRing) || outerRing.length < 4) return false;

  for (const pair of outerRing) {
    if (!isValidLngLatPair(pair)) return false;
  }

  if (!pairsMatch(outerRing[0], outerRing[outerRing.length - 1])) return false;

  const bbox = sanitizeBBox(geometry.bbox);
  if (!bbox) return false;

  const centroid = sanitizeCentroid(geometry.centroid);
  if (!centroid) return false;

  const computedBBox = computeBBox(geometry);
  if (!computedBBox) return false;
  if (!bbox.every((value, index) => Number(value) === Number(computedBBox[index]))) return false;

  const computedCentroid = computePolygonCentroid(geometry);
  if (!computedCentroid) return false;

  const tolerance = 1e-9;
  if (Math.abs(centroid.lat - computedCentroid.lat) > tolerance) return false;
  if (Math.abs(centroid.lng - computedCentroid.lng) > tolerance) return false;

  return true;
}

function isValidBoundaryMultiPolygonGeometry(geometry) {
  if (!hasOnlyKeys(geometry, ["type", "coordinates", "bbox", "centroid"])) return false;
  if (geometry.type !== "MultiPolygon") return false;

  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false;

  let totalPoints = 0;
  const rings = [];

  for (const polygonEntry of coordinates) {
    if (!Array.isArray(polygonEntry) || polygonEntry.length !== 1) return false;

    const ring = polygonEntry[0];
    if (!Array.isArray(ring) || ring.length < 4) return false;

    for (const pair of ring) {
      if (!isValidLngLatPair(pair)) return false;
    }

    if (!pairsMatch(ring[0], ring[ring.length - 1])) return false;

    totalPoints += ring.length;
    rings.push(ring);
  }

  if (totalPoints > GEOMETRY_LIMITS.maxCoordinatesPerGeometry) return false;

  const bbox = geometry.bbox;
  if (!Array.isArray(bbox) || bbox.length !== 4) return false;

  const computedBBox = computeMultiPolygonBBox(rings);
  if (!computedBBox) return false;
  if (!bbox.every((value, index) => Number(value) === Number(computedBBox[index]))) return false;

  const centroid = geometry.centroid;
  if (!isPlainObject(centroid)) return false;

  const centroidLat = Number(centroid.lat);
  const centroidLng = Number(centroid.lng);
  if (!Number.isFinite(centroidLat) || !Number.isFinite(centroidLng)) return false;

  const computedCentroid = computeMultiPolygonCentroid(rings);
  if (!computedCentroid) return false;

  const tolerance = 1e-9;
  if (Math.abs(centroidLat - computedCentroid.lat) > tolerance) return false;
  if (Math.abs(centroidLng - computedCentroid.lng) > tolerance) return false;

  return true;
}

export function isValidBoundaryGeometry(geometry) {
  if (!isPlainObject(geometry)) return false;

  if (geometry.type === "Polygon") return isValidBoundaryPolygonGeometry(geometry);
  if (geometry.type === "MultiPolygon") return isValidBoundaryMultiPolygonGeometry(geometry);

  return false;
}

export function validateCreateBoundaryPayload(payload) {
  if (!hasOnlyKeys(payload, ["projectId", "name", "geometry", "fillColor", "borderColor"])) return false;

  if (!isValidObjectIdString(payload.projectId)) return false;
  if (!isValidName(payload.name, BOUNDARY_TOOL_LIMITS.nameMaxLength)) return false;
  if (!isValidBoundaryGeometry(payload.geometry)) return false;
  if (!isValidColor(payload.fillColor)) return false;
  if (!isValidColor(payload.borderColor)) return false;

  return true;
}

/*
 * Client-side helper (draw finish + import extraction both use this
 * before submitting) that attaches a freshly computed bbox/centroid to
 * a raw Polygon/MultiPolygon - reuses polygonValidation.js's/
 * multiPolygonValidation.js's own sanitize* functions (real, already-
 * tested ring-cleaning and bbox/centroid math) and just strips the
 * border/fill color they add for the regular data-drawing flow, since
 * a boundary has none of its own.
 */
export function sanitizeBoundaryGeometry(rawGeometry) {
  const sanitized =
    rawGeometry?.type === "MultiPolygon"
      ? sanitizeMultiPolygonGeometry(rawGeometry)
      : sanitizePolygonGeometry(rawGeometry);

  if (!sanitized) return null;

  const { borderColor: _borderColor, fillColor: _fillColor, ...boundaryGeometry } = sanitized;

  return boundaryGeometry;
}

export function validateUpdateBoundaryPayload(payload) {
  if (!hasOnlyKeys(payload, ["projectId", "_id", "name", "fillColor", "borderColor"])) return false;

  if (!isValidObjectIdString(payload.projectId)) return false;
  if (!isValidObjectIdString(payload._id)) return false;
  if (!isValidName(payload.name, BOUNDARY_TOOL_LIMITS.nameMaxLength)) return false;
  if (!isValidColor(payload.fillColor)) return false;
  if (!isValidColor(payload.borderColor)) return false;

  return true;
}

/*
 * A separate route/payload from validateUpdateBoundaryPayload above -
 * the Move Vertex/Move Boundary map tools (src/aggregates/, both map
 * renderers' own BoundaryToolLayer.jsx) only ever touch geometry, never
 * name, so this is checked and stored independently of the rename
 * route. Reuses isValidBoundaryGeometry directly rather than trusting
 * the client's own sanitizeBoundaryGeometry - per this app's own rule
 * that the server always independently validates incoming geometry.
 */
export function validateUpdateBoundaryGeometryPayload(payload) {
  if (!hasOnlyKeys(payload, ["projectId", "_id", "geometry"])) return false;

  if (!isValidObjectIdString(payload.projectId)) return false;
  if (!isValidObjectIdString(payload._id)) return false;
  if (!isValidBoundaryGeometry(payload.geometry)) return false;

  return true;
}

/*
 * Deliberately light - see Brody's own note that full validation here
 * (confirming a field's sectionId/inputId actually exist in the
 * project's current schema, and that its type still matches) is worth
 * doing later, not now. This only checks the payload's own shape: a
 * bounded array of well-formed {sectionId, inputId, type, operation}
 * entries where the operation is one of that type's own allowed set.
 */
function isValidAggregateFields(value) {
  if (!Array.isArray(value)) return false;
  if (value.length > AGGREGATE_TOOL_LIMITS.maxFields) return false;

  return value.every((field) => {
    if (!hasOnlyKeys(field, ["sectionId", "inputId", "type", "operation"])) return false;
    if (typeof field.sectionId !== "string" && typeof field.sectionId !== "number") return false;
    if (typeof field.inputId !== "string" && typeof field.inputId !== "number") return false;

    const allowedOperations = AGGREGATE_FIELD_OPERATIONS_BY_TYPE[field.type];
    if (!allowedOperations) return false;

    return allowedOperations.includes(field.operation);
  });
}


/*
 * An aggregate's boundary used to be mandatory, on the reasoning that
 * it needs a shape to render into. Brody's own call reversed that: an
 * aggregate without one still lists, still selects, and still reports
 * its result in the info and edit panels - it simply isn't drawn on the
 * map. Making it optional also collapses what had become two different
 * rule sets (and two boundary-picker configurations) into the one
 * layerValidation.js already used.
 */

export function validateCreateAggregatePayload(payload) {
  if (
    !hasOnlyKeys(payload, [
      "projectId",
      "name",
      "description",
      "fillColor",
      "borderColor",
      "filterState",
      "fields",
    ])
  ) {
    return false;
  }

  if (!isValidObjectIdString(payload.projectId)) return false;
  if (!isValidName(payload.name, AGGREGATE_TOOL_LIMITS.nameMaxLength)) return false;
  if (!isValidDescription(payload.description)) return false;
  if (!isValidColor(payload.fillColor)) return false;
  if (!isValidColor(payload.borderColor)) return false;
  if (!isValidFilterState(payload.filterState)) return false;
  if (!isValidAggregateFields(payload.fields)) return false;

  return true;
}

/*
 * Takes the whole aggregate document, not just its display metadata -
 * the Edit panel's own "Edit Filters" and "Edit Boundary" branches
 * reopen the matching step of the Add workflow against a saved
 * aggregate and commit through this same save, exactly as the Layers
 * page's own edit branches do (see validateUpdateLayerPayload).
 *
 * `fields` stays excluded: which fields an aggregate reports on is
 * still a create-time choice made in the Add workflow's own field
 * picker, with no edit-panel branch offering to change it.
 */
export function validateUpdateAggregatePayload(payload) {
  if (
    !hasOnlyKeys(payload, [
      "projectId",
      "_id",
      "name",
      "description",
      "fillColor",
      "borderColor",
      "filterState",
      "fields",
      "opacity",
      "visible",
      "order",
    ])
  ) {
    return false;
  }

  if (!isValidObjectIdString(payload.projectId)) return false;
  if (!isValidObjectIdString(payload._id)) return false;
  if (!isValidName(payload.name, AGGREGATE_TOOL_LIMITS.nameMaxLength)) return false;
  if (!isValidDescription(payload.description)) return false;
  if (!isValidColor(payload.fillColor)) return false;
  if (!isValidColor(payload.borderColor)) return false;
  if (!isValidFilterState(payload.filterState)) return false;
  if (!isValidAggregateFields(payload.fields)) return false;
  if (!isValidOpacity(payload.opacity)) return false;
  if (typeof payload.visible !== "boolean") return false;
  if (!Number.isFinite(Number(payload.order))) return false;

  return true;
}

/*
 * Whether a schema input can have an aggregate operation run over it.
 *
 * Type is the first gate, but not the only one. A checkboxGate section
 * (Time Access, Parking - see each engine's own schema.js) has PRIMARY
 * checkboxes that exist to switch the rest of the section on, and
 * SECONDARY inputs that carry the actual answers. Counting a primary
 * counts "how many places answered this question at all", which is
 * never what anyone means - and because offering it made the section
 * appear in the picker, it dragged its whole set of aggregatable
 * sub-inputs on screen with it.
 *
 * So primaries are excluded and secondaries are kept: a plain checkbox
 * in an ordinary section, and a secondary checkbox inside a gated one,
 * are both countable. Brody's own call.
 *
 * A primary is identified by its own inputKey appearing in the
 * section's checkboxGateConfig.primaryInputKeys - the same list
 * projectValidation.js validates and CheckboxGate.jsx renders from, so
 * there is no second definition of "primary" to drift.
 */
export function isAggregatableInput(section, input) {
  if (!AGGREGATE_TOOL_LIMITS.allowedFieldTypes.includes(input?.type)) return false;

  if (section?.conditionalSection !== "checkboxGate") return true;

  const primaryInputKeys = section?.checkboxGateConfig?.primaryInputKeys;
  if (!Array.isArray(primaryInputKeys)) return true;

  return !(input?.inputKey && primaryInputKeys.includes(input.inputKey));
}

/*
 * The schema-aware half of aggregate field validation.
 *
 * isValidAggregateFields above only checks the SHAPE of each entry -
 * it has no schema to consult, so it cannot tell a real input from a
 * fabricated one, nor a countable checkbox from a gate. This runs on
 * the server where the project is already loaded, and confirms every
 * field points at an input that exists, is the type it claims to be,
 * and is actually aggregatable.
 *
 * The type cross-check matters on its own: without it a client could
 * declare a checkbox to be a "number" and get Sum/Average operations
 * accepted for it.
 */
export function areAggregateFieldsAllowedBySchema(project, fields) {
  if (!Array.isArray(fields)) return false;

  const sections = Array.isArray(project?.sections) ? project.sections : [];

  return fields.every((field) => {
    const section = sections.find(
      (candidate) => String(candidate.id) === String(field.sectionId),
    );
    if (!section) return false;

    const input = (section.inputs || []).find(
      (candidate) => String(candidate.id) === String(field.inputId),
    );
    if (!input) return false;

    if (String(input.type) !== String(field.type)) return false;

    return isAggregatableInput(section, input);
  });
}
