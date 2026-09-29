// src/map/mapbox/layers/AnalysisPolygonLayer.jsx

import { useEffect, useMemo, useRef } from "react";

import MapboxSelectedItemPopup from "../popup/MapboxSelectedItemPopup.jsx";

/*
 * The Neighbourhood Analysis choropleth.
 *
 * This is a SEPARATE layer from PolygonLayer.jsx rather than the same
 * polygons repainted. The Leaflet original did it the other way - one
 * PolygonLayer that swapped its own colors when currentPage became
 * "analysis" (see getDisplayColors in the old file) - and that coupling
 * is why the behavior vanished silently during the Mapbox migration:
 * there was no analysis layer to port, only a colour branch buried
 * inside the ordinary one, so porting "the polygon layer" looked
 * complete while the analysis rendering was gone.
 *
 * Brody's call is two distinct layers. The Analysis page renders this
 * one and the ordinary polygons are not mounted at all; every other
 * page renders PolygonLayer.jsx and this one is not mounted. They own
 * different Mapbox source and layer ids, so they can never collide
 * inside the persistent map instance, and each cleans up after itself
 * on unmount.
 *
 * The colours are not chosen here. Each analysis algorithm under
 * src/analysis/neighbourhood/ ranks the zones and stamps every row with
 * the borderColor/fillColor it earned from ANALYSIS_COLORS
 * (NeighbourhoodsRuntime.jsx) - most/average/least, plus a grey
 * fallback for a zone missing the fields the algorithm needs. That is
 * the same object the legend renders from, so the map and the legend
 * cannot drift apart.
 */

const SOURCE_ID = "mapdex-analysis-polygons";
const FILL_LAYER_ID = "mapdex-analysis-polygons-fill-layer";
const BORDER_LAYER_ID = "mapdex-analysis-polygons-border-layer";

/*
 * Only used for a zone the result has no entry for at all. The
 * algorithms already stamp their own grey fallback onto zones they
 * could not score, so reaching these means the row is missing entirely
 * rather than unscored.
 */
const DEFAULT_BORDER_COLOR = "#4b5563";
const DEFAULT_FILL_COLOR = "#6f747e";

function isFiniteCoordinatePair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return false;

  return Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]));
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

/*
 * analysisResult.byId is a Map keyed by the raw _id the algorithm saw.
 * Data item ids arrive as ObjectId-ish values in some paths and strings
 * in others, so the lookup tries the id as given first and falls back
 * to its string form rather than assuming either.
 */
function lookupAnalysisRow(byId, dataItemId) {
  if (!(byId instanceof Map)) return null;

  if (byId.has(dataItemId)) return byId.get(dataItemId);

  const asString = String(dataItemId);

  if (byId.has(asString)) return byId.get(asString);

  return null;
}

function buildFeatureCollection(data, selectedDataItem, analysisResult) {
  const selectedId =
    selectedDataItem?._id != null ? String(selectedDataItem._id) : null;

  const byId = analysisResult?.byId;
  const features = [];

  for (const dataItem of data || []) {
    const geometry = dataItem?.geometry;

    if (!isValidPolygon(geometry)) continue;

    const rawId = dataItem?._id;
    const dataItemId = rawId != null ? String(rawId) : "";
    const isSelected = selectedId !== null && selectedId === dataItemId;

    const row = lookupAnalysisRow(byId, rawId);

    features.push({
      type: "Feature",

      properties: {
        mapdexId: dataItemId,
        selected: isSelected,
        fillColor: row?.fillColor || DEFAULT_FILL_COLOR,
        borderColor: row?.borderColor || DEFAULT_BORDER_COLOR,
      },

      geometry: {
        type: "Polygon",
        coordinates: geometry.coordinates,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

function addAnalysisPolygonLayers(mapboxMap, featureCollection) {
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

        /*
         * Deliberately more opaque than PolygonLayer.jsx's own 0.14.
         * There the fill is incidental - the zone is a place you click,
         * and the basemap underneath matters. Here the fill IS the
         * result: the whole page exists to read rank off colour against
         * the legend, and at 0.14 the three classes are nearly
         * indistinguishable from each other and from the map beneath.
         */
        "fill-opacity": ["case", ["get", "selected"], 0.85, 0.6],
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
        "line-width": ["case", ["get", "selected"], 3, 1.5],
        "line-opacity": ["case", ["get", "selected"], 1, 0.8],
      },
    });
  }
}

/*
 * Reverses addAnalysisPolygonLayers: layers before the source they
 * reference, or Mapbox throws. Called on unmount - which here means
 * leaving the Analysis page, not just changing engine - so the
 * persistent map instance never keeps a stale choropleth under the
 * ordinary polygons.
 */
function removeAnalysisPolygonLayers(mapboxMap) {
  if (mapboxMap.getLayer(BORDER_LAYER_ID)) {
    mapboxMap.removeLayer(BORDER_LAYER_ID);
  }

  if (mapboxMap.getLayer(FILL_LAYER_ID)) {
    mapboxMap.removeLayer(FILL_LAYER_ID);
  }

  if (mapboxMap.getSource(SOURCE_ID)) {
    mapboxMap.removeSource(SOURCE_ID);
  }
}

export default function MapboxAnalysisPolygonLayer({
  mapboxMap,
  data,
  selectedDataItem,
  setSelectedDataItem,
  dataUtils,
  schema,
  analysisResult,
}) {
  const dataRef = useRef(data || []);
  const selectedIdRef = useRef(null);
  const featureCollectionRef = useRef(null);

  const featureCollection = useMemo(
    () => buildFeatureCollection(data, selectedDataItem, analysisResult),
    [data, selectedDataItem?._id, analysisResult],
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
   * Added once per map instance and again on every style reload -
   * setStyle() does not preserve runtime-added sources/layers. Driven
   * by the map's own "style.load" event rather than React state, the
   * same pattern every other Mapbox layer in this codebase uses.
   */
  useEffect(() => {
    if (!mapboxMap) return;

    const applyLayers = () => {
      addAnalysisPolygonLayers(mapboxMap, featureCollectionRef.current);
    };

    applyLayers();
    mapboxMap.on("style.load", applyLayers);

    return () => {
      mapboxMap.off("style.load", applyLayers);
      removeAnalysisPolygonLayers(mapboxMap);
    };
  }, [mapboxMap]);

  /*
   * Re-running the algorithm, changing its inputs or changing the
   * selection all land here - the source is updated in place rather
   * than the layers being rebuilt.
   */
  useEffect(() => {
    if (!mapboxMap) return;

    const source = mapboxMap.getSource(SOURCE_ID);
    if (!source) return;

    source.setData(featureCollection);
  }, [mapboxMap, featureCollection]);

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
