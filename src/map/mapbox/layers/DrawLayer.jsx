// src/map/mapbox/layers/DrawLayer.jsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as mapboxgl from "mapbox-gl/esm";

import { useDrawController } from "../controllers/useDrawController.js";
import {
  canFinishDraftGeometry,
  canCommitCurrentDraftPart,
  removeVertexAtIndex,
  areVertexIndicesAdjacent,
  insertMidpointBetweenIndices,
  moveMultiVertex,
  isMultiPolygonMoveValid,
  canRemoveMultiVertex,
  removeMultiVertexAt,
  areMultiVertexIndicesAdjacent,
  insertMultiMidpointBetweenIndices,
  canRemoveSubgeometry,
  removeSubgeometryAt,
  getGeometryHandlePosition,
  translateGeometryByDelta,
} from "../../utils/draftGeometry.js";
import { isSingleCollapseAllowed } from "../../../../shared/validation/geometryTypeRules.js";

import {
  createPointMarkerElement,
  DEFAULT_POINT_FILL_COLOR,
  DEFAULT_POINT_BORDER_COLOR,
} from "../icons/createPointMarkerElement.js";

import { createVertexMarkerElement } from "../icons/createVertexMarkerElement.js";

const DEFAULT_LINE_COLOR = "#3388ff";
const DEFAULT_BORDER_COLOR = "#2563eb";
const DEFAULT_FILL_COLOR = "#3b82f6";

const LINE_SOURCE_ID = "mapdex-draft-line";
const LINE_LAYER_ID = "mapdex-draft-line-layer";

const POLYGON_BORDER_SOURCE_ID = "mapdex-draft-polygon-border";
const POLYGON_BORDER_LAYER_ID = "mapdex-draft-polygon-border-layer";

const POLYGON_FILL_SOURCE_ID = "mapdex-draft-polygon-fill";
const POLYGON_FILL_LAYER_ID = "mapdex-draft-polygon-fill-layer";

const CLOSING_SOURCE_ID = "mapdex-draft-closing";
const CLOSING_LAYER_ID = "mapdex-draft-closing-layer";

const REJECTED_SOURCE_ID = "mapdex-draft-rejected";
const REJECTED_LAYER_ID = "mapdex-draft-rejected-layer";

/*
 * MultiPoint has no draggable-vertex concept yet (edit tools for the
 * multi- types are still a follow-up), so unlike the plain Point
 * draft (a draggable mapboxgl.Marker, see below) its own placed
 * points are previewed as a static GeoJSON circle layer instead -
 * the same "circle" layer type GeometryLayer.jsx's own POINT_LAYER_ID
 * already uses for finished Point/MultiPoint items.
 */
const MULTIPOINT_SOURCE_ID = "mapdex-draft-multipoint";
const MULTIPOINT_LAYER_ID = "mapdex-draft-multipoint-layer";

function emptyCollection() {
  return { type: "FeatureCollection", features: [] };
}

function lineFeatureCollection(coordinates, properties = {}) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return emptyCollection();
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties,
        geometry: { type: "LineString", coordinates },
      },
    ],
  };
}

function polygonFeatureCollection(ring, properties = {}) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return emptyCollection();
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties,
        geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] },
      },
    ],
  };
}

/*
 * One LineString Feature per part - used to preview a MultiLineString
 * draft's own several (committed and/or current) lines in the same
 * LINE_SOURCE_ID a plain LineString draft's single feature uses.
 */
/*
 * partIndex is tagged onto every feature's own properties (from its
 * position in coordinateGroups, computed BEFORE the filter below, so
 * a filtered-out part never shifts a later one's own index) - the
 * "remove sub-geometry" tool's own click handler reads it back off
 * the clicked feature to know which part of the MultiLineString/
 * MultiPolygon to remove.
 */
function multiLineFeatureCollection(coordinateGroups, properties = {}) {
  const features = (coordinateGroups || [])
    .map((coordinates, partIndex) => ({ coordinates, partIndex }))
    .filter(({ coordinates }) => Array.isArray(coordinates) && coordinates.length >= 2)
    .map(({ coordinates, partIndex }) => ({
      type: "Feature",
      properties: { ...properties, partIndex },
      geometry: { type: "LineString", coordinates },
    }));

  return { type: "FeatureCollection", features };
}

/*
 * One (closed) Polygon Feature per ring - used to preview a
 * MultiPolygon draft's own several committed polygons in the same
 * POLYGON_BORDER_SOURCE_ID/POLYGON_FILL_SOURCE_ID a plain Polygon
 * draft's single feature uses.
 */
function multiPolygonFeatureCollection(rings, properties = {}) {
  const features = (rings || [])
    .map((ring, partIndex) => ({ ring, partIndex }))
    .filter(({ ring }) => Array.isArray(ring) && ring.length >= 3)
    .map(({ ring, partIndex }) => ({
      type: "Feature",
      properties: { ...properties, partIndex },
      geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] },
    }));

  return { type: "FeatureCollection", features };
}

/*
 * One Point Feature per placed vertex - used to preview a MultiPoint
 * draft's own several points via MULTIPOINT_LAYER_ID.
 */
function multiPointFeatureCollection(coordinates, properties = {}) {
  const features = (coordinates || [])
    .filter(isFiniteCoordinatePair)
    .map((coordinate) => ({
      type: "Feature",
      properties,
      geometry: { type: "Point", coordinates: coordinate },
    }));

  return { type: "FeatureCollection", features };
}

function isFiniteCoordinatePair(pair) {
  return (
    Array.isArray(pair) &&
    pair.length >= 2 &&
    Number.isFinite(Number(pair[0])) &&
    Number.isFinite(Number(pair[1]))
  );
}

function coordinatesEqual(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a[0] === b[0] &&
    a[1] === b[1]
  );
}

function getOpenRing(ring) {
  if (!Array.isArray(ring)) return [];

  if (ring.length >= 2 && coordinatesEqual(ring[0], ring[ring.length - 1])) {
    return ring.slice(0, -1);
  }

  return ring;
}

/*
 * The vertices a draft geometry is currently made of, as [lng, lat]
 * pairs - no coordinate flipping needed here the way Leaflet's
 * equivalent needs, since Mapdex already stores geometry as [lng, lat]
 * and Mapbox expects the same order.
 */
function getDraftVertices(draftGeometry) {
  if (!draftGeometry) return [];

  if (draftGeometry.type === "Point") {
    return isFiniteCoordinatePair(draftGeometry.coordinates)
      ? [draftGeometry.coordinates]
      : [];
  }

  if (draftGeometry.type === "LineString") {
    return Array.isArray(draftGeometry.coordinates)
      ? draftGeometry.coordinates.filter(isFiniteCoordinatePair)
      : [];
  }

  if (draftGeometry.type === "Polygon") {
    const ring = Array.isArray(draftGeometry.coordinates?.[0])
      ? draftGeometry.coordinates[0]
      : [];

    return getOpenRing(ring).filter(isFiniteCoordinatePair);
  }

  return [];
}

/*
 * Applies a dragged vertex's new coordinate to a draft geometry. Pure
 * geometry math, no map-library dependency - identical to Leaflet's
 * moveDraftVertex in src/map/leaflet/layers/DrawLayer.jsx.
 */
function moveDraftVertex(geometry, vertexIndex, coordinate) {
  if (!geometry || !Array.isArray(coordinate)) return null;

  if (geometry.type === "LineString") {
    const coordinates = structuredClone(geometry.coordinates);

    if (
      !Array.isArray(coordinates) ||
      vertexIndex < 0 ||
      vertexIndex >= coordinates.length
    ) {
      return null;
    }

    coordinates[vertexIndex] = structuredClone(coordinate);

    return { ...structuredClone(geometry), coordinates };
  }

  if (geometry.type === "Polygon") {
    const rawRing = geometry.coordinates?.[0];

    if (!Array.isArray(rawRing)) return null;

    const openRing =
      rawRing.length >= 2 &&
      coordinatesEqual(rawRing[0], rawRing[rawRing.length - 1])
        ? structuredClone(rawRing.slice(0, -1))
        : structuredClone(rawRing);

    if (vertexIndex < 0 || vertexIndex >= openRing.length) return null;

    openRing[vertexIndex] = structuredClone(coordinate);

    if (openRing.length === 0) return null;

    return {
      ...structuredClone(geometry),
      coordinates: [[...openRing, structuredClone(openRing[0])]],
      // No longer valid after a vertex move.
      bbox: null,
      centroid: null,
    };
  }

  return null;
}

