// src/forms/importGeometryHelpers.js

import { isValidLngLatPair } from "../../shared/validation/polygonValidation.js";
import { sanitizePolygonGeometry } from "../../shared/validation/polygonValidation.js";
import { sanitizeLineStringGeometry } from "../../shared/validation/lineStringValidation.js";
import { sanitizeMultiPointGeometry } from "../../shared/validation/multiPointValidation.js";
import { sanitizeMultiLineStringGeometry } from "../../shared/validation/multiLineStringValidation.js";
import { sanitizeMultiPolygonGeometry } from "../../shared/validation/multiPolygonValidation.js";
import { pathCrossesAntimeridian } from "../../shared/validation/geometryBoundaryValidation.js";
import { validateDataItemPayload } from "../../shared/validation/dataValidation.js";
import { polygonRingSelfIntersects } from "../map/utils/draftGeometry.js";

const DEFAULT_BORDER_COLOR = "#2563eb";
const DEFAULT_FILL_COLOR = "#3b82f6";

const WARNING_BORDER_COLOR = "#eab308";
const WARNING_FILL_COLOR = "#eab308";

/*
 * "Import Geometry" - the tool wheel's own IMPORT_TOOLS entry
 * (src/map/tools/GeometryToolWheel.jsx) - reads a GeoJSON file, keeps
 * only its geometry, and quick-adds each feature the same way
 * manually drawing one does, discarding every one of the file's own
 * properties. Unlike the neighbourhood-specific import
 * (NeighbourhoodAddModal.jsx, Polygon-only, and the only place these
 * next few rules were ever needed before now), this accepts and
 * splits out all 6 GeoJSON geometry types, so the splitting/filtering
 * logic here is meaningfully more involved - kept in its own file,
 * separate from ImportGeometryModal.jsx's own UI/state and from the
 * shared antimeridian validator (shared/validation/
 * geometryBoundaryValidation.js) it calls into, per Brody's own call
 * to keep each concern compartmentalized.
 *
 * The rules this file enforces, in one place:
 * - FeatureCollection/Feature/GeometryCollection are never imported
 *   as-is - they're always broken down into their own individual
 *   Point/LineString/Polygon/MultiPoint/MultiLineString/MultiPolygon
 *   geometries first. A standalone geometry of one of those 6 types
 *   (no Feature/FeatureCollection wrapper at all) is accepted as-is,
 *   unsplit - MultiPolygon/MultiLineString/MultiPoint are never broken
 *   down into their own individual parts, only Feature-ish wrappers
 *   are unwrapped.
 * - Self-intersection (or one part intersecting another) is never
 *   checked or rejected - the app already lets a saved line/polygon
 *   have this today, and the goal here is "import first, clean up
 *   later," giving the source data the benefit of the doubt. The one
 *   exception is purely cosmetic: a self-intersecting Polygon (whole
 *   or one ring within a MultiPolygon) still imports, just with its
 *   border/fill recolored to a warning yellow so it's easy to spot on
 *   the map afterward - see markSelfIntersectingPolygonWithWarning
 *   below.
 * - Two things ARE rejected outright: a coordinate pair outside the
 *   normal lat/lng bounds (every sanitizeXGeometry below already
 *   enforces this on its own), and any edge that crosses the
 *   antimeridian (pathCrossesAntimeridian - neither map engine can
 *   draw or fix a geometry like that once imported, unlike every
 *   other kind of messy source data).
 * - A single Point/LineString/Polygon is all-or-nothing: any rejection
 *   throws away the whole item, never just the offending vertex - the
 *   same as manually drawing one would never let you save a partial
 *   shape.
 * - A MultiPoint/MultiLineString/MultiPolygon's own individual parts
 *   (independent points, lines, or polygons within the group) are
 *   each checked on their own - a bad part is thrown away and the rest
 *   of the group is kept, down to a minimum of one survivor. A group
 *   reduced to exactly one surviving part converts down to that part's
 *   own singular type (Point/LineString/Polygon), matching how the
 *   draw tools and the "remove sub-geometry" edit tool already treat
 *   a 1-item multi- draft as indistinguishable from its singular
 *   equivalent. A group with zero survivors is discarded entirely.
 * - Any property besides type/coordinates/bbox/centroid (and
 *   LineString's own midpoint/distance) is ignored - colors are always
 *   assigned fresh defaults per type here, never read from the
 *   source file.
 */

function cleanCoordinatePair(pair) {
  if (!isValidLngLatPair(pair)) return null;
  return [Number(pair[0]), Number(pair[1])];
}

/*
 * Point has no sanitizeXGeometry of its own (nothing to compute - no
 * bbox/centroid/ring-closing) - this is the same shape every other
 * sanitize function below produces for its own type, just built
 * inline.
 */
