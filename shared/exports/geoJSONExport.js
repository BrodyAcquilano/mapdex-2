// shared/exports/geoJSONExport.js

/*
 * The GeoJSON builders. Isomorphic: the front end assembles nearly
 * every export from data it already holds, and the one surviving
 * server route (exporting a project the user has NOT opened, from the
 * projects list) builds the same shape from documents it reads itself.
 *
 * Nothing was gained by assembling these on the server. The browser
 * already holds every byte an export contains - the full project
 * document, every data item (the read routes paginate nothing) and the
 * boundaries - and it only holds them because those read routes
 * already checked permission to hand them over. The export routes were
 * therefore re-deriving, from the database, a file the client could
 * build from state it legitimately had. Brody's own call to drop them.
 *
 * These functions are pure: data in, GeoJSON out. The server version
 * additionally queried MongoDB for the documents to export
 * (getExportableProjectDocs, gone with the routes); callers now pass
 * whatever is already in runtime state, which is also why an export
 * reflects exactly what the user is looking at rather than a fresh
 * read.
 */
import {
  resolveFilterBoundaryShape,
} from "../boundaries/filterBoundaryGeometry.js";
import { sanitizeBoundaryGeometry } from "../validation/aggregateValidation.js";
import {
  BOUNDARY_MODE_BBOX,
  BOUNDARY_MODE_BOUNDARY,
} from "../validation/validationConstants.js";

function toIdString(value) {
  if (!value) return "";
  return String(value);
}

function toIsoOrNull(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isValidPointCoordinates(coords) {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    Number.isFinite(Number(coords[0])) &&
    Number.isFinite(Number(coords[1]))
  );
}

function isValidGeometry(geometry) {
  if (!geometry || typeof geometry !== "object") return false;

  const { type, coordinates } = geometry;

  if (type === "Point") {
    return isValidPointCoordinates(coordinates);
  }

  if (type === "LineString") {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return false;
    }

    return coordinates.every(isValidPointCoordinates);
  }

  if (type === "Polygon") {
    return Array.isArray(coordinates) && coordinates.length > 0;
  }

  if (type === "MultiPoint") {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return false;
    }

    return coordinates.every(isValidPointCoordinates);
  }

  if (type === "MultiLineString") {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return false;
    }

    return coordinates.every(
      (line) => Array.isArray(line) && line.length > 0 && line.every(isValidPointCoordinates),
    );
  }

  if (type === "MultiPolygon") {
    return (
      Array.isArray(coordinates) &&
      coordinates.length > 0 &&
      coordinates.every((polygon) => Array.isArray(polygon) && polygon.length > 0)
    );
  }

  return false;
}

function sanitizeGeometry(geometry) {
  if (!isValidGeometry(geometry)) return null;

  return {
    type: geometry.type,
    coordinates: geometry.coordinates,
  };
}

function buildSchemaLookup(project) {
  const sectionMap = new Map();
  const inputMap = new Map();

  for (const section of project.sections || []) {
    sectionMap.set(String(section.id), section);

    for (const input of section.inputs || []) {
      inputMap.set(String(input.id), {
        ...input,
        sectionId: section.id,
        sectionName: section.name,
      });
    }
  }

  return { sectionMap, inputMap };
}

function extractSimpleInputValue(storedInput) {
  if (!storedInput || typeof storedInput !== "object") return null;
  return storedInput.value;
}

function extractCheckboxExportValue(schemaInput, storedInput) {
  if (!schemaInput || !storedInput || typeof storedInput !== "object") {
    return null;
  }

  if (schemaInput.isApplicableOption === true) {
    return {
      isApplicable: storedInput.isApplicable ?? true,
      value: storedInput.value ?? false,
    };
  }

  return storedInput.value ?? false;
}

