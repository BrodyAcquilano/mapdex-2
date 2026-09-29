// src/map/mapbox/layers/MotionLayer.jsx

import { useEffect, useMemo, useRef } from "react";

import MapboxSelectedItemPopup from "../popup/MapboxSelectedItemPopup.jsx";

const LINE_SOURCE_ID = "mapdex-motion-lines";
const POINT_SOURCE_ID = "mapdex-motion-points";
const LINE_LAYER_ID = "mapdex-motion-line-layer";
const POINT_LAYER_ID = "mapdex-motion-point-layer";

const DEFAULT_LINE_COLOR = "#3388ff";

const DEFAULT_USER_COLOR_THEME = {
  fill: "rgba(26, 203, 53, 0.96)",
};

function isFiniteCoordinatePair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return false;

  return (
    Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]))
  );
}

function motionSamplesToLngLat(samples) {
  if (!Array.isArray(samples)) return [];

  return samples
    .map((sample) => {
      const lat = Number(sample?.lat);
      const lng = Number(sample?.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return [lng, lat];
    })
    .filter(Boolean);
}

function getDistinctPositions(positions) {
  const seen = new Set();
  const distinct = [];

  for (const position of positions) {
    const key = `${position[0].toFixed(6)},${position[1].toFixed(6)}`;

    if (seen.has(key)) continue;

    seen.add(key);
    distinct.push(position);
  }

  return distinct;
}

function emptyCollections() {
  return {
    lines: { type: "FeatureCollection", features: [] },
    points: { type: "FeatureCollection", features: [] },
  };
}

/*
 * Builds the in-progress (not yet saved) motion trail while the user
 * is actively tracking their location, mirroring the Leaflet
 * MotionLayer's "trackLocation" branch.
 */
function buildLiveFeatureCollections(motionSamples, userColorTheme) {
  const positions = motionSamplesToLngLat(motionSamples);
  const distinctPositions = getDistinctPositions(positions);

  const color =
    (userColorTheme || DEFAULT_USER_COLOR_THEME).fill ||
    DEFAULT_USER_COLOR_THEME.fill;

  const collections = emptyCollections();

  if (distinctPositions.length >= 2) {
    collections.lines.features.push({
      type: "Feature",
      properties: { mapdexId: "", selected: true, lineColor: color },
      geometry: { type: "LineString", coordinates: positions },
    });

    return collections;
  }

  if (positions.length >= 1) {
    collections.points.features.push({
      type: "Feature",
      properties: { mapdexId: "", selected: true, fillColor: color },
      geometry: { type: "Point", coordinates: positions[0] },
    });
  }

  return collections;
}

/*
 * Builds the saved motion routes, mirroring the Leaflet MotionLayer's
 * non-tracking branch.
 */
function buildSavedFeatureCollections(data, selectedDataItem) {
  const selectedId =
    selectedDataItem?._id != null ? String(selectedDataItem._id) : null;

  const collections = emptyCollections();

  for (const dataItem of data || []) {
    const geometry = dataItem?.geometry;
    if (geometry?.type !== "LineString") continue;

    const coordinates = Array.isArray(geometry.coordinates)
      ? geometry.coordinates.filter(isFiniteCoordinatePair)
      : [];

    if (coordinates.length === 0) continue;

    const dataItemId = dataItem?._id != null ? String(dataItem._id) : "";
    const isSelected = selectedId !== null && selectedId === dataItemId;
    const lineColor = geometry.lineColor || DEFAULT_LINE_COLOR;

    const distinctPositions = getDistinctPositions(coordinates);

    if (distinctPositions.length >= 2) {
      collections.lines.features.push({
        type: "Feature",
        properties: { mapdexId: dataItemId, selected: isSelected, lineColor },
        geometry: { type: "LineString", coordinates },
      });

      continue;
    }

    collections.points.features.push({
      type: "Feature",
      properties: {
        mapdexId: dataItemId,
        selected: isSelected,
        fillColor: lineColor,
      },
      geometry: {
        type: "Point",
        coordinates: distinctPositions[0] || coordinates[0],
      },
    });
  }

  return collections;
}

function addMotionLayers(mapboxMap, lineCollection, pointCollection) {
  if (!mapboxMap.getSource(LINE_SOURCE_ID)) {
    mapboxMap.addSource(LINE_SOURCE_ID, {
      type: "geojson",
      data: lineCollection,
    });
  }

  if (!mapboxMap.getSource(POINT_SOURCE_ID)) {
    mapboxMap.addSource(POINT_SOURCE_ID, {
      type: "geojson",
      data: pointCollection,
    });
  }

  if (!mapboxMap.getLayer(LINE_LAYER_ID)) {
    mapboxMap.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: LINE_SOURCE_ID,
      slot: "top",

      layout: {
        "line-cap": "round",
        "line-join": "round",
      },

      paint: {
        "line-color": ["get", "lineColor"],
        "line-width": ["case", ["get", "selected"], 7, 5],
        "line-opacity": ["case", ["get", "selected"], 1, 0.65],
      },
    });
  }

  if (!mapboxMap.getLayer(POINT_LAYER_ID)) {
    mapboxMap.addLayer({
      id: POINT_LAYER_ID,
      type: "circle",
      source: POINT_SOURCE_ID,
      slot: "top",

      paint: {
        "circle-radius": ["case", ["get", "selected"], 7, 6],
        "circle-color": ["get", "fillColor"],
        "circle-opacity": ["case", ["get", "selected"], 1, 0.65],
      },
    });
  }
}

