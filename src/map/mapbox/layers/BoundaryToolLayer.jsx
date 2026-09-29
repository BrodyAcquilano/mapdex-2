// src/map/mapbox/layers/BoundaryToolLayer.jsx

import { useEffect, useRef } from "react";
import * as mapboxgl from "mapbox-gl/esm";

import { useDrawController } from "../controllers/useDrawController.js";
import { createVertexMarkerElement } from "../icons/createVertexMarkerElement.js";
import {
  movePolygonVertex,
  moveMultiVertex,
  isMultiPolygonMoveValid,
  canFinishDraftGeometry,
  canCommitCurrentDraftPart,
  getGeometryHandlePosition,
  translateGeometryByDelta,
} from "../../utils/draftGeometry.js";
import { DEFAULT_BOUNDARY_COLORS } from "../../../boundaries/utils/boundaryConstants.js";

const FILL_SOURCE_ID = "mapdex-boundary-tool-fill";
const FILL_LAYER_ID = "mapdex-boundary-tool-fill-layer";
const BORDER_SOURCE_ID = "mapdex-boundary-tool-border";
const BORDER_LAYER_ID = "mapdex-boundary-tool-border-layer";
const CLOSING_SOURCE_ID = "mapdex-boundary-tool-closing";
const CLOSING_LAYER_ID = "mapdex-boundary-tool-closing-layer";

const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] };

function coordinatesEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];
}

function getOpenRing(ring) {
  if (!Array.isArray(ring) || ring.length === 0) return [];
  if (ring.length >= 2 && coordinatesEqual(ring[0], ring[ring.length - 1])) {
    return ring.slice(0, -1);
  }
  return ring;
}

function toRoundedCoordinate(lngLat) {
  const lat = Number(lngLat?.lat);
  const lng = Number(lngLat?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

/*
 * Every ring in `geometry`, tagged with its own partIndex - null for a
 * plain Polygon, a real index for a MultiPolygon's own parts. Mirrors
 * ../../leaflet/layers/BoundaryToolLayer.jsx's own getRings.
 */
function getRings(geometry) {
  if (geometry?.type === "Polygon") {
    return [{ partIndex: null, ring: getOpenRing(geometry.coordinates?.[0]) }];
  }

  if (geometry?.type === "MultiPolygon") {
    return (Array.isArray(geometry.coordinates) ? geometry.coordinates : []).map(
      (part, partIndex) => ({ partIndex, ring: getOpenRing(part?.[0]) }),
    );
  }

  return [];
}

function lineFeature(coordinates, properties) {
  return { type: "Feature", properties, geometry: { type: "LineString", coordinates } };
}

function polygonFeature(ring, properties) {
  return {
    type: "Feature",
    properties,
    geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] },
  };
}

/*
 * Splits `geometry`'s own rings into "committed" (already-closed parts,
 * rendered solid) and "current" (the one still being clicked into,
 * rendered as an open border + translucent fill preview + a dashed
 * closing-preview edge) - mirrors DrawLayer.jsx's own
 * multiPolygonCommittedRings/currentMultiPolygonVertices split exactly,
 * and (see ../../leaflet/layers/BoundaryToolLayer.jsx's own
 * BoundaryPreview) the same split this app's Leaflet renderer uses.
 * isActivelyDrawing false (Move Vertex/Move Boundary, or the draw
 * workflow's own "reviewing before save" phase once Finish has been
 * clicked) treats every ring as committed, with no current/open one.
 */
function splitRings(geometry, isActivelyDrawing) {
  const rings = getRings(geometry).map(({ ring }) => ring);

  if (!isActivelyDrawing) {
    return { committedRings: rings, currentRing: [] };
  }

  return { committedRings: rings.slice(0, -1), currentRing: rings[rings.length - 1] || [] };
}

function buildBorderFeatureCollection(committedRings, currentRing, borderColor) {
  const features = committedRings
    .filter((ring) => ring.length >= 3)
    .map((ring) => lineFeature([...ring, ring[0]], { borderColor }));

  if (currentRing.length >= 2) {
    features.push(lineFeature(currentRing, { borderColor }));
  }

  return { type: "FeatureCollection", features };
}

function buildFillFeatureCollection(committedRings, currentRing, fillColor) {
  const features = committedRings
    .filter((ring) => ring.length >= 3)
    .map((ring) => polygonFeature(ring, { fillColor }));

  if (currentRing.length >= 3) {
    features.push(polygonFeature(currentRing, { fillColor }));
  }

  return { type: "FeatureCollection", features };
}