function extractInputExportValue(schemaInput, storedInput) {
  if (!schemaInput || !storedInput) return null;

  switch (schemaInput.type) {
    case "text":
    case "notes":
    case "website":
    case "phoneNumber":
    case "email":
    case "dropdown":
      return extractSimpleInputValue(storedInput);

    case "checkbox":
      return extractCheckboxExportValue(schemaInput, storedInput);

    case "number":
    case "percentage":
    case "capacity":
      return {
        mode: storedInput.mode ?? null,
        singleValue: storedInput.singleValue ?? null,
        min: storedInput.min ?? null,
        max: storedInput.max ?? null,
      };

    case "hours":
      return {
        openHours: storedInput.openHours || {},
      };

    case "ageRange":
      return {
        mode: storedInput.mode ?? null,
        min: storedInput.min ?? null,
        max: storedInput.max ?? null,
      };

    case "priceRangeArray":
      return {
        categories: storedInput.categories || {},
      };

    case "tagList":
      return {
        tags: Array.isArray(storedInput.tags) ? storedInput.tags : [],
      };

    default:
      if ("value" in storedInput) return storedInput.value;
      return null;
  }
}

function buildSectionProperties(project, doc) {
  const { sectionMap, inputMap } = buildSchemaLookup(project);
  const sectionProperties = {};

  for (const docSection of doc.sections || []) {
    const schemaSection = sectionMap.get(String(docSection.id));
    if (!schemaSection) continue;

    const sectionName = schemaSection.name || `Section ${docSection.id}`;
    const sectionObject = {};

    for (const storedInput of docSection.inputs || []) {
      const schemaInput = inputMap.get(String(storedInput.id));
      if (!schemaInput) continue;

      const inputLabel = schemaInput.label || `Input ${storedInput.id}`;
      const exportValue = extractInputExportValue(schemaInput, storedInput);

      if (exportValue === null || exportValue === undefined) continue;
      sectionObject[inputLabel] = exportValue;
    }

    if (Object.keys(sectionObject).length > 0) {
      sectionProperties[sectionName] = sectionObject;
    }
  }

  return sectionProperties;
}

function buildTimeProperties(doc) {
  if (!doc?.time) {
    return {
      type: "None",
      mode: null,
      timezone: null,
      dates: [],
      samples: [],
    };
  }

  if (doc.time.type === "Motion") {
    return {
      type: "Motion",
      mode: doc.time.mode || "Sampled",
      timezone: doc.time.timezone || null,
      dates: [],
      samples: Array.isArray(doc.time.samples) ? doc.time.samples : [],
    };
  }

  if (doc.time.type === "Event") {
    return {
      type: "Event",
      mode: doc.time.mode || null,
      timezone: doc.time.timezone || null,
      dates: Array.isArray(doc.time.dates) ? doc.time.dates : [],
      samples: [],
    };
  }

  return {
    type: doc.time.type || "None",
    mode: null,
    timezone: doc.time.timezone || null,
    dates: [],
    samples: [],
  };
}