/*
 * Reverses addMotionLayers: layers must be removed before the
 * sources they reference, or Mapbox throws. Called when this
 * component unmounts (e.g. the active engine changes) so a persistent
 * map instance doesn't accumulate a previous engine's sources/layers.
 */
function removeMotionLayers(mapboxMap) {
  if (mapboxMap.getLayer(POINT_LAYER_ID)) mapboxMap.removeLayer(POINT_LAYER_ID);
  if (mapboxMap.getLayer(LINE_LAYER_ID)) mapboxMap.removeLayer(LINE_LAYER_ID);

  if (mapboxMap.getSource(POINT_SOURCE_ID)) {
    mapboxMap.removeSource(POINT_SOURCE_ID);
  }

  if (mapboxMap.getSource(LINE_SOURCE_ID)) {
    mapboxMap.removeSource(LINE_SOURCE_ID);
  }
}

export default function MapboxMotionLayer({
  mapboxMap,
  data,
  motionSamples,
  selectedDataItem,
  setSelectedDataItem,
  trackLocation,
  userColorTheme,
  dataUtils,
  schema,
  map,
}) {
  const dataRef = useRef(data || []);
  const selectedIdRef = useRef(null);
  const lastFocusedIdRef = useRef(null);
  const lineCollectionRef = useRef(null);
  const pointCollectionRef = useRef(null);

  useEffect(() => {
    dataRef.current = Array.isArray(data) ? data : [];
  }, [data]);

  useEffect(() => {
    selectedIdRef.current =
      selectedDataItem?._id != null ? String(selectedDataItem._id) : null;
  }, [selectedDataItem?._id]);

  /*
   * Center on the stored, authoritative centroid
   * (shared/validation/lineStringValidation.js), matching Leaflet's
   * MotionLayer.
   */
  useEffect(() => {
    if (!selectedDataItem || !map) {
      lastFocusedIdRef.current = null;
      return;
    }

    if (trackLocation) {
      lastFocusedIdRef.current = null;
      return;
    }

    if (lastFocusedIdRef.current === selectedDataItem._id) return;

    const centroidLat = Number(
      selectedDataItem.geometry?.centroid?.lat,
    );
    const centroidLng = Number(
      selectedDataItem.geometry?.centroid?.lng,
    );

    if (
      !Number.isFinite(centroidLat) ||
      !Number.isFinite(centroidLng)
    ) {
      return;
    }

    lastFocusedIdRef.current = selectedDataItem._id;
    map.focus(
      centroidLat,
      centroidLng,
      selectedDataItem._id,
      0.4,
    );
    /*
     * Deliberately excludes `map`: map.focus() updates mapCenter,
     * which recreates the shared runtime `map` object (see
     * GlobalRuntime.jsx), which would retrigger this effect on every
     * focus call if `map` were a dependency here. The
     * lastFocusedIdRef guard above makes that self-terminate rather
     * than loop, but it's excluded outright to avoid depending on
     * that guard alone.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedDataItem?._id,
    selectedDataItem?.updatedAt,
    trackLocation,
  ]);

  const { lines: lineCollection, points: pointCollection } = useMemo(() => {
    if (trackLocation) {
      return buildLiveFeatureCollections(motionSamples, userColorTheme);
    }

    return buildSavedFeatureCollections(data, selectedDataItem);
  }, [
    trackLocation,
    motionSamples,
    userColorTheme,
    data,
    selectedDataItem?._id,
  ]);

  useEffect(() => {
    lineCollectionRef.current = lineCollection;
    pointCollectionRef.current = pointCollection;
  }, [lineCollection, pointCollection]);

  /*
   * Create the Mapbox sources and layers once per map instance, and
   * again every time Mapbox reloads the style (confirmed empirically:
   * setStyle() does NOT preserve runtime-added sources/layers). Rather
   * than a React counter/state flag, listening for the map's own
   * native "style.load" event triggers the same addMotionLayers call
   * directly - its `if (!getSource(...))` guards exist so this can't
   * throw if it's ever invoked twice for an unrelated reason, not as a
   * "skip if unchanged" optimization.
   */
  useEffect(() => {
    if (!mapboxMap) return;

    const applyLayers = () => {
      addMotionLayers(
        mapboxMap,
        lineCollectionRef.current,
        pointCollectionRef.current,
      );
    };

    applyLayers();
    mapboxMap.on("style.load", applyLayers);

    return () => {
      mapboxMap.off("style.load", applyLayers);
      removeMotionLayers(mapboxMap);
    };
  }, [mapboxMap]);

  /*
   * Update the existing GeoJSON sources whenever Mapdex data, live
   * motion samples, or selection changes.
   */
  useEffect(() => {
    if (!mapboxMap) return;

    const lineSource = mapboxMap.getSource(LINE_SOURCE_ID);
    if (lineSource) lineSource.setData(lineCollection);

    const pointSource = mapboxMap.getSource(POINT_SOURCE_ID);
    if (pointSource) pointSource.setData(pointCollection);
  }, [mapboxMap, lineCollection, pointCollection]);

  /*
   * Mapbox click / hover interaction. Not wired up while actively
   * tracking, since the live trail isn't a saved, selectable item.
   */
  useEffect(() => {
    if (!mapboxMap || trackLocation) return;

    const interactiveLayerIds = [LINE_LAYER_ID, POINT_LAYER_ID];

    const handleClick = (event) => {
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

    for (const layerId of interactiveLayerIds) {
      mapboxMap.on("click", layerId, handleClick);
      mapboxMap.on("mouseenter", layerId, handleMouseEnter);
      mapboxMap.on("mouseleave", layerId, handleMouseLeave);
    }

    return () => {
      for (const layerId of interactiveLayerIds) {
        mapboxMap.off("click", layerId, handleClick);
        mapboxMap.off("mouseenter", layerId, handleMouseEnter);
        mapboxMap.off("mouseleave", layerId, handleMouseLeave);
      }
    };
  }, [mapboxMap, setSelectedDataItem, trackLocation]);

  return (
    <MapboxSelectedItemPopup
      mapboxMap={mapboxMap}
      selectedDataItem={selectedDataItem}
      enabled={!trackLocation}
      getGeometry={(dataItem) => dataItem?.geometry}
      dataUtils={dataUtils}
      schema={schema}
    />
  );
}