function buildImportablePoint(coordinates) {
  const cleaned = cleanCoordinatePair(coordinates);
  if (!cleaned) return null;

  return {
    type: "Point",
    coordinates: cleaned,
    borderColor: DEFAULT_BORDER_COLOR,
    fillColor: DEFAULT_FILL_COLOR,
  };
}

function buildImportableLineString(coordinates) {
  if (!Array.isArray(coordinates)) return null;
  if (pathCrossesAntimeridian(coordinates)) return null;

  return sanitizeLineStringGeometry({
    type: "LineString",
    coordinates,
  });
}

function buildImportablePolygon(ring) {
  if (!Array.isArray(ring)) return null;
  if (pathCrossesAntimeridian(ring)) return null;

  return sanitizePolygonGeometry({
    type: "Polygon",
    coordinates: [ring],
  });
}

/*
 * Recolors a Polygon (or a MultiPolygon, whose own border/fill apply
 * to the whole group, not per ring) with a warning yellow if any one
 * of its rings is self-intersecting - purely cosmetic, never a
 * rejection (see this file's own header comment). Reuses
 * draftGeometry.js's own polygonRingSelfIntersects rather than a third
 * copy of the same algorithm, since both files are already client-
 * side only.
 */
function markSelfIntersectingPolygonWithWarning(geometry, rings) {
  const isSelfIntersecting = rings.some((ring) => polygonRingSelfIntersects(ring));

  if (!isSelfIntersecting) return geometry;

  return {
    ...geometry,
    borderColor: WARNING_BORDER_COLOR,
    fillColor: WARNING_FILL_COLOR,
  };
}

/*
 * Filters a MultiPoint/MultiLineString/MultiPolygon's own raw parts
 * down to the ones that individually pass the same rules a standalone
 * geometry of that part's own type would, converts to the singular
 * type if exactly one part survives, and runs the final sanitize pass
 * (recomputing the group's own combined bbox/centroid) once the
 * surviving set is settled. `buildPart` validates/cleans ONE candidate
 * part on its own (reusing that type's own sanitizeXGeometry, so
 * whatever survives here is guaranteed to also pass as part of the
 * group - no risk of the whole group failing sanitizeMultiXGeometry
 * over a part this filter already accepted).
 */
function buildImportableMultiGeometry({
  parts,
  buildPart,
  getPartCoordinates,
  buildSingular,
  multiType,
  sanitizeMulti,
}) {
  if (!Array.isArray(parts)) return null;

  const survivingCoordinates = [];

  for (const part of parts) {
    const cleanedPart = buildPart(part);
    if (!cleanedPart) continue;

    survivingCoordinates.push(getPartCoordinates(cleanedPart));
  }

  if (survivingCoordinates.length === 0) return null;

  if (survivingCoordinates.length === 1) {
    return buildSingular(survivingCoordinates[0]);
  }

  return sanitizeMulti({
    type: multiType,
    coordinates: survivingCoordinates,
  });
}

function buildImportableMultiPoint(coordinates) {
  return buildImportableMultiGeometry({
    parts: coordinates,
    buildPart: (pair) => buildImportablePoint(pair),
    getPartCoordinates: (point) => point.coordinates,
    buildSingular: (pair) => buildImportablePoint(pair),
    multiType: "MultiPoint",
    sanitizeMulti: sanitizeMultiPointGeometry,
  });
}

function buildImportableMultiLineString(parts) {
  return buildImportableMultiGeometry({
    parts,
    buildPart: (line) => buildImportableLineString(line),
    getPartCoordinates: (line) => line.coordinates,
    buildSingular: (line) => buildImportableLineString(line),
    multiType: "MultiLineString",
    sanitizeMulti: sanitizeMultiLineStringGeometry,
  });
}

function buildImportableMultiPolygon(parts) {
  const geometry = buildImportableMultiGeometry({
    parts,
    buildPart: (polygonEntry) => {
      const ring = Array.isArray(polygonEntry?.[0]) ? polygonEntry[0] : null;
      return buildImportablePolygon(ring);
    },
    getPartCoordinates: (polygon) => polygon.coordinates[0],
    buildSingular: (ring) => buildImportablePolygon(ring),
    multiType: "MultiPolygon",
    sanitizeMulti: sanitizeMultiPolygonGeometry,
  });

  if (!geometry) return null;

  const survivingRings =
    geometry.type === "MultiPolygon"
      ? geometry.coordinates.map((part) => part[0])
      : [geometry.coordinates[0]];

  return markSelfIntersectingPolygonWithWarning(geometry, survivingRings);
}