function buildFeatureProperties(project, doc) {
  const sectionProperties = buildSectionProperties(project, doc);
  const timeProperties = buildTimeProperties(doc);

  const properties = {
    type: doc.type || null,
    layer: doc.layer ?? null,
  };

  if (Number(doc.layer) === 2 && doc.parentDataItemId != null) {
    properties.parentDataItemId = toIdString(doc.parentDataItemId);
  }

 if (doc.geometry?.type === "Point") {
  if (doc.geometry.borderColor) {
    properties.borderColor =
      doc.geometry.borderColor;
  }

  if (doc.geometry.fillColor) {
    properties.fillColor =
      doc.geometry.fillColor;
  }
}

if (doc.geometry?.type === "LineString") {
  if (doc.geometry.lineColor) {
    properties.lineColor =
      doc.geometry.lineColor;
  }

  if (doc.geometry.distance != null) {
    properties.distance =
      doc.geometry.distance;
  }

  if (doc.geometry.midpoint != null) {
    properties.midpoint =
      doc.geometry.midpoint;
  }

  if (doc.geometry.centroid != null) {
    properties.centroid =
      doc.geometry.centroid;
  }
}

if (doc.geometry?.type === "Polygon") {
  if (doc.geometry.centroid != null) {
    properties.centroid =
      doc.geometry.centroid;
  }

  if (doc.geometry.borderColor) {
    properties.borderColor =
      doc.geometry.borderColor;
  }

  if (doc.geometry.fillColor) {
    properties.fillColor =
      doc.geometry.fillColor;
  }
}

if (doc.geometry?.type === "MultiPoint") {
  if (doc.geometry.centroid != null) {
    properties.centroid = doc.geometry.centroid;
  }

  if (doc.geometry.borderColor) {
    properties.borderColor = doc.geometry.borderColor;
  }

  if (doc.geometry.fillColor) {
    properties.fillColor = doc.geometry.fillColor;
  }
}

if (doc.geometry?.type === "MultiLineString") {
  if (doc.geometry.lineColor) {
    properties.lineColor = doc.geometry.lineColor;
  }

  if (doc.geometry.centroid != null) {
    properties.centroid = doc.geometry.centroid;
  }
}

if (doc.geometry?.type === "MultiPolygon") {
  if (doc.geometry.centroid != null) {
    properties.centroid = doc.geometry.centroid;
  }

  if (doc.geometry.borderColor) {
    properties.borderColor = doc.geometry.borderColor;
  }

  if (doc.geometry.fillColor) {
    properties.fillColor = doc.geometry.fillColor;
  }
}

  properties.Time = timeProperties;

  Object.assign(properties, sectionProperties);

  properties.extensions = isPlainObject(doc.extensions) ? doc.extensions : {};
  properties.createdAt = toIsoOrNull(doc.createdAt);
  properties.updatedAt = toIsoOrNull(doc.updatedAt);

  return properties;
}

function buildFeature(project, doc) {
  const geometry = sanitizeGeometry(doc.geometry);
  if (!geometry) return null;

  const feature = {
    type: "Feature",
    id: toIdString(doc._id),
    geometry,
    properties: buildFeatureProperties(project, doc),
  };

  if (doc.geometry?.bbox != null) {
    feature.bbox = doc.geometry.bbox;
  }

  return feature;
}

function buildExportSection(section) {
  const exportedSection = {
    id: section?.id ?? null,
    name: section?.name ?? "",
  };

  if (section?.systemKey !== undefined) {
    exportedSection.systemKey = section.systemKey;
  }

  exportedSection.inputs = Array.isArray(section?.inputs) ? section.inputs : [];

  return exportedSection;
}

function buildExportSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map(buildExportSection);
}

function buildCollectionMetadata(project) {
  return {
    engineKey: project.engineKey || "",
    projectName: project.projectName || "",
    projectDescription: project.projectDescription || "",
    projectTags: Array.isArray(project.projectTags) ? project.projectTags : [],
    previewText: project.previewText || "",
    geometry: project.geometry || {},
    time: project.time || {},
    sections: buildExportSections(project.sections),
    extensions: project.extensions || {},
    createdAt: toIsoOrNull(project.createdAt),
    updatedAt: toIsoOrNull(project.updatedAt),
    configUpdatedAt: toIsoOrNull(project.configUpdatedAt),
    exportedAt: new Date().toISOString(),
  };
}

/*
 * The project's own data items as Features. Split out of
 * buildProjectGeoJSON below so the Layers and Aggregates exports can
 * place these after their own boundary features inside a single
 * FeatureCollection, rather than having to unwrap a second one.
 */
export function buildProjectDataFeatures(project, docs) {
  if (project?.engineKey === "presence") return [];
  return docs.map((doc) => buildFeature(project, doc)).filter(Boolean);
}

/*
 * The project schema/metadata block. Exported under this name because
 * the Layers and Aggregates exports nest it as `properties.schema`
 * (Brody's own call - it reads as the schema those layers/aggregates
 * were defined against), while the plain project export in
 * server/routes/projects.js keeps it as a top-level `metadata` member
 * via buildProjectGeoJSON. Same object either way.
 */
export function buildProjectSchemaProperties(project) {
  return buildCollectionMetadata(project);
}