function addDraftLayers(mapboxMap) {
  if (!mapboxMap.getSource(LINE_SOURCE_ID)) {
    mapboxMap.addSource(LINE_SOURCE_ID, {
      type: "geojson",
      data: emptyCollection(),
    });

    mapboxMap.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: LINE_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "lineColor"],
        "line-width": 5,
        "line-opacity": 0.8,
      },
    });
  }

  if (!mapboxMap.getSource(POLYGON_BORDER_SOURCE_ID)) {
    mapboxMap.addSource(POLYGON_BORDER_SOURCE_ID, {
      type: "geojson",
      data: emptyCollection(),
    });

    mapboxMap.addLayer({
      id: POLYGON_BORDER_LAYER_ID,
      type: "line",
      source: POLYGON_BORDER_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "borderColor"],
        "line-width": 3,
        "line-opacity": 0.8,
      },
    });
  }

  if (!mapboxMap.getSource(POLYGON_FILL_SOURCE_ID)) {
    mapboxMap.addSource(POLYGON_FILL_SOURCE_ID, {
      type: "geojson",
      data: emptyCollection(),
    });

    mapboxMap.addLayer({
      id: POLYGON_FILL_LAYER_ID,
      type: "fill",
      source: POLYGON_FILL_SOURCE_ID,
      slot: "top",
      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": 0.2,
      },
    });
  }

  if (!mapboxMap.getSource(MULTIPOINT_SOURCE_ID)) {
    mapboxMap.addSource(MULTIPOINT_SOURCE_ID, {
      type: "geojson",
      data: emptyCollection(),
    });

    mapboxMap.addLayer({
      id: MULTIPOINT_LAYER_ID,
      type: "circle",
      source: MULTIPOINT_SOURCE_ID,
      slot: "top",
      paint: {
        "circle-radius": 9,
        "circle-color": ["get", "fillColor"],
        "circle-stroke-color": ["get", "borderColor"],
        "circle-stroke-width": 3,
        "circle-opacity": 0.8,
        "circle-stroke-opacity": 0.8,
      },
    });
  }

  if (!mapboxMap.getSource(CLOSING_SOURCE_ID)) {
    mapboxMap.addSource(CLOSING_SOURCE_ID, {
      type: "geojson",
      data: emptyCollection(),
    });

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

  if (!mapboxMap.getSource(REJECTED_SOURCE_ID)) {
    mapboxMap.addSource(REJECTED_SOURCE_ID, {
      type: "geojson",
      data: emptyCollection(),
    });

    mapboxMap.addLayer({
      id: REJECTED_LAYER_ID,
      type: "line",
      source: REJECTED_SOURCE_ID,
      slot: "top",
      paint: {
        "line-color": ["get", "borderColor"],
        "line-width": 4,
        "line-opacity": 0.45,
        "line-dasharray": [2, 2],
      },
    });
  }
}

function setSourceData(mapboxMap, sourceId, data) {
  const source = mapboxMap.getSource(sourceId);
  if (source) source.setData(data);
}

/*
 * Reverses addDraftLayers: layers must be removed before the sources
 * they reference, or Mapbox throws. Called when this component
 * unmounts (e.g. the active engine changes) so a persistent map
 * instance doesn't accumulate a previous engine's sources/layers.
 * Only concerns the static preview GeoJSON layers - the draft
 * Point/vertex mapboxgl.Marker handles clean themselves up via their
 * own effects' cleanup (marker.remove()), independent of this.
 */
function removeDraftLayers(mapboxMap) {
  if (mapboxMap.getLayer(REJECTED_LAYER_ID)) mapboxMap.removeLayer(REJECTED_LAYER_ID);
  if (mapboxMap.getSource(REJECTED_SOURCE_ID)) {
    mapboxMap.removeSource(REJECTED_SOURCE_ID);
  }

  if (mapboxMap.getLayer(CLOSING_LAYER_ID)) mapboxMap.removeLayer(CLOSING_LAYER_ID);
  if (mapboxMap.getSource(CLOSING_SOURCE_ID)) {
    mapboxMap.removeSource(CLOSING_SOURCE_ID);
  }

  if (mapboxMap.getLayer(POLYGON_FILL_LAYER_ID)) {
    mapboxMap.removeLayer(POLYGON_FILL_LAYER_ID);
  }
  if (mapboxMap.getSource(POLYGON_FILL_SOURCE_ID)) {
    mapboxMap.removeSource(POLYGON_FILL_SOURCE_ID);
  }

  if (mapboxMap.getLayer(POLYGON_BORDER_LAYER_ID)) {
    mapboxMap.removeLayer(POLYGON_BORDER_LAYER_ID);
  }
  if (mapboxMap.getSource(POLYGON_BORDER_SOURCE_ID)) {
    mapboxMap.removeSource(POLYGON_BORDER_SOURCE_ID);
  }

  if (mapboxMap.getLayer(LINE_LAYER_ID)) mapboxMap.removeLayer(LINE_LAYER_ID);
  if (mapboxMap.getSource(LINE_SOURCE_ID)) mapboxMap.removeSource(LINE_SOURCE_ID);

  if (mapboxMap.getLayer(MULTIPOINT_LAYER_ID)) {
    mapboxMap.removeLayer(MULTIPOINT_LAYER_ID);
  }
  if (mapboxMap.getSource(MULTIPOINT_SOURCE_ID)) {
    mapboxMap.removeSource(MULTIPOINT_SOURCE_ID);
  }
}

/*
 * Mapbox counterpart to the old Leaflet DrawLayer: renders
 * the in-progress draft geometry (the point/line/polygon being drawn,
 * or an existing geometry being dragged with the move tool) and its
 * draggable vertex handles.
 *
 * The static preview shapes (connecting lines, polygon fill, the
 * dashed "close here" and "rejected segment" hints) are plain GeoJSON
 * layers, matching the pattern already used elsewhere in the mapbox
 * folder. The draft Point and every line/polygon vertex are native
 * mapboxgl.Marker instances instead, since those are the pieces that
 * need to be draggable - Mapbox has no per-feature drag on GeoJSON
 * layers the way Leaflet's draggable <Marker> does, but its own
 * Marker class supports dragging natively, so vertex handles use that
 * instead, mirroring the same "draggable marker per vertex" shape
 * Leaflet's draft layer already uses.
 */
