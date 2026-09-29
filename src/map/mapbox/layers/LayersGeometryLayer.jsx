// src/map/mapbox/layers/LayersGeometryLayer.jsx

import { useEffect, useMemo, useRef } from "react";

import { getLayerMatchingData } from "../../../layers/utils/computeLayerMembers.js";

const SOURCE_ID = "mapdex-layers";

const DATA_LAYER_FILL_COLOR = "#3b82f6";
const DATA_LAYER_BORDER_COLOR = "#2563eb";

const POINT_LAYER_ID = "mapdex-layers-points";
const LINE_LAYER_ID = "mapdex-layers-lines";
const POLYGON_FILL_LAYER_ID = "mapdex-layers-polygons-fill";
const POLYGON_BORDER_LAYER_ID = "mapdex-layers-polygons-border";

function isFiniteCoordinatePair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return false;

  const lng = Number(pair[0]);
  const lat = Number(pair[1]);

  return Number.isFinite(lng) && Number.isFinite(lat);
}

function isValidGeometry(geometry) {
  if (!geometry?.type) return false;

  if (geometry.type === "Point") {
    return isFiniteCoordinatePair(geometry.coordinates);
  }

  if (geometry.type === "LineString") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length >= 2 &&
      geometry.coordinates.every(isFiniteCoordinatePair)
    );
  }

  if (geometry.type === "Polygon") {
    const outerRing = geometry.coordinates?.[0];

    return (
      Array.isArray(outerRing) &&
      outerRing.length >= 4 &&
      outerRing.every(isFiniteCoordinatePair)
    );
  }

  if (geometry.type === "MultiPoint") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length >= 2 &&
      geometry.coordinates.every(isFiniteCoordinatePair)
    );
  }

  if (geometry.type === "MultiLineString") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length > 0 &&
      geometry.coordinates.every(
        (line) => Array.isArray(line) && line.length >= 2 && line.every(isFiniteCoordinatePair),
      )
    );
  }

  if (geometry.type === "MultiPolygon") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length > 0 &&
      geometry.coordinates.every((polygon) => {
        const outerRing = polygon?.[0];

        return (
          Array.isArray(outerRing) &&
          outerRing.length >= 4 &&
          outerRing.every(isFiniteCoordinatePair)
        );
      })
    );
  }

  return false;
}

/*
 * Same assignment idea as the Leaflet renderer's own
 * buildAssignmentMap - layers are processed in ascending `order`, each
 * subsequent layer overwriting any earlier assignment for the same
 * item, so a data item belonging to more than one visible layer always
 * renders with whichever of those layers has the *highest* order
 * (matching that layer's own position in the stack - see
 * buildFeatureCollection below, which sorts features by this same
 * `order`). One fillColor/borderColor pair per layer, applied
 * uniformly regardless of geometry type - borderColor doubles as the
 * line color for LineString/MultiLineString (see the paint expressions
 * in addLayersGeometryLayers below). Membership is a live re-filter of
 * each layer's own stored filterState (see computeLayerMembers.js's
 * own comment), not a frozen id list.
 */
function buildAssignmentMap(layers, data, schema, filterTimeZone, boundaries) {
  const boundaryById = new Map(
    (boundaries || []).map((boundary) => [String(boundary._id), boundary]),
  );

  const assignments = new Map();

  const sortedVisibleLayers = (layers || [])
    .filter((layer) => layer?.visible === true)
    .slice()
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  for (const layer of sortedVisibleLayers) {
    const opacity = Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1;
    const order = Number(layer.order) || 0;

    const colors = {
      fillColor: layer.fillColor,
      borderColor: layer.borderColor,
    };

    const matchingItems = getLayerMatchingData(
      layer,
      data,
      schema,
      filterTimeZone,
      boundaryById,
    );

    for (const dataItem of matchingItems) {
      const key = String(dataItem?._id);
      if (key) {
        assignments.set(key, { ...colors, opacity, order });
      }
    }
  }

  return assignments;
}

/*
 * Falls back to the "Data Layer" toggle's own look (LayerListPanel.jsx)
 * for a data item that isn't a member of any visible layer - every
 * item's own native stored color (or the same default every
 * unclassified item on Viewer/Editor already falls back to), at
 * dataLayerOpacity, rather than any single layer's own flat color.
 * Mapbox's declarative paint expressions don't care whether a
 * feature's own color properties came from a layer assignment or this
 * fallback - both are stamped into the same property shape, so
 * addLayersGeometryLayers' paint below needs no branching of its own.
 */
function buildDataLayerProperties(geometry, dataLayerOpacity) {
  return {
    fillColor: geometry.fillColor || DATA_LAYER_FILL_COLOR,
    borderColor: geometry.borderColor || DATA_LAYER_BORDER_COLOR,
    layerOpacity: Number.isFinite(Number(dataLayerOpacity)) ? Number(dataLayerOpacity) : 1,
  };
}

/*
 * Mapbox draws features from a single GeoJSON source in the order
 * they appear in the source's own feature array, so - same goal as
 * the Leaflet renderer's own buildRenderGroups - unassigned (Data
 * Layer) features are placed first (bottom) and assigned features
 * after, sorted by their winning layer's own `order` ascending. Keeps
 * the Data Layer on the bottom and gives every layer a stable stacking
 * position instead of whatever order `data` happened to arrive in.
 */