/*
 * One boundary as a Feature - shared by the Boundaries tab's own
 * exports (server/routes/boundaries.js) and by the Layers/Aggregates
 * exports, which now emit every referenced boundary as a real feature
 * instead of inlining its geometry onto whatever references it.
 * `type: "boundary"` mirrors the data items' own properties.type
 * ("place"/"event") so a reader can tell at a glance which features in
 * a mixed collection are boundaries; the fallback covers boundary
 * documents created before that field was stored. bbox sits after
 * geometry, matching buildFeature's own ordering.
 */
export function buildBoundaryFeature(boundary) {
  const feature = {
    type: "Feature",
    id: toIdString(boundary._id),
    properties: {
      type: boundary.type || "boundary",
      name: boundary.name || "",
      fillColor: boundary.fillColor,
      borderColor: boundary.borderColor,
      centroid: boundary.geometry?.centroid ?? null,
    },
    geometry: {
      type: boundary.geometry?.type,
      coordinates: boundary.geometry?.coordinates,
    },
  };

  if (boundary.geometry?.bbox != null) {
    feature.bbox = boundary.geometry.bbox;
  }

  return feature;
}

export function buildProjectGeoJSON(project, docs) {
  return {
    type: "FeatureCollection",
    id: toIdString(project._id),
    name: project.projectName || "",
    metadata: buildCollectionMetadata(project),
    features: buildProjectDataFeatures(project, docs),
  };
}

/*
 * The boundary features for a set of layer or aggregate documents.
 *
 * A boundary now lives inside each document's own filterState.geometry,
 * and there are two ways it can be expressed, so this resolves both to
 * the same thing:
 *
 *  - "Selected Boundary" emits the saved boundary document, deduplicated
 *    - two layers over the same boundary still export it once.
 *  - "Bounding Box" has no saved document to emit, so the rectangle is
 *    synthesized here, with its bbox/centroid computed by the same
 *    sanitizeBoundaryGeometry the import and draw paths use. It is only
 *    emitted once all four bounds are set (resolveFilterBoundaryShape's
 *    own rule) - a partial box still filters, but drawing three edges
 *    nobody entered would be inventing data.
 *
 * A synthesized feature takes the id of the layer or aggregate it was
 * built for; a saved boundary keeps its own. Either way the link back
 * is already in the document's own filterState.geometry.boundaryId, so
 * nothing extra is written into the properties for it.
 */
export function buildFilterBoundaryFeatures(docs, boundaryDocs) {
  const boundaryById = new Map(
    (boundaryDocs || []).map((boundary) => [String(boundary._id), boundary]),
  );

  const features = [];
  const seenBoundaryIds = new Set();

  for (const doc of docs || []) {
    const filterValue = doc?.filterState?.geometry;

    /*
     * A saved boundary is emitted as itself, deduplicated - two docs
     * over the same boundary still export it once.
     */
    const savedBoundary =
      filterValue?.boundaryMode === BOUNDARY_MODE_BOUNDARY && filterValue?.boundaryId
        ? boundaryById.get(String(filterValue.boundaryId))
        : null;

    if (savedBoundary) {
      const boundaryId = String(savedBoundary._id);

      if (seenBoundaryIds.has(boundaryId)) continue;
      seenBoundaryIds.add(boundaryId);

      features.push(buildBoundaryFeature(savedBoundary));
      continue;
    }

    /*
     * Everything else is synthesized from whatever the filter resolves
     * to, which is never nothing - an unconstrained filter resolves to
     * the world itself (resolveFilterBoundaryShape). So every layer and
     * aggregate always exports exactly one boundary feature, and no
     * consumer needs a "this one has no boundary" case.
     */
    const shape = resolveFilterBoundaryShape(filterValue, boundaryById);
    const sanitized = sanitizeBoundaryGeometry(shape);

    if (!sanitized) continue;

    const featureId = toIdString(doc._id);

    features.push(
      buildBoundaryFeature({
        _id: featureId,
        name:
          filterValue?.boundaryMode === BOUNDARY_MODE_BOUNDARY
            ? "No Boundary"
            : "Bounding Box",
        geometry: sanitized,
      }),
    );
  }

  return features;
}