export default function MapboxDrawLayer({
  mapboxMap,
  geometryTool,
  isDrawing,
  isAddPanelOpen,
  draftGeometry,
  setDraftGeometry,
  setGeometryEditHistory,
  drawDraft,
  system,
  selectedDataItem,
  schema,
}) {
  const [rejectedSegment, setRejectedSegment] = useState(null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState(null);

  /*
   * The add-midpoint tool's first-picked vertex, for MultiLineString/
   * MultiPolygon specifically - kept separate from selectedVertexIndex
   * above (a plain number) since a multi- vertex's own identity is a
   * {partIndex, vertexIndex} pair, not directly comparable with ===.
   * Stored as the "partIndex-vertexIndex" string key used throughout
   * this file's own multi-vertex marker effect below, so a plain
   * equality check still works - mirrors Leaflet's own DrawLayer.jsx.
   */
  const [selectedMultiVertexKey, setSelectedMultiVertexKey] = useState(null);

  const pointMarkerRef = useRef(null);
  const vertexMarkersRef = useRef([]);
  const multiVertexMarkersRef = useRef([]);
  const multiEditVertexMarkersRef = useRef([]);
  const geometryHandleMarkerRef = useRef(null);
  const syncDraftSourcesRef = useRef(() => {});

  /*
   * Both the draft Point marker and the "Move Geometry" centroid
   * handle below are created once and left alone across renders
   * (their own effects deliberately exclude live coordinates/centroid
   * from their deps, to avoid tearing down mid-drag) - correct while
   * this engine's own drag is what's driving the change, but wrong
   * when draftGeometry changes for some OTHER reason while this
   * marker just sits there unmounted-in-spirit-but-not-in-fact: both
   * Leaflet's and Mapbox's own content stay mounted the whole session
   * regardless of which engine is currently hidden (see
   * MapShellHost.jsx), so dragging an item's centroid on Leaflet while
   * Mapbox is hidden leaves Mapbox's own already-created marker
   * exactly where it was, stale, even though draftGeometry itself is
   * correct - only becoming visibly wrong once the user switches back
   * to Mapbox. These two refs track whether each marker is presently
   * mid-gesture (set in its own dragstart/dragend below), so the two
   * small sync effects further down know it's safe to reposition the
   * marker to match draftGeometry - never while the user is actively
   * dragging it themselves.
   */
  const isDraggingPointMarkerRef = useRef(false);
  const isDraggingGeometryHandleRef = useRef(false);

  /*
   * Mirrors draftGeometry on every render (not just once) so the
   * geometry-handle marker's drag handlers below - attached once when
   * that marker is created and left attached across every drag
   * gesture for as long as the tool stays selected, to avoid tearing
   * down mid-drag - can read the CURRENT draftGeometry (to snapshot it
   * into geometryEditHistory right as a gesture begins) without
   * closing over a value that goes stale after the marker's first
   * gesture.
   */
  const latestDraftGeometryRef = useRef(draftGeometry);
  latestDraftGeometryRef.current = draftGeometry;

  useDrawController({
    mapboxMap,
    geometryTool,
    isDrawing,
    draftGeometry,
    setDraftGeometry,
    setGeometryEditHistory,
    setRejectedSegment,
    drawDraft,
    system,
  });

  useEffect(() => {
    if (!rejectedSegment) return;

    const timeout = window.setTimeout(() => {
      setRejectedSegment(null);
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [rejectedSegment]);

  useEffect(() => {
    setRejectedSegment(null);
  }, [geometryTool]);

  const isMoving = isDrawing && geometryTool === "move";
  const isMovingGeometry = isDrawing && geometryTool === "moveGeometry";
  const isRemovingPoint = isDrawing && geometryTool === "remove";
  const isAddingMidpoint = isDrawing && geometryTool === "midpoint";
  const isRemovingSubgeometry = isDrawing && geometryTool === "removeSubgeometry";

  /*
   * Any geometry edit tool, as opposed to actively drawing a new shape
   * - mirrors Leaflet's DrawLayer.jsx own isEditingGeometry.
   */
  const isEditingGeometry =
    isMoving || isRemovingPoint || isAddingMidpoint || isRemovingSubgeometry;

  const showDraft = isDrawing || isAddPanelOpen;

  /*
   * The "add midpoint" tool's first-clicked vertex resets whenever the
   * tool or the selected item changes, so a stale selection from a
   * previous session of the tool (or a different item) never lingers.
   */
  useEffect(() => {
    setSelectedVertexIndex(null);
    setSelectedMultiVertexKey(null);
  }, [geometryTool, selectedDataItem?._id]);

  const vertices = useMemo(() => {
    if (!showDraft || !draftGeometry) return [];
    return getDraftVertices(draftGeometry);
  }, [showDraft, draftGeometry]);

  const canClosePolygon =
    isDrawing &&
    geometryTool === "polygon" &&
    canFinishDraftGeometry(draftGeometry);

  const lineColor = draftGeometry?.lineColor ?? DEFAULT_LINE_COLOR;
  const borderColor = draftGeometry?.borderColor ?? DEFAULT_BORDER_COLOR;
  const fillColor = draftGeometry?.fillColor ?? DEFAULT_FILL_COLOR;

  /*
   * Keep the static preview shapes' GeoJSON data in sync. Extracted
   * into a stable callback (rather than living inline in a useEffect)
   * so the "create draft source/layers" effect below can also call it
   * directly right after Mapbox reloads the style - a freshly
   * recreated (empty) source would otherwise sit empty until some
   * other piece of state happened to change.
   */
  const isMultiPoint = showDraft && draftGeometry?.type === "MultiPoint";
  const isMultiLine = showDraft && draftGeometry?.type === "MultiLineString";
  const isMultiPolygon = showDraft && draftGeometry?.type === "MultiPolygon";

  /*
   * Whether the draft is actively being drawn/added into with the
   * multiline/multipolygon tools, or with addSubgeometry once its own
   * draft has been converted to the matching Multi- type (see
   * createAddSubgeometryDraft/useDrawController.js) - as opposed to
   * just being shown read-only (move/remove/midpoint editing an
   * already-saved item, or the finished shape sitting in the add
   * panel). isActivelyDrawingMultiLine only gates the "current part"
   * vertex-dot preview further down (a line's own last part has no
   * closed/open distinction the way a polygon ring does);
   * isActivelyDrawingMultiPolygon gates a whole rendering branch since
   * MultiPolygon's own last ring needs to stay visually "open" until
   * committed.
   */
  const isActivelyDrawingMultiLine =
    isDrawing &&
    (geometryTool === "multiline" ||
      (geometryTool === "addSubgeometry" && isMultiLine));

  const isActivelyDrawingMultiPolygon =
    isDrawing &&
    (geometryTool === "multipolygon" ||
      (geometryTool === "addSubgeometry" && isMultiPolygon));

  const canCloseCurrentMultiPolygonPart =
    isActivelyDrawingMultiPolygon &&
    canCommitCurrentDraftPart(draftGeometry);

  /*
   * Every part of a MultiLineString draft, each filtered down to a
   * flat array of finite [lng, lat] pairs, the same shape `vertices`
   * is for a plain LineString - fed to LINE_SOURCE_ID as several
   * features at once via multiLineFeatureCollection.
   */
  const multiLineParts = useMemo(() => {
    if (!isMultiLine) return [];

    const parts = Array.isArray(draftGeometry.coordinates)
      ? draftGeometry.coordinates
      : [];

    return parts.map((part) =>
      Array.isArray(part) ? part.filter(isFiniteCoordinatePair) : [],
    );
  }, [isMultiLine, draftGeometry]);

  /*
   * Just the current (last) part of a MultiLineString draft - the
   * vertices worth showing plain marker dots for while actively
   * clicking into it, the same way a plain LineString draft's own
   * `vertices` does.
   */
  const currentMultiLineVertices = useMemo(() => {
    if (!isMultiLine) return [];

    return multiLineParts[multiLineParts.length - 1] || [];
  }, [isMultiLine, multiLineParts]);

  const multiPolygonAllRings = useMemo(() => {
    if (!isMultiPolygon) return [];

    const parts = Array.isArray(draftGeometry.coordinates)
      ? draftGeometry.coordinates
      : [];

    return parts.map((part) => {
      const ring = Array.isArray(part?.[0]) ? part[0] : [];
      return getOpenRing(ring).filter(isFiniteCoordinatePair);
    });
  }, [isMultiPolygon, draftGeometry]);

  /*
   * Every already-committed ring, rendered as its own solid closed
   * polygon, the same way multiPolygonCommittedPositions does in
   * Leaflet's own DrawLayer.
   */
  const multiPolygonCommittedRings = useMemo(
    () =>
      isActivelyDrawingMultiPolygon
        ? multiPolygonAllRings.slice(0, -1)
        : multiPolygonAllRings,
    [isActivelyDrawingMultiPolygon, multiPolygonAllRings],
  );

  /*
   * The one ring (if any) still open/being drawn into - the same role
   * `vertices` plays for a plain Polygon draft, reused below for the
   * same border/fill/closing-preview treatment.
   */
  const currentMultiPolygonVertices = useMemo(
    () =>
      isActivelyDrawingMultiPolygon
        ? multiPolygonAllRings[multiPolygonAllRings.length - 1] || []
        : [],
    [isActivelyDrawingMultiPolygon, multiPolygonAllRings],
  );

  /*
   * Every vertex across every part of a MultiLineString/MultiPolygon,
   * each tagged with the {partIndex, vertexIndex} pair
   * draftGeometry.js's own multi-vertex edit functions (moveMultiVertex,
   * removeMultiVertexAt, ...) expect - unlike currentMultiLineVertices/
   * currentMultiPolygonVertices above (only the one part still being
   * clicked into while drawing), this covers the whole already-saved
   * geometry, for the move/remove-point/add-midpoint tools to operate
   * on any of it. Mirrors Leaflet's own DrawLayer.jsx.
   */
  const allMultiLineVertexRefs = useMemo(() => {
    if (!isEditingGeometry || draftGeometry?.type !== "MultiLineString") return [];

    const parts = Array.isArray(draftGeometry.coordinates) ? draftGeometry.coordinates : [];
    const refs = [];

    parts.forEach((part, partIndex) => {
      if (!Array.isArray(part)) return;

      part.forEach((coordinate, vertexIndex) => {
        if (isFiniteCoordinatePair(coordinate)) {
          refs.push({ partIndex, vertexIndex, coordinate });
        }
      });
    });

    return refs;
  }, [isEditingGeometry, draftGeometry]);

  const allMultiPolygonVertexRefs = useMemo(() => {
    if (!isEditingGeometry || draftGeometry?.type !== "MultiPolygon") return [];

    const parts = Array.isArray(draftGeometry.coordinates) ? draftGeometry.coordinates : [];
    const refs = [];

    parts.forEach((part, partIndex) => {
      const ring = getOpenRing(Array.isArray(part?.[0]) ? part[0] : []);

      ring.forEach((coordinate, vertexIndex) => {
        if (isFiniteCoordinatePair(coordinate)) {
          refs.push({ partIndex, vertexIndex, coordinate });
        }
      });
    });

    return refs;
  }, [isEditingGeometry, draftGeometry]);

  const syncDraftSources = useCallback(() => {
    if (!mapboxMap) return;

    const isLine = showDraft && draftGeometry?.type === "LineString";
    const isPolygon = showDraft && draftGeometry?.type === "Polygon";

    setSourceData(
      mapboxMap,
      LINE_SOURCE_ID,
      isLine && vertices.length >= 2
        ? lineFeatureCollection(vertices, { lineColor })
        : isMultiLine
          ? multiLineFeatureCollection(multiLineParts, { lineColor })
          : emptyCollection(),
    );

    setSourceData(
      mapboxMap,
      MULTIPOINT_SOURCE_ID,
      isMultiPoint
        ? multiPointFeatureCollection(draftGeometry?.coordinates, {
            fillColor,
            borderColor,
          })
        : emptyCollection(),
    );

    /*
     * The border should be one continuous solid ring, including the
     * last-to-first segment, whenever the polygon it's previewing is
     * already a finished shape rather than one still being actively
     * drawn - both while move-tool-editing an existing polygon, and
     * while the add panel is open showing the polygon draft that was
     * just finished (isDrawing is false there, but showDraft stays
     * true). This matches how Leaflet's equivalent renders it as a
     * genuine closed <Polygon> in both of those cases
     * (src/map/leaflet/layers/DrawLayer.jsx). Only while still
     * actively drawing does the border stay open, since the dashed
     * "closing" segment below previews that last edge separately,
     * as it hasn't been confirmed yet.
     */
    const isActivelyDrawingPolygon = isDrawing && geometryTool === "polygon";

    const borderVertices =
      isPolygon && !isActivelyDrawingPolygon && vertices.length >= 3
        ? [...vertices, vertices[0]]
        : vertices;

    /*
     * MultiPolygon's own border: every already-committed ring, closed
     * (first point repeated at the end, same as borderVertices' own
     * closed-ring treatment above), plus the current open ring (if
     * any) - each as its own separate line feature via
     * multiLineFeatureCollection, since Mapbox has no native
     * "multi-linestring with some rings closed and one open" shape.
     */
    const multiPolygonBorderGroups = isMultiPolygon
      ? [
          ...multiPolygonCommittedRings
            .filter((ring) => ring.length >= 3)
            .map((ring) => [...ring, ring[0]]),
          ...(currentMultiPolygonVertices.length >= 2
            ? [currentMultiPolygonVertices]
            : []),
        ]
      : [];

    setSourceData(
      mapboxMap,
      POLYGON_BORDER_SOURCE_ID,
      isPolygon && borderVertices.length >= 2
        ? lineFeatureCollection(borderVertices, { borderColor })
        : isMultiPolygon && multiPolygonBorderGroups.length > 0
          ? multiLineFeatureCollection(multiPolygonBorderGroups, { borderColor })
          : emptyCollection(),
    );

    /*
     * Same idea for the fill - every committed ring plus, while still
     * actively drawing, a live preview fill for the current ring too
     * (matching a plain Polygon's own vertices.length >= 3 preview).
     */
    const multiPolygonFillRings = isMultiPolygon
      ? [
          ...multiPolygonCommittedRings,
          ...(currentMultiPolygonVertices.length >= 3
            ? [currentMultiPolygonVertices]
            : []),
        ]
      : [];

    setSourceData(
      mapboxMap,
      POLYGON_FILL_SOURCE_ID,
      isPolygon && vertices.length >= 3
        ? polygonFeatureCollection(vertices, { fillColor })
        : isMultiPolygon && multiPolygonFillRings.length > 0
          ? multiPolygonFeatureCollection(multiPolygonFillRings, { fillColor })
          : emptyCollection(),
    );

    const lastVertex = vertices[vertices.length - 1];
    const firstVertex = vertices[0];

    /*
     * geometryTool === "polygon" (not just isDrawing, which is also
     * true for the move tool) matters here: this dashed segment
     * previews where drawing would close the ring, so it must not
     * show while move-tool-editing an already-closed polygon, which
     * has no "projected" closing edge left to draw. Leaflet's
     * equivalent (canClosePolygon/projectedClosingPositions in
     * DrawLayer.jsx) already checks this.
     */
    const showClosing =
      isDrawing &&
      geometryTool === "polygon" &&
      isPolygon &&
      vertices.length >= 3 &&
      lastVertex &&
      firstVertex;

    const multiPolygonLastVertex =
      currentMultiPolygonVertices[currentMultiPolygonVertices.length - 1];
    const multiPolygonFirstVertex = currentMultiPolygonVertices[0];

    /*
     * Same idea as showClosing above, for the current ring of a
     * MultiPolygon draft - closing it only commits that one part (see
     * EndPartDrawingButton.jsx/commitCurrentDraftPart), not the whole
     * draft, but the dashed preview itself works the same way.
     */
    const showMultiPolygonClosing =
      isActivelyDrawingMultiPolygon &&
      currentMultiPolygonVertices.length >= 3 &&
      multiPolygonLastVertex &&
      multiPolygonFirstVertex;

    setSourceData(
      mapboxMap,
      CLOSING_SOURCE_ID,
      showClosing
        ? lineFeatureCollection([lastVertex, firstVertex], {
            borderColor,
            opacity: canClosePolygon ? 0.65 : 0.35,
          })
        : showMultiPolygonClosing
          ? lineFeatureCollection([multiPolygonLastVertex, multiPolygonFirstVertex], {
              borderColor,
              opacity: canCloseCurrentMultiPolygonPart ? 0.65 : 0.35,
            })
          : emptyCollection(),
    );

    const showRejected =
      isDrawing && geometryTool !== "move" && !!rejectedSegment;

    setSourceData(
      mapboxMap,
      REJECTED_SOURCE_ID,
      showRejected
        ? lineFeatureCollection(
            [rejectedSegment.start, rejectedSegment.end],
            { borderColor },
          )
        : emptyCollection(),
    );
  }, [
    mapboxMap,
    showDraft,
    isDrawing,
    isMoving,
    geometryTool,
    draftGeometry?.type,
    draftGeometry?.coordinates,
    vertices,
    lineColor,
    borderColor,
    fillColor,
    canClosePolygon,
    canCloseCurrentMultiPolygonPart,
    rejectedSegment,
    isMultiPoint,
    isMultiLine,
    isMultiPolygon,
    isActivelyDrawingMultiPolygon,
    multiLineParts,
    multiPolygonCommittedRings,
    currentMultiPolygonVertices,
  ]);

  useEffect(() => {
    syncDraftSourcesRef.current = syncDraftSources;
  }, [syncDraftSources]);

  useEffect(() => {
    if (!mapboxMap) return;

    syncDraftSources();
  }, [mapboxMap, syncDraftSources]);

  /*
   * Create the draft source/layers once per map instance, and again
   * every time Mapbox reloads the style (confirmed empirically:
   * setStyle() does NOT preserve runtime-added sources/layers).
   * Rather than a React counter/state flag, listening for the map's
   * own native "style.load" event triggers addDraftLayers directly,
   * immediately followed by syncDraftSources so the freshly-recreated
   * (empty) sources get the current preview data right away instead
   * of sitting empty. This only concerns the static preview GeoJSON
   * layers - the draft Point/vertex mapboxgl.Marker handles further
   * down aren't part of the style at all and are unaffected by a
   * style reload.
   */
  useEffect(() => {
    if (!mapboxMap) return;

    const applyLayers = () => {
      addDraftLayers(mapboxMap);
      syncDraftSourcesRef.current();
    };

    applyLayers();
    mapboxMap.on("style.load", applyLayers);

    return () => {
      mapboxMap.off("style.load", applyLayers);
      removeDraftLayers(mapboxMap);
    };
  }, [mapboxMap]);

  /*
   * Placing a brand-new Point (click-to-add) doesn't change
   * draftGeometry's type or colors: Editor.jsx pre-populates
   * draftGeometry with an empty-coordinates Point the moment the
   * point tool is selected, before any click, so the click that
   * actually places it only fills in coordinates on that same
   * type/color values - which aren't tracked below (see the
   * dependency comment). Without something that flips exactly when
   * coordinates go from invalid to valid, the marker-creation effect
   * never reruns and the draft point never appears until the add
   * panel closes and something else (a different type/color) happens
   * to retrigger it. This stays true for the rest of the gesture
   * (dragging only changes which valid coordinate it is, never
   * whether it's valid), so it doesn't reintroduce the per-frame
   * drag-recreation problem this effect's dependency array otherwise
   * avoids.
   */
  const hasValidPointCoordinates =
    draftGeometry?.type === "Point" &&
    Number.isFinite(draftGeometry.coordinates?.[0]) &&
    Number.isFinite(draftGeometry.coordinates?.[1]);

  /*
   * The draft Point marker - draggable with either the vertex move
   * tool or "Move Geometry" (a lone Point's only coordinate IS its
   * whole geometry, so moveGeometry just reuses this same marker/drag
   * pipeline instead of the separate centroid-handle marker the other
   * types get below).
   */
  useEffect(() => {
    if (pointMarkerRef.current) {
      pointMarkerRef.current.remove();
      pointMarkerRef.current = null;
    }

    isDraggingPointMarkerRef.current = false;

    if (!mapboxMap || !showDraft || draftGeometry?.type !== "Point") return;

    const [lng, lat] = draftGeometry.coordinates || [];

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    const isDraggablePoint = isMoving || isMovingGeometry;

    const element = createPointMarkerElement({
      fillColor: draftGeometry?.fillColor ?? DEFAULT_POINT_FILL_COLOR,
      borderColor: draftGeometry?.borderColor ?? DEFAULT_POINT_BORDER_COLOR,
      isMoving: isDraggablePoint,
    });

    const marker = new mapboxgl.Marker({
      element,
      draggable: isDraggablePoint,
      anchor: "center",
    })
      .setLngLat([lng, lat])
      .addTo(mapboxMap);

    if (isDraggablePoint) {
      let dragStartCoordinate = [lng, lat];

      marker.on("dragstart", () => {
        isDraggingPointMarkerRef.current = true;

        const current = marker.getLngLat();

        dragStartCoordinate = [
          Number(current.lng.toFixed(6)),
          Number(current.lat.toFixed(6)),
        ];

        if (isMovingGeometry) {
          setGeometryEditHistory?.((history) => [
            ...(history || []),
            structuredClone(latestDraftGeometryRef.current),
          ]);
        }
      });

      /*
       * Live update while dragging, unvalidated, so anything reading
       * draftGeometry (there's nothing else attached to a lone Point,
       * but this keeps Point and vertex dragging consistent) tracks
       * the marker continuously instead of only at dragend.
       */
      marker.on("drag", () => {
        const { lng: nextLng, lat: nextLat } = marker.getLngLat();

        const coordinate = [
          Number(nextLng.toFixed(6)),
          Number(nextLat.toFixed(6)),
        ];

        setDraftGeometry((current) => {
          if (!current || current.type !== "Point") return current;
          return { ...current, coordinates: coordinate };
        });
      });

      marker.on("dragend", () => {
        isDraggingPointMarkerRef.current = false;

        const { lng: nextLng, lat: nextLat } = marker.getLngLat();

        const coordinate = [
          Number(nextLng.toFixed(6)),
          Number(nextLat.toFixed(6)),
        ];

        let didRevert = false;

        setDraftGeometry((current) => {
          const base =
            current && current.type === "Point" ? current : { type: "Point" };

          const nextGeometry = { ...base, coordinates: coordinate };

          if (!canFinishDraftGeometry(nextGeometry)) {
            didRevert = true;
            return { ...base, coordinates: dragStartCoordinate };
          }

          return nextGeometry;
        });

        if (didRevert) {
          marker.setLngLat(dragStartCoordinate);
        }
      });
    }

    pointMarkerRef.current = marker;

    return () => {
      marker.remove();
    };
    /*
     * Deliberately excludes draftGeometry's coordinates: once created,
     * this marker's own native dragging is what keeps its position
     * correct, and draftGeometry is updated to match it (not the
     * other way around) via the handlers above. Including coordinates
     * here would tear this marker down and recreate it on every drag
     * frame, breaking the drag gesture.
     *
     * selectedDataItem?._id IS included though: switching the move
     * tool's selection to a different item changes which item
     * draftGeometry describes without necessarily changing its type
     * (Point -> Point), so without this the marker created for the
     * previously-selected item would be left behind at wherever it
     * was last dragged instead of being recreated at the newly
     * selected item's actual coordinates.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapboxMap,
    showDraft,
    isMoving,
    isMovingGeometry,
    draftGeometry?.type,
    draftGeometry?.fillColor,
    draftGeometry?.borderColor,
    setDraftGeometry,
    setGeometryEditHistory,
    selectedDataItem?._id,
    hasValidPointCoordinates,
  ]);

  /*
   * Keeps the draft Point marker in sync with draftGeometry's own
   * coordinates whenever they change for a reason OTHER than this
   * marker's own drag (see isDraggingPointMarkerRef's own comment
   * above) - most notably, the other engine's DrawLayer moving the
   * same shared draftGeometry while this one sits hidden. Skipped
   * entirely while this marker is mid-drag, so it never fights the
   * user's own live gesture.
   */
  useEffect(() => {
    if (isDraggingPointMarkerRef.current) return;
    if (!pointMarkerRef.current || draftGeometry?.type !== "Point") return;

    const [lng, lat] = draftGeometry.coordinates || [];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    pointMarkerRef.current.setLngLat([lng, lat]);
  }, [draftGeometry]);

  /*
   * "Move Geometry"'s single draggable handle - shows at the draft's
   * centroid (getGeometryHandlePosition) for every type except Point,
   * which already gets its own draggable marker above. Dragging
   * translates every coordinate in the draft together via
   * translateGeometryByDelta, applied through the functional
   * setDraftGeometry form using the delta since this marker's own
   * last known position (geometryDragLastPosition, reset at dragstart
   * and advanced every drag frame) rather than a closed-over
   * draftGeometry - this marker is created once and its handlers stay
   * attached across every drag gesture for as long as the tool stays
   * selected, so a plain closure would go stale after the first
   * gesture. Successive per-frame deltas telescope exactly to (final -
   * initial) regardless of rounding, so this doesn't accumulate drift.
   * Mirrors Leaflet's own DrawLayer.jsx.
   */
  useEffect(() => {
    if (geometryHandleMarkerRef.current) {
      geometryHandleMarkerRef.current.remove();
      geometryHandleMarkerRef.current = null;
    }

    isDraggingGeometryHandleRef.current = false;

    if (!mapboxMap || !isMovingGeometry || !draftGeometry) return;
    if (draftGeometry.type === "Point") return;

    const handle = getGeometryHandlePosition(draftGeometry);
    if (!handle) return;

    const element = createVertexMarkerElement({ isMoving: true });

    const marker = new mapboxgl.Marker({
      element,
      draggable: true,
      anchor: "center",
    })
      .setLngLat([handle.lng, handle.lat])
      .addTo(mapboxMap);

    let geometryDragLastPosition = [handle.lng, handle.lat];

    marker.on("dragstart", () => {
      isDraggingGeometryHandleRef.current = true;

      const current = marker.getLngLat();

      geometryDragLastPosition = [
        Number(current.lng.toFixed(6)),
        Number(current.lat.toFixed(6)),
      ];

      setGeometryEditHistory?.((history) => [
        ...(history || []),
        structuredClone(latestDraftGeometryRef.current),
      ]);
    });

    marker.on("drag", () => {
      const { lng, lat } = marker.getLngLat();

      const coordinate = [Number(lng.toFixed(6)), Number(lat.toFixed(6))];

      const dLng = coordinate[0] - geometryDragLastPosition[0];
      const dLat = coordinate[1] - geometryDragLastPosition[1];

      geometryDragLastPosition = coordinate;

      setDraftGeometry((current) => translateGeometryByDelta(current, dLng, dLat) || current);
    });

    marker.on("dragend", () => {
      isDraggingGeometryHandleRef.current = false;

      const { lng, lat } = marker.getLngLat();

      const coordinate = [Number(lng.toFixed(6)), Number(lat.toFixed(6))];

      const dLng = coordinate[0] - geometryDragLastPosition[0];
      const dLat = coordinate[1] - geometryDragLastPosition[1];

      let didRevert = false;

      setDraftGeometry((current) => {
        const nextGeometry = translateGeometryByDelta(current, dLng, dLat);

        if (!nextGeometry || !canFinishDraftGeometry(nextGeometry)) {
          didRevert = true;
          return current;
        }

        return nextGeometry;
      });

      if (didRevert) {
        marker.setLngLat(geometryDragLastPosition);

        system?.notify?.("That move would create invalid geometry.");
      }
    });

    geometryHandleMarkerRef.current = marker;

    return () => {
      marker.remove();
    };
    /*
     * Deliberately excludes draftGeometry beyond its type: once
     * created, this marker's own native dragging is what keeps its
     * position correct, fed back into draftGeometry (not the other
     * way around) via the handlers above. selectedDataItem?._id is
     * included for the same reason as the Point/vertex marker effects
     * above: switching the tool's selection to a different item
     * should recreate the handle at the newly selected item's actual
     * centroid.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapboxMap,
    isMovingGeometry,
    draftGeometry?.type,
    setDraftGeometry,
    setGeometryEditHistory,
    system,
    selectedDataItem?._id,
  ]);

  /*
   * Keeps the "Move Geometry" handle in sync with draftGeometry's own
   * centroid whenever it changes for a reason OTHER than this
   * marker's own drag - mirrors the Point marker's own sync effect
   * above (see isDraggingGeometryHandleRef's own comment further up).
   */
  useEffect(() => {
    if (isDraggingGeometryHandleRef.current) return;
    if (!geometryHandleMarkerRef.current || !draftGeometry) return;
    if (draftGeometry.type === "Point") return;

    const handle = getGeometryHandlePosition(draftGeometry);
    if (!handle) return;

    geometryHandleMarkerRef.current.setLngLat([handle.lng, handle.lat]);
  }, [draftGeometry]);

  /*
   * Vertex click handling for the "remove point" and "add midpoint"
   * edit tools, mirroring Leaflet's handleVertexClick in
   * DrawLayer.jsx. A click is a single discrete event rather than a
   * continuous native gesture the way dragging is, so this can safely
   * read the current draftGeometry directly.
   */
  function handleVertexClick(index) {
    if (isRemovingPoint) {
      const nextGeometry = removeVertexAtIndex(draftGeometry, index);

      if (!nextGeometry) {
        system?.notify?.(
          draftGeometry?.type === "Polygon"
            ? "A polygon needs at least 3 points."
            : "A line needs at least 2 points.",
        );

        return;
      }

      setGeometryEditHistory?.((current) => [
        ...(current || []),
        structuredClone(draftGeometry),
      ]);

      setDraftGeometry(nextGeometry);

      return;
    }

    if (isAddingMidpoint) {
      if (selectedVertexIndex === null) {
        setSelectedVertexIndex(index);

        return;
      }

      if (selectedVertexIndex === index) {
        setSelectedVertexIndex(null);

        return;
      }

      if (!areVertexIndicesAdjacent(draftGeometry, selectedVertexIndex, index)) {
        setSelectedVertexIndex(index);

        return;
      }

      const nextGeometry = insertMidpointBetweenIndices(
        draftGeometry,
        selectedVertexIndex,
        index,
      );

      setSelectedVertexIndex(null);

      if (!nextGeometry) {
        system?.notify?.("Maximum number of points reached.");

        return;
      }

      setGeometryEditHistory?.((current) => [
        ...(current || []),
        structuredClone(draftGeometry),
      ]);

      setDraftGeometry(nextGeometry);
    }
  }

  /*
   * The multi- counterpart to handleVertexClick above - same
   * structure, just addressing a vertex by {partIndex, vertexIndex}
   * (see allMultiLine/PolygonVertexRefs) instead of a plain index, and
   * calling draftGeometry.js's own multi-vertex functions. Mirrors
   * Leaflet's own DrawLayer.jsx.
   */
  function handleMultiVertexClick(vertexRef, key) {
    if (isRemovingPoint) {
      if (!canRemoveMultiVertex(draftGeometry, vertexRef)) {
        system?.notify?.(
          draftGeometry?.type === "MultiPolygon"
            ? "A polygon needs at least 3 points."
            : draftGeometry?.type === "MultiLineString"
            ? "A line needs at least 2 points."
            : "A MultiPoint needs at least 2 points.",
        );

        return;
      }

      const nextGeometry = removeMultiVertexAt(draftGeometry, vertexRef);
      if (!nextGeometry) return;

      setGeometryEditHistory?.((current) => [
        ...(current || []),
        structuredClone(draftGeometry),
      ]);

      setDraftGeometry(nextGeometry);

      return;
    }

    if (isAddingMidpoint) {
      if (selectedMultiVertexKey === null) {
        setSelectedMultiVertexKey(key);

        return;
      }

      if (selectedMultiVertexKey === key) {
        setSelectedMultiVertexKey(null);

        return;
      }

      const [selectedPartIndex, selectedVertexIndexValue] = selectedMultiVertexKey
        .split("-")
        .map(Number);

      const selectedRef = {
        partIndex: selectedPartIndex,
        vertexIndex: selectedVertexIndexValue,
      };

      if (!areMultiVertexIndicesAdjacent(draftGeometry, selectedRef, vertexRef)) {
        setSelectedMultiVertexKey(key);

        return;
      }

      const nextGeometry = insertMultiMidpointBetweenIndices(
        draftGeometry,
        selectedRef,
        vertexRef,
      );

      setSelectedMultiVertexKey(null);

      if (!nextGeometry) {
        system?.notify?.("Maximum number of points reached.");

        return;
      }

      setGeometryEditHistory?.((current) => [
        ...(current || []),
        structuredClone(draftGeometry),
      ]);

      setDraftGeometry(nextGeometry);
    }
  }

  /*
   * The "remove sub-geometry" tool's own click handler - removes an
   * entire point/line/polygon out of a MultiPoint/MultiLineString/
   * MultiPolygon (partIndex into its own coordinates array), as
   * opposed to handleMultiVertexClick's own remove branch above, which
   * only ever removes one vertex within a single part. Mirrors
   * Leaflet's own DrawLayer.jsx.
   */
  function handleRemoveSubgeometryClick(partIndex) {
    const isSingleTypeAllowed = isSingleCollapseAllowed(
      schema?.geometry?.types,
      draftGeometry?.type,
    );

    if (!canRemoveSubgeometry(draftGeometry, isSingleTypeAllowed)) {
      const singularNoun =
        draftGeometry?.type === "MultiPolygon"
          ? "polygon"
          : draftGeometry?.type === "MultiLineString"
          ? "line"
          : "point";

      system?.notify?.(
        isSingleTypeAllowed
          ? `A Multi${singularNoun[0].toUpperCase()}${singularNoun.slice(1)} needs to keep at least 1 ${singularNoun}.`
          : `This project doesn't allow a single ${singularNoun}, so this item needs to keep at least 2.`,
      );

      return;
    }

    const nextGeometry = removeSubgeometryAt(draftGeometry, partIndex, isSingleTypeAllowed);
    if (!nextGeometry) return;

    setGeometryEditHistory?.((current) => [
      ...(current || []),
      structuredClone(draftGeometry),
    ]);

    setDraftGeometry(nextGeometry);
  }

  /*
   * Vertex markers for a LineString/Polygon draft, only while
   * actively drawing or moving (matching Leaflet: these don't show
   * once the add panel is open with a finished draft). Also excluded
   * for "Move Geometry" (isMovingGeometry): that tool only ever drags
   * the single centroid handle, never an individual vertex, so
   * per-vertex markers here would both be misleadingly clickable-
   * looking with nothing behind them and (on Mapbox specifically)
   * visually stale mid-drag, since they're plain markers positioned
   * once rather than kept in sync with every live translate.
   */
  useEffect(() => {
    for (const marker of vertexMarkersRef.current) {
      marker.remove();
    }

    vertexMarkersRef.current = [];

    if (!mapboxMap || !isDrawing || isMovingGeometry) return;

    const isEditableType =
      draftGeometry?.type === "LineString" || draftGeometry?.type === "Polygon";

    if (!isEditableType) return;

    const nextMarkers = vertices.map((coordinate, index) => {
      const isStartVertex =
        geometryTool === "polygon" &&
        draftGeometry.type === "Polygon" &&
        index === 0 &&
        canClosePolygon;

      const isClickableVertex = isRemovingPoint || isAddingMidpoint;
      const isPrimarySelected = isAddingMidpoint && selectedVertexIndex === index;

      const element = createVertexMarkerElement({
        isStartVertex,
        isMoving,
        isClickable: isClickableVertex,
        isPrimarySelected,
        primarySelectedColor: draftGeometry?.lineColor || draftGeometry?.borderColor,
      });

      const marker = new mapboxgl.Marker({
        element,
        draggable: isMoving,
        anchor: "center",
      })
        .setLngLat(coordinate)
        .addTo(mapboxMap);

      if (isMoving) {
        let dragStartCoordinate = coordinate;

        marker.on("dragstart", () => {
          const current = marker.getLngLat();

          dragStartCoordinate = [
            Number(current.lng.toFixed(6)),
            Number(current.lat.toFixed(6)),
          ];
        });

        /*
         * Live update while dragging, unvalidated - this is what
         * makes the connected line/polygon border follow the vertex
         * continuously instead of only snapping into place once the
         * drag ends.
         */
        marker.on("drag", () => {
          const { lng, lat } = marker.getLngLat();

          const nextCoordinate = [
            Number(lng.toFixed(6)),
            Number(lat.toFixed(6)),
          ];

          setDraftGeometry((current) => {
            const nextGeometry = moveDraftVertex(
              current,
              index,
              nextCoordinate,
            );

            return nextGeometry || current;
          });
        });

        marker.on("dragend", () => {
          const { lng, lat } = marker.getLngLat();

          const nextCoordinate = [
            Number(lng.toFixed(6)),
            Number(lat.toFixed(6)),
          ];

          let didRevert = false;

          setDraftGeometry((current) => {
            const nextGeometry = moveDraftVertex(
              current,
              index,
              nextCoordinate,
            );

            if (!nextGeometry || !canFinishDraftGeometry(nextGeometry)) {
              didRevert = true;

              return (
                moveDraftVertex(current, index, dragStartCoordinate) ||
                current
              );
            }

            return nextGeometry;
          });

          if (didRevert) {
            marker.setLngLat(dragStartCoordinate);

            system?.notify?.(
              "That move would create invalid geometry.",
            );
          }
        });
      } else if (isClickableVertex) {
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          handleVertexClick(index);
        });
      } else if (isStartVertex) {
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          drawDraft(draftGeometry, system);
        });
      }

      return marker;
    });

    vertexMarkersRef.current = nextMarkers;

    return () => {
      for (const marker of nextMarkers) {
        marker.remove();
      }
    };
    /*
     * Deliberately depends on vertices.length rather than vertices
     * itself (or draftGeometry as a whole): once created, each
     * marker's own native dragging is what keeps its position
     * correct, fed back into draftGeometry (not the other way
     * around) via the handlers above. Depending on the live
     * coordinates here would tear every vertex marker down and
     * recreate it on every drag frame, breaking the drag gesture the
     * user is mid-way through. The vertex count changing (a vertex
     * added while drawing, or a tool/mode change) is what should
     * actually trigger a rebuild. selectedDataItem?._id is included
     * for the same reason as the Point marker effect above: switching
     * the move tool's selection to a different item with the same
     * vertex count would otherwise leave the previous item's vertex
     * markers behind at their last dragged positions.
     * selectedVertexIndex is also included: unlike a drag, changing
     * which vertex is "primary selected" for the add-midpoint tool is
     * a discrete click, not a continuous gesture, so rebuilding to
     * show the updated highlight here is safe.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapboxMap,
    isDrawing,
    isMoving,
    isMovingGeometry,
    isRemovingPoint,
    isAddingMidpoint,
    geometryTool,
    draftGeometry?.type,
    draftGeometry?.lineColor,
    draftGeometry?.borderColor,
    vertices.length,
    canClosePolygon,
    setDraftGeometry,
    setGeometryEditHistory,
    drawDraft,
    system,
    selectedDataItem?._id,
    selectedVertexIndex,
  ]);

  /*
   * Plain, non-draggable vertex markers for the current part of a
   * MultiLineString/MultiPolygon draft still being actively drawn -
   * same createVertexMarkerElement "white dot" look every other draft
   * vertex above uses. Gated on the specific draw tool (not just
   * isDrawing, which is also true for the move/remove-point/add-
   * midpoint edit tools) so these don't overlap with the fully
   * interactive, all-parts markers the effect below renders once
   * editing an already-saved item.
   */
  useEffect(() => {
    for (const marker of multiVertexMarkersRef.current) {
      marker.remove();
    }

    multiVertexMarkersRef.current = [];

    if (!mapboxMap || !isDrawing) return undefined;

    const coordinates = isActivelyDrawingMultiLine
      ? currentMultiLineVertices
      : isActivelyDrawingMultiPolygon
        ? currentMultiPolygonVertices
        : [];

    if (coordinates.length === 0) return undefined;

    const nextMarkers = coordinates.map((coordinate) => {
      const element = createVertexMarkerElement();

      return new mapboxgl.Marker({
        element,
        draggable: false,
        anchor: "center",
      })
        .setLngLat(coordinate)
        .addTo(mapboxMap);
    });

    multiVertexMarkersRef.current = nextMarkers;

    return () => {
      for (const marker of nextMarkers) {
        marker.remove();
      }
    };
  }, [
    mapboxMap,
    isDrawing,
    isActivelyDrawingMultiLine,
    isActivelyDrawingMultiPolygon,
    currentMultiLineVertices,
    currentMultiPolygonVertices,
  ]);

  const multiEditVertexCount =
    draftGeometry?.type === "MultiPoint"
      ? draftGeometry.coordinates?.length || 0
      : draftGeometry?.type === "MultiLineString"
        ? allMultiLineVertexRefs.length
        : allMultiPolygonVertexRefs.length;

  /*
   * Fully interactive vertex markers for the move/remove-point/add-
   * midpoint edit tools on an already-saved MultiPoint/MultiLineString/
   * MultiPolygon - one marker per vertex across every part (not just
   * the "current" one the effect above covers), each wired up to
   * draftGeometry.js's own multi-vertex functions. Mirrors the
   * complex single-type vertex effect further up, minus the
   * isStartVertex/canClosePolygon concerns that only apply to the
   * draw-in-progress workflow.
   */
  useEffect(() => {
    for (const marker of multiEditVertexMarkersRef.current) {
      marker.remove();
    }

    multiEditVertexMarkersRef.current = [];

    if (!mapboxMap) return undefined;

    let refs = [];
    const isMultiPointDraft = draftGeometry?.type === "MultiPoint";

    /*
     * MultiPoint has no "parts" beyond its own points, so its points
     * ARE its own sub-geometry - move and remove-sub-geometry both
     * operate on these same markers. MultiLineString/MultiPolygon
     * only show individual vertex markers here for the vertex-level
     * tools (move/remove-point/add-midpoint) - remove-sub-geometry
     * works at the whole-line/polygon level for those two instead
     * (see the GL layer click listener further below), so no vertex
     * markers render for it there.
     */
    if (isMultiPointDraft && (isMoving || isRemovingSubgeometry)) {
      const coordinates = Array.isArray(draftGeometry.coordinates)
        ? draftGeometry.coordinates
        : [];

      refs = coordinates
        .map((coordinate, index) =>
          isFiniteCoordinatePair(coordinate) ? { vertexRef: index, coordinate } : null,
        )
        .filter(Boolean);
    } else if (
      draftGeometry?.type === "MultiLineString" &&
      (isMoving || isRemovingPoint || isAddingMidpoint)
    ) {
      refs = allMultiLineVertexRefs.map((ref) => ({ vertexRef: ref, coordinate: ref.coordinate }));
    } else if (
      draftGeometry?.type === "MultiPolygon" &&
      (isMoving || isRemovingPoint || isAddingMidpoint)
    ) {
      refs = allMultiPolygonVertexRefs.map((ref) => ({ vertexRef: ref, coordinate: ref.coordinate }));
    } else {
      return undefined;
    }

    const nextMarkers = refs.map(({ vertexRef, coordinate }) => {
      const key =
        typeof vertexRef === "number"
          ? String(vertexRef)
          : `${vertexRef.partIndex}-${vertexRef.vertexIndex}`;

      const isClickableVertex =
        isRemovingPoint || isAddingMidpoint || (isMultiPointDraft && isRemovingSubgeometry);
      const isPrimarySelected = isAddingMidpoint && selectedMultiVertexKey === key;

      const element = createVertexMarkerElement({
        isMoving,
        isClickable: isClickableVertex,
        isPrimarySelected,
        primarySelectedColor: draftGeometry?.lineColor || draftGeometry?.borderColor,
      });

      const marker = new mapboxgl.Marker({
        element,
        draggable: isMoving,
        anchor: "center",
      })
        .setLngLat(coordinate)
        .addTo(mapboxMap);

      if (isMoving) {
        let dragStartCoordinate = coordinate;

        marker.on("dragstart", () => {
          const current = marker.getLngLat();

          dragStartCoordinate = [
            Number(current.lng.toFixed(6)),
            Number(current.lat.toFixed(6)),
          ];
        });

        marker.on("drag", () => {
          const { lng, lat } = marker.getLngLat();

          const nextCoordinate = [
            Number(lng.toFixed(6)),
            Number(lat.toFixed(6)),
          ];

          setDraftGeometry((current) => {
            const nextGeometry = moveMultiVertex(current, vertexRef, nextCoordinate);
            return nextGeometry || current;
          });
        });

        marker.on("dragend", () => {
          const { lng, lat } = marker.getLngLat();

          const nextCoordinate = [
            Number(lng.toFixed(6)),
            Number(lat.toFixed(6)),
          ];

          let didRevert = false;

          setDraftGeometry((current) => {
            const nextGeometry = moveMultiVertex(current, vertexRef, nextCoordinate);

            if (!nextGeometry || !isMultiPolygonMoveValid(nextGeometry, vertexRef)) {
              didRevert = true;

              return moveMultiVertex(current, vertexRef, dragStartCoordinate) || current;
            }

            return nextGeometry;
          });

          if (didRevert) {
            marker.setLngLat(dragStartCoordinate);

            system?.notify?.("That move would create invalid geometry.");
          }
        });
      } else if (isMultiPointDraft && isRemovingSubgeometry) {
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          handleRemoveSubgeometryClick(vertexRef);
        });
      } else if (isClickableVertex) {
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          handleMultiVertexClick(vertexRef, key);
        });
      }

      return marker;
    });

    multiEditVertexMarkersRef.current = nextMarkers;

    return () => {
      for (const marker of nextMarkers) {
        marker.remove();
      }
    };
    /*
     * Deliberately depends on each ref list's own length rather than
     * the arrays themselves (or draftGeometry as a whole) - same
     * reasoning as the single-type vertex effect's own
     * vertices.length: once created, each marker's own native
     * dragging is what keeps its position correct, so rebuilding on
     * every drag frame would tear the gesture down mid-drag.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapboxMap,
    isEditingGeometry,
    isMoving,
    isRemovingPoint,
    isRemovingSubgeometry,
    isAddingMidpoint,
    draftGeometry?.type,
    draftGeometry?.lineColor,
    draftGeometry?.borderColor,
    multiEditVertexCount,
    setDraftGeometry,
    setGeometryEditHistory,
    system,
    selectedDataItem?._id,
    selectedMultiVertexKey,
  ]);

  /*
   * The "remove sub-geometry" tool's own click handling for
   * MultiLineString/MultiPolygon - whole lines/polygons render through
   * the ordinary LINE_LAYER_ID/POLYGON_FILL_LAYER_ID GL layers (via
   * syncDraftSources' own multiLineFeatureCollection/
   * multiPolygonFeatureCollection, each feature already tagged with
   * its own partIndex), so removing one is just a click listener on
   * those same layers reading that property back off the clicked
   * feature - no separate markers needed the way MultiPoint's own
   * points need (handled in the effect above instead, since Mapbox has
   * no per-feature click target within a GL layer otherwise).
   */
  useEffect(() => {
    if (!mapboxMap || !isRemovingSubgeometry) return undefined;

    const isRemovableType =
      draftGeometry?.type === "MultiLineString" || draftGeometry?.type === "MultiPolygon";

    if (!isRemovableType) return undefined;

    const layerIds =
      draftGeometry.type === "MultiLineString" ? [LINE_LAYER_ID] : [POLYGON_FILL_LAYER_ID];

    const handleClick = (event) => {
      const partIndex = event.features?.[0]?.properties?.partIndex;
      if (typeof partIndex !== "number") return;

      handleRemoveSubgeometryClick(partIndex);
    };

    const handleMouseEnter = () => {
      mapboxMap.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      mapboxMap.getCanvas().style.cursor = "";
    };

    for (const layerId of layerIds) {
      mapboxMap.on("click", layerId, handleClick);
      mapboxMap.on("mouseenter", layerId, handleMouseEnter);
      mapboxMap.on("mouseleave", layerId, handleMouseLeave);
    }

    return () => {
      for (const layerId of layerIds) {
        mapboxMap.off("click", layerId, handleClick);
        mapboxMap.off("mouseenter", layerId, handleMouseEnter);
        mapboxMap.off("mouseleave", layerId, handleMouseLeave);
      }
    };
    /*
     * handleRemoveSubgeometryClick isn't memoized, so it's a fresh
     * function every render - listed here it would tear this listener
     * down and reattach it on every render for no benefit, since (like
     * every other click-only handler in this file) there's no drag
     * gesture here to protect from being interrupted. draftGeometry
     * already covers the only thing that actually needs this to
     * re-attach.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxMap, isRemovingSubgeometry, draftGeometry]);

  return null;
}
