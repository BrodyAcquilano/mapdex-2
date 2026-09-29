// src/map/mapbox/layers/PolygonLayer.jsx

import { useEffect, useMemo, useRef } from "react";

import MapboxSelectedItemPopup from "../popup/MapboxSelectedItemPopup.jsx";

const SOURCE_ID = "mapdex-polygons";
const FILL_LAYER_ID = "mapdex-polygons-fill-layer";
const BORDER_LAYER_ID = "mapdex-polygons-border-layer";

const DEFAULT_BORDER_COLOR = "#2563eb";
const DEFAULT_FILL_COLOR = "#3b82f6";

function isFiniteCoordinatePair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return false;

  return (
    Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]))
  );
}

function isValidPolygon(geometry) {
  if (geometry?.type !== "Polygon") return false;

  const outerRing = geometry.coordinates?.[0];

  return (
    Array.isArray(outerRing) &&
    outerRing.length >= 4 &&
    outerRing.every(isFiniteCoordinatePair)
  );
}

function buildFeatureCollection(data, selectedDataItem) {
  const selectedId =
    selectedDataItem?._id != null ? String(selectedDataItem._id) : null;

  const features = [];

  for (const dataItem of data || []) {
    const geometry = dataItem?.geometry;

    if (!isValidPolygon(geometry)) continue;

    const dataItemId = dataItem?._id != null ? String(dataItem._id) : "";
    const isSelected = selectedId !== null && selectedId === dataItemId;

    features.push({
      type: "Feature",

      properties: {
        mapdexId: dataItemId,
        selected: isSelected,
        fillColor: geometry.fillColor ?? DEFAULT_FILL_COLOR,
        borderColor: geometry.borderColor ?? DEFAULT_BORDER_COLOR,
      },

      geometry: {
        type: "Polygon",
        coordinates: geometry.coordinates,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

function addPolygonLayers(mapboxMap, featureCollection) {
  if (!mapboxMap.getSource(SOURCE_ID)) {
    mapboxMap.addSource(SOURCE_ID, {
      type: "geojson",
      data: featureCollection,
    });
  }

  if (!mapboxMap.getLayer(FILL_LAYER_ID)) {
    mapboxMap.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      slot: "top",

      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": ["case", ["get", "selected"], 0.6, 0.14],
      },
    });
  }

  if (!mapboxMap.getLayer(BORDER_LAYER_ID)) {
    mapboxMap.addLayer({
      id: BORDER_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      slot: "top",

      paint: {
        "line-color": ["get", "borderColor"],
        "line-width": ["case", ["get", "selected"], 3, 2],
        "line-opacity": ["case", ["get", "selected"], 1, 0.65],
      },
    });
  }
}

/*
 * Reverses addPolygonLayers: layers must be removed before the
 * source they reference, or Mapbox throws. Called when this
 * component unmounts (e.g. the active engine changes) so a persistent
 * map instance doesn't accumulate a previous engine's sources/layers.
 */
function removePolygonLayers(mapboxMap) {
  if (mapboxMap.getLayer(BORDER_LAYER_ID)) mapboxMap.removeLayer(BORDER_LAYER_ID);
  if (mapboxMap.getLayer(FILL_LAYER_ID)) mapboxMap.removeLayer(FILL_LAYER_ID);
  if (mapboxMap.getSource(SOURCE_ID)) mapboxMap.removeSource(SOURCE_ID);
}

export default function MapboxPolygonLayer({
  mapboxMap,
  data,
  selectedDataItem,
  setSelectedDataItem,
  dataUtils,
  schema,
}) {
  const dataRef = useRef(data || []);
  const selectedIdRef = useRef(null);
  const featureCollectionRef = useRef(null);

  const featureCollection = useMemo(
    () => buildFeatureCollection(data, selectedDataItem),
    [data, selectedDataItem?._id],
  );

  useEffect(() => {
    dataRef.current = Array.isArray(data) ? data : [];
  }, [data]);

  useEffect(() => {
    selectedIdRef.current =
      selectedDataItem?._id != null ? String(selectedDataItem._id) : null;
  }, [selectedDataItem?._id]);

  useEffect(() => {
    featureCollectionRef.current = featureCollection;
  }, [featureCollection]);

  /*
   * Create the Mapbox source and layers once per map instance, and
   * again every time Mapbox reloads the style (confirmed empirically:
   * setStyle() does NOT preserve runtime-added sources/layers). Rather
   * than a React counter/state flag, listening for the map's own
   * native "style.load" event triggers the same addPolygonLayers call
   * directly - its `if (!getSource(...))` guard exists so this can't
   * throw if it's ever invoked twice for an unrelated reason, not as a
   * "skip if unchanged" optimization.
   */
  useEffect(() => {
    if (!mapboxMap) return;

    const applyLayers = () => {
      addPolygonLayers(mapboxMap, featureCollectionRef.current);
    };

    applyLayers();
    mapboxMap.on("style.load", applyLayers);

    return () => {
      mapboxMap.off("style.load", applyLayers);
      removePolygonLayers(mapboxMap);
    };
  }, [mapboxMap]);

  /*
   * Update the existing GeoJSON source whenever Mapdex data or
   * selection changes.
   */
  useEffect(() => {
    if (!mapboxMap) return;

    const source = mapboxMap.getSource(SOURCE_ID);
    if (!source) return;

    source.setData(featureCollection);
  }, [mapboxMap, featureCollection]);

  /*
   * Mapbox click / hover interaction.
   */
  useEffect(() => {
    if (!mapboxMap) return;

    const handlePolygonClick = (event) => {
      const feature = event.features?.[0];
      const mapdexId = feature?.properties?.mapdexId;

      if (!mapdexId) return;

      const dataItem = dataRef.current.find(
        (item) => String(item?._id) === String(mapdexId),
      );

      if (!dataItem) return;

      const isAlreadySelected = selectedIdRef.current === String(mapdexId);

      setSelectedDataItem(isAlreadySelected ? null : dataItem);
    };

    const handleMouseEnter = () => {
      mapboxMap.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      mapboxMap.getCanvas().style.cursor = "";
    };

    mapboxMap.on("click", FILL_LAYER_ID, handlePolygonClick);
    mapboxMap.on("mouseenter", FILL_LAYER_ID, handleMouseEnter);
    mapboxMap.on("mouseleave", FILL_LAYER_ID, handleMouseLeave);

    return () => {
      mapboxMap.off("click", FILL_LAYER_ID, handlePolygonClick);
      mapboxMap.off("mouseenter", FILL_LAYER_ID, handleMouseEnter);
      mapboxMap.off("mouseleave", FILL_LAYER_ID, handleMouseLeave);
    };
  }, [mapboxMap, setSelectedDataItem]);

  return (
    <MapboxSelectedItemPopup
      mapboxMap={mapboxMap}
      selectedDataItem={selectedDataItem}
      getGeometry={(dataItem) => dataItem?.geometry}
      getCentroid={(dataItem) => dataItem?.geometry?.centroid}
      dataUtils={dataUtils}
      schema={schema}
    />
  );
}
