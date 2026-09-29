// src/map/mapbox/layers/AggregateShapesLayer.jsx

import { useEffect, useMemo, useRef } from "react";

const SOURCE_ID = "mapdex-aggregate-shapes";
const FILL_LAYER_ID = "mapdex-aggregate-shapes-fill";
const BORDER_LAYER_ID = "mapdex-aggregate-shapes-border";

function isFiniteCoordinatePair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return false;

  const lng = Number(pair[0]);
  const lat = Number(pair[1]);

  return Number.isFinite(lng) && Number.isFinite(lat);
}

function isValidGeometry(geometry) {
  if (geometry?.type === "Polygon") {
    const outerRing = geometry.coordinates?.[0];
    return Array.isArray(outerRing) && outerRing.length >= 4 && outerRing.every(isFiniteCoordinatePair);
  }

  if (geometry?.type === "MultiPolygon") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length > 0 &&
      geometry.coordinates.every((polygon) => {
        const outerRing = polygon?.[0];
        return Array.isArray(outerRing) && outerRing.length >= 4 && outerRing.every(isFiniteCoordinatePair);
      })
    );
  }

  return false;
}

function buildFeatureCollection(items) {
  const features = [];

  for (const item of items || []) {
    const geometry = item?.geometry;
    if (!isValidGeometry(geometry)) continue;

    const opacity = Number.isFinite(Number(item.opacity)) ? Number(item.opacity) : 1;

    features.push({
      type: "Feature",
      properties: {
        fillColor: item.fillColor,
        borderColor: item.borderColor,
        opacity,
      },
      geometry: { type: geometry.type, coordinates: geometry.coordinates },
    });
  }

  return { type: "FeatureCollection", features };
}

function addShapesLayers(mapboxMap, featureCollection) {
  if (!mapboxMap.getSource(SOURCE_ID)) {
    mapboxMap.addSource(SOURCE_ID, { type: "geojson", data: featureCollection });
  }

  if (!mapboxMap.getLayer(FILL_LAYER_ID)) {
    mapboxMap.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      slot: "top",
      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": ["*", ["get", "opacity"], 0.35],
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
        "line-width": 2,
        "line-opacity": ["get", "opacity"],
      },
    });
  }
}

function removeShapesLayers(mapboxMap) {
  if (mapboxMap.getLayer(BORDER_LAYER_ID)) mapboxMap.removeLayer(BORDER_LAYER_ID);
  if (mapboxMap.getLayer(FILL_LAYER_ID)) mapboxMap.removeLayer(FILL_LAYER_ID);
  if (mapboxMap.getSource(SOURCE_ID)) mapboxMap.removeSource(SOURCE_ID);
}

/*
 * Mapbox counterpart to ../../leaflet/layers/AggregateShapesLayer.jsx -
 * see that file's own comment for why one shared shape renderer serves
 * both of the Aggregates page's map modes.
 */
export default function MapboxAggregateShapesLayer({ mapboxMap, items }) {
  const featureCollectionRef = useRef(null);

  const featureCollection = useMemo(() => buildFeatureCollection(items), [items]);

  useEffect(() => {
    featureCollectionRef.current = featureCollection;
  }, [featureCollection]);

  useEffect(() => {
    if (!mapboxMap) return;

    const applyLayers = () => addShapesLayers(mapboxMap, featureCollectionRef.current);

    applyLayers();
    mapboxMap.on("style.load", applyLayers);

    return () => {
      mapboxMap.off("style.load", applyLayers);
      removeShapesLayers(mapboxMap);
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