function buildClosingFeatureCollection(currentRing, isActivelyDrawing, geometry, borderColor) {
  if (!isActivelyDrawing || currentRing.length < 3) return EMPTY_COLLECTION;

  const opacity = canCommitCurrentDraftPart(geometry) ? 0.65 : 0.35;

  return {
    type: "FeatureCollection",
    features: [
      lineFeature([currentRing[currentRing.length - 1], currentRing[0]], { borderColor, opacity }),
    ],
  };
}

function addPreviewLayers(mapboxMap) {
  if (!mapboxMap.getSource(FILL_SOURCE_ID)) {
    mapboxMap.addSource(FILL_SOURCE_ID, { type: "geojson", data: EMPTY_COLLECTION });
  }

  if (!mapboxMap.getLayer(FILL_LAYER_ID)) {
    mapboxMap.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: FILL_SOURCE_ID,
      slot: "top",
      paint: { "fill-color": ["get", "fillColor"], "fill-opacity": 0.2 },
    });
  }

  if (!mapboxMap.getSource(BORDER_SOURCE_ID)) {
    mapboxMap.addSource(BORDER_SOURCE_ID, { type: "geojson", data: EMPTY_COLLECTION });
  }

  if (!mapboxMap.getLayer(BORDER_LAYER_ID)) {
    mapboxMap.addLayer({
      id: BORDER_LAYER_ID,
      type: "line",
      source: BORDER_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "borderColor"], "line-width": 3, "line-opacity": 0.8 },
    });
  }

  if (!mapboxMap.getSource(CLOSING_SOURCE_ID)) {
    mapboxMap.addSource(CLOSING_SOURCE_ID, { type: "geojson", data: EMPTY_COLLECTION });
  }

  if (!mapboxMap.getLayer(CLOSING_LAYER_ID)) {
    mapboxMap.addLayer({
      id: CLOSING_LAYER_ID,
      type: "line",
      source: CLOSING_SOURCE_ID,
      slot: "top",
      paint: {
        "line-color": ["get", "borderColor"],
        "line-width": 3,
        "line-opacity": ["get", "opacity"],
        "line-dasharray": [2, 2],
      },
    });
  }
}

function removePreviewLayers(mapboxMap) {
  if (mapboxMap.getLayer(CLOSING_LAYER_ID)) mapboxMap.removeLayer(CLOSING_LAYER_ID);
  if (mapboxMap.getSource(CLOSING_SOURCE_ID)) mapboxMap.removeSource(CLOSING_SOURCE_ID);
  if (mapboxMap.getLayer(BORDER_LAYER_ID)) mapboxMap.removeLayer(BORDER_LAYER_ID);
  if (mapboxMap.getSource(BORDER_SOURCE_ID)) mapboxMap.removeSource(BORDER_SOURCE_ID);
  if (mapboxMap.getLayer(FILL_LAYER_ID)) mapboxMap.removeLayer(FILL_LAYER_ID);
  if (mapboxMap.getSource(FILL_SOURCE_ID)) mapboxMap.removeSource(FILL_SOURCE_ID);
}

/*
 * Mapbox counterpart to ../../leaflet/layers/BoundaryToolLayer.jsx -
 * see that file's own top comment. Reuses useDrawController unmodified
 * for the draw tool's own click-to-place-vertex behavior, the same
 * shared createVertexMarkerElement every place/event draw/edit tool
 * already uses for its own vertex dots (so a boundary being drawn or
 * edited looks identical to them), and manages its own imperative
 * mapboxgl.Marker instances for the two edit tools' draggable vertex/
 * centroid handles - simplified relative to DrawLayer.jsx since a
 * boundary is always Polygon/MultiPolygon only, never the other 4
 * geometry types that file also has to handle. `draftColors` is a
 * SEPARATE runtime slot from draftGeometry itself (see
 * PlacesRuntime.jsx's own comment on draftBoundaryColors) - a
 * boundary's stored geometry never carries color fields at all, so
 * this preview's own color can't live on draftGeometry the way it
 * briefly did (that corrupted the geometry enough to fail validation
 * at save time). Live-editing a color in AggregateEditPanel's own Add
 * Boundary form writes straight into this same draftColors slot (see
 * its own onBoundaryColorsPreview prop), repainting the map
 * immediately, before Add Boundary is ever clicked.
 */
