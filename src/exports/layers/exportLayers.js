// src/exports/layers/exportLayers.js

import {
  buildFilterBoundaryFeatures,
  buildProjectDataFeatures,
  buildProjectSchemaProperties,
} from "../../../shared/exports/geoJSONExport.js";
import { downloadGeoJSON } from "../utils/downloadGeoJSON.js";

/*
 * One layer's entry inside the FeatureCollection's own properties. A
 * layer has no geometry of its own - it's a saved filter over the
 * project's data, optionally clipped to a boundary - so it belongs in
 * properties rather than features. Its boundary travels inside its own
 * filterState, and the boundary itself is emitted as a feature.
 *
 * Only the full snapshot contains the data items, so only it carries
 * dataItemIds; the filterState that defines the layer travels with both.
 */
function buildLayerProperties(layer, dataItemIds) {
  const properties = {
    _id: String(layer._id),
    name: layer.name || "",
    description: layer.description || "",
    classification: layer.classification,
    fillColor: layer.fillColor,
    borderColor: layer.borderColor,
    opacity: layer.opacity,
    visible: layer.visible,
    order: layer.order,
    filterState: layer.filterState || {},
    createdAt: layer.createdAt,
    updatedAt: layer.updatedAt,
  };

  if (Array.isArray(dataItemIds)) {
    properties.dataItemIds = dataItemIds;
  }

  return properties;
}

function buildLayersPropertyMap(layers, dataItemIdsByLayerId) {
  const map = {};

  for (const layer of layers) {
    map[String(layer._id)] = buildLayerProperties(
      layer,
      dataItemIdsByLayerId?.get(String(layer._id)),
    );
  }

  return map;
}

/*
 * Exports the layers given, in one of two shapes.
 *
 * "partial" is the layer definitions plus whichever boundaries they clip
 * to; "full" adds the project schema and a deduplicated snapshot of
 * every data item that matched any of them. The caller re-derives each
 * layer's membership (a layer's members are a live re-filter, never a
 * stored id list) and passes it in as dataItemIdsByLayerId for the full
 * variant.
 *
 * `layers` should already be narrowed to what is visible - deciding
 * that is the page's job, not this one's.
 */
export function exportLayers({
  schema,
  layers,
  boundaries,
  data,
  dataItemIdsByLayerId,
  mode,
  system,
}) {
  const docs = Array.isArray(layers) ? layers : [];

  if (docs.length === 0) {
    system?.notify?.("No visible layers to export.");
    return false;
  }

  const isFull = mode === "full";

  const boundaryFeatures = buildFilterBoundaryFeatures(
    docs,
    Array.isArray(boundaries) ? boundaries : [],
  );

  const geojson = {
    type: "FeatureCollection",
    id: String(schema._id),
    name: schema.projectName || "",
    properties: {
      layers: buildLayersPropertyMap(docs, isFull ? dataItemIdsByLayerId : null),
    },
    features: boundaryFeatures,
  };

  if (isFull) {
    geojson.properties.schema = buildProjectSchemaProperties(schema);
    geojson.features = [
      ...boundaryFeatures,
      ...buildProjectDataFeatures(schema, Array.isArray(data) ? data : []),
    ];
  }

  downloadGeoJSON(
    geojson,
    `${schema.projectName || "project"}-layers${isFull ? "-full" : ""}`,
  );

  system?.notify?.("Layers exported.");
  return true;
}