function buildFeatureCollection(data, layers, schema, filterTimeZone, showDataLayer, dataLayerOpacity, boundaries) {
  const assignments = buildAssignmentMap(layers, data, schema, filterTimeZone, boundaries);
  const unassignedFeatures = [];
  const assignedFeatures = [];

  for (const dataItem of data || []) {
    const geometry = dataItem?.geometry;
    if (!isValidGeometry(geometry)) continue;

    const assignment = assignments.get(String(dataItem?._id));

    const feature = {
      type: "Feature",
      geometry: {
        type: geometry.type,
        coordinates: geometry.coordinates,
      },
    };

    if (assignment) {
      feature.properties = {
        fillColor: assignment.fillColor,
        borderColor: assignment.borderColor,
        layerOpacity: assignment.opacity,
      };

      assignedFeatures.push({ order: assignment.order, feature });
      continue;
    }

    if (!showDataLayer) continue;

    feature.properties = buildDataLayerProperties(geometry, dataLayerOpacity);
    unassignedFeatures.push(feature);
  }

  assignedFeatures.sort((a, b) => a.order - b.order);

  return {
    type: "FeatureCollection",
    features: [...unassignedFeatures, ...assignedFeatures.map((entry) => entry.feature)],
  };
}

function addLayersGeometryLayers(mapboxMap, featureCollection) {
  if (!mapboxMap.getSource(SOURCE_ID)) {
    mapboxMap.addSource(SOURCE_ID, {
      type: "geojson",
      data: featureCollection,
    });
  }

  if (!mapboxMap.getLayer(POLYGON_FILL_LAYER_ID)) {
    mapboxMap.addLayer({
      id: POLYGON_FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      slot: "top",
      filter: [
        "any",
        ["==", ["geometry-type"], "Polygon"],
        ["==", ["geometry-type"], "MultiPolygon"],
      ],
      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": ["*", ["get", "layerOpacity"], 0.35],
      },
    });
  }

  if (!mapboxMap.getLayer(POLYGON_BORDER_LAYER_ID)) {
    mapboxMap.addLayer({
      id: POLYGON_BORDER_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      slot: "top",
      filter: [
        "any",
        ["==", ["geometry-type"], "Polygon"],
        ["==", ["geometry-type"], "MultiPolygon"],
      ],
      paint: {
        "line-color": ["get", "borderColor"],
        "line-width": 2,
        "line-opacity": ["get", "layerOpacity"],
      },
    });
  }

  if (!mapboxMap.getLayer(LINE_LAYER_ID)) {
    mapboxMap.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      slot: "top",
      filter: [
        "any",
        ["==", ["geometry-type"], "LineString"],
        ["==", ["geometry-type"], "MultiLineString"],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "borderColor"],
        "line-width": 5,
        "line-opacity": ["get", "layerOpacity"],
      },
    });
  }

  if (!mapboxMap.getLayer(POINT_LAYER_ID)) {
    mapboxMap.addLayer({
      id: POINT_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      slot: "top",
      filter: [
        "any",
        ["==", ["geometry-type"], "Point"],
        ["==", ["geometry-type"], "MultiPoint"],
      ],
      paint: {
        "circle-radius": 8,
        "circle-color": ["get", "fillColor"],
        "circle-opacity": ["get", "layerOpacity"],
        "circle-stroke-color": ["get", "borderColor"],
        "circle-stroke-width": 1,
        "circle-stroke-opacity": ["get", "layerOpacity"],
      },
    });
  }
}

/*
 * Reverses addLayersGeometryLayers, mirroring GeometryLayer.jsx's own
 * removeGeometryLayers - called on unmount so a previous engine/page's
 * sources and layers never leak into the persistent Mapbox instance.
 */
function removeLayersGeometryLayers(mapboxMap) {
  if (mapboxMap.getLayer(POINT_LAYER_ID)) mapboxMap.removeLayer(POINT_LAYER_ID);
  if (mapboxMap.getLayer(LINE_LAYER_ID)) mapboxMap.removeLayer(LINE_LAYER_ID);

  if (mapboxMap.getLayer(POLYGON_BORDER_LAYER_ID)) {
    mapboxMap.removeLayer(POLYGON_BORDER_LAYER_ID);
  }

  if (mapboxMap.getLayer(POLYGON_FILL_LAYER_ID)) {
    mapboxMap.removeLayer(POLYGON_FILL_LAYER_ID);
  }

  if (mapboxMap.getSource(SOURCE_ID)) mapboxMap.removeSource(SOURCE_ID);
}

export default function MapboxLayersGeometryLayer({
  mapboxMap,
  data,
  layers,
  schema,
  filterTimeZone,
  showDataLayer,
  dataLayerOpacity,
  boundaries,
}) {
  const featureCollectionRef = useRef(null);

  const featureCollection = useMemo(
    () =>
      buildFeatureCollection(
        data,
        layers,
        schema,
        filterTimeZone,
        showDataLayer,
        dataLayerOpacity,
        boundaries,
      ),
    [data, layers, schema, filterTimeZone, showDataLayer, dataLayerOpacity, boundaries],
  );

  useEffect(() => {
    featureCollectionRef.current = featureCollection;
  }, [featureCollection]);

  useEffect(() => {
    if (!mapboxMap) return;

    const applyLayers = () => {
      addLayersGeometryLayers(mapboxMap, featureCollectionRef.current);
    };

    applyLayers();
    mapboxMap.on("style.load", applyLayers);

    return () => {
      mapboxMap.off("style.load", applyLayers);
      removeLayersGeometryLayers(mapboxMap);
    };
  }, [mapboxMap]);

  useEffect(() => {
    if (!mapboxMap) return;

    const source = mapboxMap.getSource(SOURCE_ID);
    if (!source) return;

    source.setData(featureCollection);
  }, [mapboxMap, featureCollection]);

  return null;
}