export default function BoundaryToolLayer({
  mapboxMap,
  geometryTool,
  isDrawing,
  draftGeometry,
  setDraftGeometry,
  draftColors,
  system,
}) {
  useDrawController({
    mapboxMap,
    geometryTool,
    isDrawing,
    draftGeometry,
    setDraftGeometry,
    setGeometryEditHistory: () => {},
    setRejectedSegment: () => {},
    drawDraft: () => {},
    system,
  });

  const vertexMarkersRef = useRef(new Map());
  const drawVertexMarkersRef = useRef([]);
  const handleMarkerRef = useRef(null);
  const dragStartRef = useRef(null);

  const isActivelyDrawing = isDrawing && geometryTool === "multipolygon";
  const borderColor = draftColors?.borderColor ?? DEFAULT_BOUNDARY_COLORS.borderColor;
  const fillColor = draftColors?.fillColor ?? DEFAULT_BOUNDARY_COLORS.fillColor;

  // Preview fill/border/closing sources.
  useEffect(() => {
    if (!mapboxMap) return undefined;

    const applyLayers = () => addPreviewLayers(mapboxMap);
    applyLayers();
    mapboxMap.on("style.load", applyLayers);

    return () => {
      mapboxMap.off("style.load", applyLayers);
      removePreviewLayers(mapboxMap);
    };
  }, [mapboxMap]);

  useEffect(() => {
    if (!mapboxMap) return;

    const { committedRings, currentRing } = splitRings(draftGeometry, isActivelyDrawing);

    mapboxMap
      .getSource(FILL_SOURCE_ID)
      ?.setData(buildFillFeatureCollection(committedRings, currentRing, fillColor));

    mapboxMap
      .getSource(BORDER_SOURCE_ID)
      ?.setData(buildBorderFeatureCollection(committedRings, currentRing, borderColor));

    mapboxMap
      .getSource(CLOSING_SOURCE_ID)
      ?.setData(
        buildClosingFeatureCollection(currentRing, isActivelyDrawing, draftGeometry, borderColor),
      );
  }, [mapboxMap, draftGeometry, isActivelyDrawing, borderColor, fillColor]);

  /*
   * Plain, non-draggable vertex dots for the current part still being
   * actively drawn - same createVertexMarkerElement "white dot" every
   * other draft vertex in this app uses. Mirrors DrawLayer.jsx's own
   * equivalent effect for its MultiPolygon draw tool.
   */
  useEffect(() => {
    for (const marker of drawVertexMarkersRef.current) marker.remove();
    drawVertexMarkersRef.current = [];

    if (!mapboxMap || !isActivelyDrawing) return undefined;

    const { currentRing } = splitRings(draftGeometry, isActivelyDrawing);
    if (currentRing.length === 0) return undefined;

    const nextMarkers = currentRing.map((coordinate) =>
      new mapboxgl.Marker({ element: createVertexMarkerElement(), draggable: false, anchor: "center" })
        .setLngLat(coordinate)
        .addTo(mapboxMap),
    );

    drawVertexMarkersRef.current = nextMarkers;

    return () => {
      for (const marker of nextMarkers) marker.remove();
    };
  }, [mapboxMap, isActivelyDrawing, draftGeometry]);

  /*
   * Move Vertex - one mapboxgl.Marker per ring vertex. Rebuilt whenever
   * the geometry's own STRUCTURE changes (which rings exist, and how
   * many vertices each has) rather than on every coordinate update, so
   * an in-progress drag's own per-frame position updates (via
   * marker.setLngLat, not a marker recreation) stay smooth - the same
   * "structural change vs. live position" split DrawLayer.jsx's own
   * comments describe for its own vertex markers.
   */
  useEffect(() => {
    if (!mapboxMap || geometryTool !== "move") {
      vertexMarkersRef.current.forEach((marker) => marker.remove());
      vertexMarkersRef.current.clear();
      return undefined;
    }

    const rings = getRings(draftGeometry);
    const markers = vertexMarkersRef.current;
    const nextKeys = new Set();

    function applyMove(geometry, partIndex, vertexIndex, coordinate) {
      if (partIndex === null) return movePolygonVertex(geometry, vertexIndex, coordinate);
      return moveMultiVertex(geometry, { partIndex, vertexIndex }, coordinate);
    }

    function isValidMove(nextGeometry, partIndex, vertexIndex) {
      if (!nextGeometry) return false;
      if (partIndex === null) return canFinishDraftGeometry(nextGeometry, true);
      return isMultiPolygonMoveValid(nextGeometry, { partIndex, vertexIndex });
    }

    rings.forEach(({ partIndex, ring }) => {
      ring.forEach((coordinate, vertexIndex) => {
        const key = `${partIndex ?? "single"}-${vertexIndex}`;
        nextKeys.add(key);

        if (markers.has(key)) {
          markers.get(key).setLngLat(coordinate);
          return;
        }

        const marker = new mapboxgl.Marker({
          element: createVertexMarkerElement({ isMoving: true }),
          draggable: true,
          anchor: "center",
        })
          .setLngLat(coordinate)
          .addTo(mapboxMap);

        marker.on("dragstart", () => {
          dragStartRef.current = toRoundedCoordinate(marker.getLngLat());
        });

        marker.on("drag", () => {
          const nextCoordinate = toRoundedCoordinate(marker.getLngLat());
          if (!nextCoordinate) return;

          setDraftGeometry(
            (current) => applyMove(current, partIndex, vertexIndex, nextCoordinate) || current,
          );
        });

        marker.on("dragend", () => {
          const nextCoordinate = toRoundedCoordinate(marker.getLngLat());
          const originalCoordinate = dragStartRef.current;
          if (!nextCoordinate) return;

          let reverted = false;

          setDraftGeometry((current) => {
            const next = applyMove(current, partIndex, vertexIndex, nextCoordinate);

            if (!isValidMove(next, partIndex, vertexIndex)) {
              reverted = true;
              if (!originalCoordinate) return current;
              return applyMove(current, partIndex, vertexIndex, originalCoordinate) || current;
            }

            return next;
          });

          if (reverted) {
            if (originalCoordinate) marker.setLngLat(originalCoordinate);
            system?.notify?.("That move would create invalid geometry.");
          }
        });

        markers.set(key, marker);
      });
    });

    markers.forEach((marker, key) => {
      if (!nextKeys.has(key)) {
        marker.remove();
        markers.delete(key);
      }
    });

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxMap, geometryTool, draftGeometry]);

  /*
   * Move Boundary - a single mapboxgl.Marker at the geometry's own
   * centroid, translating every coordinate by the drag's own per-frame
   * delta (translateGeometryByDelta) - mirrors
   * ../../leaflet/layers/BoundaryToolLayer.jsx's own BoundaryMoveHandle,
   * and DrawLayer.jsx's own "Move Geometry" tool, which uses this exact
   * same moving vertex marker element for its own handle too, not a
   * distinct one.
   */
  useEffect(() => {
    if (!mapboxMap || geometryTool !== "moveGeometry") {
      handleMarkerRef.current?.remove();
      handleMarkerRef.current = null;
      return undefined;
    }

    const handlePosition = getGeometryHandlePosition(draftGeometry);
    if (!handlePosition) return undefined;

    if (handleMarkerRef.current) {
      handleMarkerRef.current.setLngLat([handlePosition.lng, handlePosition.lat]);
      return undefined;
    }

    const lastPositionRef = { current: null };

    const marker = new mapboxgl.Marker({
      element: createVertexMarkerElement({ isMoving: true }),
      draggable: true,
      anchor: "center",
    })
      .setLngLat([handlePosition.lng, handlePosition.lat])
      .addTo(mapboxMap);

    marker.on("dragstart", () => {
      const lngLat = marker.getLngLat();
      lastPositionRef.current = { lng: lngLat.lng, lat: lngLat.lat };
    });

    marker.on("drag", () => {
      const lngLat = marker.getLngLat();
      const last = lastPositionRef.current;
      if (!last) return;

      const dLng = lngLat.lng - last.lng;
      const dLat = lngLat.lat - last.lat;
      lastPositionRef.current = { lng: lngLat.lng, lat: lngLat.lat };

      setDraftGeometry((current) => translateGeometryByDelta(current, dLng, dLat) || current);
    });

    handleMarkerRef.current = marker;

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxMap, geometryTool, draftGeometry]);

  // Cleanup on unmount.
  useEffect(() => {
    const vertexMarkers = vertexMarkersRef.current;
    const drawVertexMarkers = drawVertexMarkersRef.current;

    return () => {
      vertexMarkers.forEach((marker) => marker.remove());
      vertexMarkers.clear();
      for (const marker of drawVertexMarkers) marker.remove();
      handleMarkerRef.current?.remove();
      handleMarkerRef.current = null;
    };
  }, []);

  return null;
}