function buildImportableGeometry(rawGeometry) {
  if (!rawGeometry || typeof rawGeometry !== "object") return null;

  if (rawGeometry.type === "Point") {
    return buildImportablePoint(rawGeometry.coordinates);
  }

  if (rawGeometry.type === "LineString") {
    return buildImportableLineString(rawGeometry.coordinates);
  }

  if (rawGeometry.type === "Polygon") {
    return buildImportablePolygon(rawGeometry.coordinates?.[0]);
  }

  if (rawGeometry.type === "MultiPoint") {
    return buildImportableMultiPoint(rawGeometry.coordinates);
  }

  if (rawGeometry.type === "MultiLineString") {
    return buildImportableMultiLineString(rawGeometry.coordinates);
  }

  if (rawGeometry.type === "MultiPolygon") {
    return buildImportableMultiPolygon(rawGeometry.coordinates);
  }

  return null;
}

/*
 * Top-level entry point: walks a parsed GeoJSON document down to its
 * own individual geometries, unwrapping FeatureCollection/Feature/
 * GeometryCollection along the way (but never splitting a Multi- type
 * into its own separate parts - see this file's own header comment).
 * Returns { valid, message, geometries } - geometries is always a
 * flat array of already-cleaned Point/LineString/Polygon/MultiPoint/
 * MultiLineString/MultiPolygon geometry objects, ready to hand to
 * buildImportGeometryPayload one at a time.
 */
export function splitGeoJsonIntoGeometries(geojson) {
  const geometries = [];

  function pushGeometryOrCollection(rawGeometry) {
    if (!rawGeometry || typeof rawGeometry !== "object") return;

    if (rawGeometry.type === "GeometryCollection") {
      (rawGeometry.geometries || []).forEach(pushGeometryOrCollection);
      return;
    }

    const cleaned = buildImportableGeometry(rawGeometry);
    if (cleaned) geometries.push(cleaned);
  }

  function pushFeature(feature) {
    if (feature?.type !== "Feature") return;
    pushGeometryOrCollection(feature.geometry);
  }

  if (!geojson || typeof geojson !== "object") {
    return {
      valid: false,
      message: "File is empty or invalid JSON.",
      geometries: [],
    };
  }

  const SINGULAR_GEOMETRY_TYPES = [
    "Point",
    "LineString",
    "Polygon",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
  ];

  if (geojson.type === "FeatureCollection") {
    (geojson.features || []).forEach(pushFeature);
  } else if (geojson.type === "Feature") {
    pushFeature(geojson);
  } else if (geojson.type === "GeometryCollection") {
    (geojson.geometries || []).forEach(pushGeometryOrCollection);
  } else if (SINGULAR_GEOMETRY_TYPES.includes(geojson.type)) {
    pushGeometryOrCollection(geojson);
  } else {
    return {
      valid: false,
      message:
        "Unsupported GeoJSON format. Upload a Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection, Feature, or FeatureCollection.",
      geometries: [],
    };
  }

  if (geometries.length === 0) {
    return {
      valid: false,
      message: "No valid geometry found.",
      geometries: [],
    };
  }

  return {
    valid: true,
    message: "",
    geometries,
  };
}

/*
 * Builds one full add payload from an already-cleaned geometry
 * (splitGeoJsonIntoGeometries's own output) - the same "blank form,
 * inject the required pieces, build the payload, validate" pipeline
 * every other add workflow uses (NeighbourhoodAddModal.jsx's own
 * buildNeighbourhoodPayload; the manual add-panel flow, via
 * AddPanel.jsx). injectCurrentDateTime is called unconditionally
 * (harmless for a "None" time schema - Places' usual case - and what
 * gives an imported Event a valid synthetic "now" date, since a
 * geometry-only import obviously carries none of its own) - this is
 * the one place Places and Events genuinely differ, per Brody's own
 * call, and it's absorbed here so the rest of this pipeline stays
 * identical for both engines.
 */
export function buildImportGeometryPayload({
  blankFormTemplate,
  forms,
  schema,
  geometry,
  dataUtils,
  activeLayer,
  activeParentDataItemId,
}) {
  if (!geometry) return null;

  const form = structuredClone(blankFormTemplate);

  forms.injectLayer?.(form, activeLayer || 1, activeParentDataItemId || null);

  form.geometry = structuredClone(geometry);

  forms.injectRequiredDefaults?.(form, schema);
  forms.injectCurrentDateTime?.(form, schema);
  forms.reapplyTimezoneFromLatLng?.(form);

  const payload = dataUtils.buildAddPayloadFromForm(form);
  if (!payload) return null;

  const validation = validateDataItemPayload({
    schema,
    dataItem: payload,
    mode: "add",
  });

  if (!validation.isValid) return null;

  return payload;
}
