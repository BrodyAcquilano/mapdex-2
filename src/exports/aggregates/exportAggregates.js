// src/exports/aggregates/exportAggregates.js

import {
  buildFilterBoundaryFeatures,
  buildProjectDataFeatures,
  buildProjectSchemaProperties,
} from "../../../shared/exports/geoJSONExport.js";
import { downloadGeoJSON } from "../utils/downloadGeoJSON.js";

/*
 * One aggregate's entry inside the FeatureCollection's own properties.
 *
 * An aggregate has no geometry of its own - it is a set of operations
 * over the data falling inside a boundary - so it sits in properties,
 * and the boundary it reports over travels as its own feature. That
 * boundary comes from its filterState like every other filter.
 *
 * `result` is computed by the caller, which is also where it is computed
 * for the info panel: only ever for the aggregates actually being looked
 * at or exported, never for all of them up front.
 */
function buildAggregateProperties(aggregate, boundaryName, result, dataItemIds) {
  const properties = {
    _id: String(aggregate._id),
    name: aggregate.name || "",
    description: aggregate.description || "",
    boundaryName: boundaryName || "",
    fillColor: aggregate.fillColor,
    borderColor: aggregate.borderColor,
    opacity: aggregate.opacity,
    visible: aggregate.visible,
    order: aggregate.order,
    result: result || null,
    filterState: aggregate.filterState || {},
    fields: Array.isArray(aggregate.fields) ? aggregate.fields : [],
    createdAt: aggregate.createdAt,
    updatedAt: aggregate.updatedAt,
  };

  if (Array.isArray(dataItemIds)) {
    properties.dataItemIds = dataItemIds;
  }

  return properties;
}

/*
 * The name of the saved boundary an aggregate points at, if it points at
 * one. A bounding box has no name, which is why this can be empty - the
 * boundary feature itself still carries the shape either way.
 */
function getBoundaryName(aggregate, boundariesById) {
  const boundaryId = aggregate?.filterState?.geometry?.boundaryId;
  if (!boundaryId) return "";

  return boundariesById.get(String(boundaryId))?.name || "";
}

/*
 * Exports the aggregates given, in one of two shapes - mirroring
 * exportLayers.
 *
 * "partial" is the aggregate definitions with their results, plus the
 * boundaries they report over. "full" adds the project schema and a
 * deduplicated snapshot of every data item that fed into any of them.
 *
 * `resultsById` and `dataItemIdsByAggregateId` are computed by the
 * caller, which has the filtering engine; this module only assembles.
 */
export function exportAggregates({
  schema,
  aggregates,
  boundaries,
  data,
  resultsById,
  dataItemIdsByAggregateId,
  mode,
  system,
}) {
  const docs = Array.isArray(aggregates) ? aggregates : [];

  if (docs.length === 0) {
    system?.notify?.("No visible aggregates to export.");
    return false;
  }

  const isFull = mode === "full";
  const safeBoundaries = Array.isArray(boundaries) ? boundaries : [];
  const boundariesById = new Map(
    safeBoundaries.map((boundary) => [String(boundary._id), boundary]),
  );

  const boundaryFeatures = buildFilterBoundaryFeatures(docs, safeBoundaries);

  const aggregatesProperties = {};

  for (const aggregate of docs) {
    aggregatesProperties[String(aggregate._id)] = buildAggregateProperties(
      aggregate,
      getBoundaryName(aggregate, boundariesById),
      resultsById?.get(String(aggregate._id)),
      isFull ? dataItemIdsByAggregateId?.get(String(aggregate._id)) : undefined,
    );
  }

  const geojson = {
    type: "FeatureCollection",
    id: String(schema._id),
    name: schema.projectName || "",
    properties: { aggregates: aggregatesProperties },
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
    `${schema.projectName || "project"}-aggregates${isFull ? "-full" : ""}`,
  );

  system?.notify?.("Aggregates exported.");
  return true;
}
