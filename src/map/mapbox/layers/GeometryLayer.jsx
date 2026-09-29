// src/map/mapbox/layers/GeometryLayer.jsx

import { useEffect, useMemo, useRef } from "react";

import MapboxSelectedItemPopup from "../popup/MapboxSelectedItemPopup.jsx";
import { createAddSubgeometryDraft } from "../../utils/draftGeometry.js";
import {
  canAddSubgeometryToItem,
  canSelectForRemoveSubgeometry,
} from "../../../../shared/validation/geometryTypeRules.js";


const SOURCE_ID = "mapdex-geometry";


const POINT_LAYER_ID =
  "mapdex-points";

const LINE_LAYER_ID =
  "mapdex-lines";

const POLYGON_FILL_LAYER_ID =
  "mapdex-polygons-fill";

const POLYGON_BORDER_LAYER_ID =
  "mapdex-polygons-border";


const DEFAULT_POINT_FILL_COLOR = "#3b82f6";
const DEFAULT_POINT_BORDER_COLOR = "#1d4ed8";

const DEFAULT_LINE_COLOR = "#3388ff";

const DEFAULT_POLYGON_BORDER_COLOR = "#2563eb";
const DEFAULT_POLYGON_FILL_COLOR = "#3b82f6";


function isFiniteCoordinatePair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) {
    return false;
  }

  const lng = Number(pair[0]);
  const lat = Number(pair[1]);

  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat)
  );
}


function isValidGeometry(geometry) {
  if (!geometry?.type) return false;

  if (geometry.type === "Point") {
    return isFiniteCoordinatePair(
      geometry.coordinates,
    );
  }

  if (geometry.type === "LineString") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length >= 2 &&
      geometry.coordinates.every(
        isFiniteCoordinatePair,
      )
    );
  }

  if (geometry.type === "Polygon") {
    const outerRing =
      geometry.coordinates?.[0];

    return (
      Array.isArray(outerRing) &&
      outerRing.length >= 4 &&
      outerRing.every(
        isFiniteCoordinatePair,
      )
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
        (line) =>
          Array.isArray(line) && line.length >= 2 && line.every(isFiniteCoordinatePair),
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


function buildFeatureCollection(
  data,
  selectedDataItem,
  isEditTool,
  isDrawTool,
  draftGeometry,
) {
  const selectedId =
    selectedDataItem?._id != null
      ? String(selectedDataItem._id)
      : null;

  const features = [];

  for (const dataItem of data || []) {
    const geometry = dataItem?.geometry;

    if (!isValidGeometry(geometry)) {
      continue;
    }

    const dataItemId =
      dataItem?._id != null
        ? String(dataItem._id)
        : "";

    const isSelected =
      selectedId !== null &&
      selectedId === dataItemId;

    /*
     * While this item is actively being edited with the move/remove
     * point/add midpoint/remove sub-geometry tool, the draft layer
     * (DrawLayer.jsx) renders the live version instead - skip it here
     * so it isn't shown twice (once frozen at its saved state, once
     * following the edit). Deliberately doesn't also require
     * draftGeometry?.type === geometry.type the way renderedGeometry's
     * own check below does - selectedDataItem and draftGeometry are
     * always set together by this file's own click handler, and the
     * "remove sub-geometry" tool can deliberately convert its draft's
     * type from Multi to its singular equivalent mid-edit once only
     * one part is left (see removeSubgeometryAt in draftGeometry.js),
     * so the saved shape still needs to stay hidden even though the
     * draft's type no longer matches it.
     */
    if (isSelected && isEditTool) {
      continue;
    }

    /*
     * Outside any edit/draw tool, a selected item being edited (the
     * edit panel's Point lat/lng inputs) should render at its live
     * draft position instead of its last-saved one, mirroring
     * Leaflet's GeometryLayer renderedGeometry swap.
     */
    const renderedGeometry =
      isSelected &&
      !isDrawTool &&
      !isEditTool &&
      draftGeometry?.type === geometry.type
        ? draftGeometry
        : geometry;

    if (!isValidGeometry(renderedGeometry)) {
      continue;
    }

    const properties = {
      mapdexId: dataItemId,
      selected: isSelected,
    };


    if (renderedGeometry.type === "Point") {
      properties.fillColor =
        renderedGeometry.fillColor ??
        DEFAULT_POINT_FILL_COLOR;

      properties.borderColor =
        renderedGeometry.borderColor ??
        DEFAULT_POINT_BORDER_COLOR;
    }


    if (renderedGeometry.type === "LineString") {
      properties.lineColor =
        renderedGeometry.lineColor ??
        DEFAULT_LINE_COLOR;
    }


    if (renderedGeometry.type === "Polygon") {
      properties.fillColor =
        renderedGeometry.fillColor ??
        DEFAULT_POLYGON_FILL_COLOR;

      properties.borderColor =
        renderedGeometry.borderColor ??
        DEFAULT_POLYGON_BORDER_COLOR;
    }


    if (renderedGeometry.type === "MultiPoint") {
      properties.fillColor =
        renderedGeometry.fillColor ??
        DEFAULT_POINT_FILL_COLOR;

      properties.borderColor =
        renderedGeometry.borderColor ??
        DEFAULT_POINT_BORDER_COLOR;
    }


    if (renderedGeometry.type === "MultiLineString") {
      properties.lineColor =
        renderedGeometry.lineColor ??
        DEFAULT_LINE_COLOR;
    }


    if (renderedGeometry.type === "MultiPolygon") {
      properties.fillColor =
        renderedGeometry.fillColor ??
        DEFAULT_POLYGON_FILL_COLOR;

      properties.borderColor =
        renderedGeometry.borderColor ??
        DEFAULT_POLYGON_BORDER_COLOR;
    }


    features.push({
      type: "Feature",

      properties,

      geometry: {
        type: renderedGeometry.type,
        coordinates: renderedGeometry.coordinates,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}


function addGeometryLayers(
  mapboxMap,
  featureCollection,
) {
  if (!mapboxMap.getSource(SOURCE_ID)) {
    mapboxMap.addSource(SOURCE_ID, {
      type: "geojson",
      data: featureCollection,
    });
  }


  /*
   * POLYGON FILL
   */
  if (!mapboxMap.getLayer(POLYGON_FILL_LAYER_ID)) {
    mapboxMap.addLayer({
      id: POLYGON_FILL_LAYER_ID,

      type: "fill",

      source: SOURCE_ID,

      slot: "top",

      /*
       * Mapbox GL's ["geometry-type"] expression evaluates to the
       * literal string "MultiPolygon" (not "Polygon") for a
       * MultiPolygon feature, so this layer needs to explicitly match
       * both - same idea for every other layer's own filter below.
       */
      filter: [
        "any",
        ["==", ["geometry-type"], "Polygon"],
        ["==", ["geometry-type"], "MultiPolygon"],
      ],

      paint: {
        "fill-color": [
          "get",
          "fillColor",
        ],

        "fill-opacity": [
          "case",
          ["get", "selected"],
          0.6,
          0.14,
        ],
      },
    });
  }


  /*
   * POLYGON BORDER
   */
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
        "line-color": [
          "get",
          "borderColor",
        ],

        "line-width": [
          "case",
          ["get", "selected"],
          3,
          2,
        ],

        "line-opacity": [
          "case",
          ["get", "selected"],
          1,
          0.65,
        ],
      },
    });
  }


  /*
   * LINESTRING
   */
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

      layout: {
        "line-cap": "round",
        "line-join": "round",
      },

      paint: {
        "line-color": [
          "get",
          "lineColor",
        ],

        "line-width": [
          "case",
          ["get", "selected"],
          7,
          5,
        ],

        "line-opacity": [
          "case",
          ["get", "selected"],
          1,
          0.65,
        ],
      },
    });
  }


  /*
   * POINT
   */
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
        "circle-radius": [
          "case",
          ["get", "selected"],
          10,
          9,
        ],

        "circle-color": [
          "get",
          "fillColor",
        ],

        "circle-stroke-color": [
          "get",
          "borderColor",
        ],

        "circle-stroke-width": 3,

        "circle-opacity": [
          "case",
          ["get", "selected"],
          1,
          0.65,
        ],

        "circle-stroke-opacity": [
          "case",
          ["get", "selected"],
          1,
          0.65,
        ],
      },
    });
  }
}


/*
 * Reverses addGeometryLayers: layers must be removed before the
 * source they reference, or Mapbox throws. Called when this
 * component unmounts (e.g. the active engine changes) so a persistent
 * map instance doesn't accumulate a previous engine's sources/layers,
 * which would otherwise leak forever and throw a duplicate-id error
 * the next time this engine's content remounts.
 */
function removeGeometryLayers(mapboxMap) {
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


export default function MapboxGeometryLayer({
  mapboxMap,
  data,
  selectedDataItem,
  setSelectedDataItem,
  dataUtils,
  schema,
  geometryTool,
  draftGeometry,
  setDraftGeometry,
  system,
  map,
}) {
  const dataRef = useRef(data || []);
  const selectedIdRef = useRef(null);
  const lastFocusedIdRef = useRef(null);
  const featureCollectionRef = useRef(null);

  const isMoveTool = geometryTool === "move";
  const isMoveGeometryTool = geometryTool === "moveGeometry";
  const isRemovePointTool = geometryTool === "remove";
  const isAddMidpointTool = geometryTool === "midpoint";
  const isRemoveSubgeometryTool = geometryTool === "removeSubgeometry";
  const isAddSubgeometryTool = geometryTool === "addSubgeometry";

  /*
   * Every geometry edit tool: all of them select an item and populate
   * its draft, hide the saved rendering in favor of DrawLayer's live/
   * interactive draft while active, and block popups. Most populate
   * the draft with a verbatim clone of the selected item's own
   * geometry - addSubgeometry is the one exception, converting the
   * selection into an addable Multi- type draft instead (see its own
   * branch below). moveGeometry also just clones verbatim (it never
   * changes type, only translates coordinates once dragged), with no
   * type restriction on what's selectable, same as addSubgeometry -
   * DrawLayer.jsx is what renders its own draggable centroid handle
   * and does the actual translation once dragged. They otherwise only
   * differ in what happens once a vertex/the map is clicked, which
   * DrawLayer.jsx (and, for addSubgeometry, useDrawController) handles.
   */
  const isEditTool =
    isMoveTool ||
    isMoveGeometryTool ||
    isRemovePointTool ||
    isAddMidpointTool ||
    isRemoveSubgeometryTool ||
    isAddSubgeometryTool;

  const isDrawTool =
    geometryTool === "point" ||
    geometryTool === "line" ||
    geometryTool === "polygon" ||
    geometryTool === "multipoint" ||
    geometryTool === "multiline" ||
    geometryTool === "multipolygon";

  /*
   * Center on the selected item, same as Leaflet's GeometryLayer:
   * Point centers on itself, LineString centers on its stored,
   * authoritative midpoint (shared/validation/lineStringValidation.js)
   * rather than recomputing an approximation here.
   */
  useEffect(() => {
    if (!selectedDataItem || !map) {
      lastFocusedIdRef.current = null;
      return;
    }

    if (lastFocusedIdRef.current === selectedDataItem._id) return;

    const geometry = selectedDataItem.geometry;

    let lat = null;
    let lng = null;

    if (geometry?.type === "Point") {
      lng = Number(geometry.coordinates?.[0]);
      lat = Number(geometry.coordinates?.[1]);
    } else if (geometry?.type === "LineString") {
      lat = Number(geometry.centroid?.lat);
      lng = Number(geometry.centroid?.lng);
    } else if (geometry?.type === "Polygon" || geometry?.type === "MultiPoint" || geometry?.type === "MultiPolygon") {
      lat = Number(geometry.centroid?.lat);
      lng = Number(geometry.centroid?.lng);
    } else if (geometry?.type === "MultiLineString") {
      lat = Number(geometry.centroid?.lat);
      lng = Number(geometry.centroid?.lng);
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    lastFocusedIdRef.current = selectedDataItem._id;
    map.focus(lat, lng, selectedDataItem._id, 0.4);
    /*
     * Deliberately excludes `map`: map.focus() itself updates
     * mapCenter, which recreates the shared runtime `map` object
     * (see GlobalRuntime.jsx), which would retrigger this effect and
     * refocus in an infinite loop, permanently fighting the user's
     * own pan/zoom, if `map` were a dependency here. Keying on
     * selectedDataItem's id/updatedAt (plus the lastFocusedIdRef
     * guard) is what makes this fire exactly once per actual
     * selection instead.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDataItem?._id, selectedDataItem?.updatedAt]);

  /*
   * Outside any edit/draw tool, draftGeometry only changes on a
   * discrete "finalize" commit (e.g. the edit panel's Point lat/lng
   * inputs) - cheap to depend on directly, and necessary so the
   * rendered position actually updates. During an edit tool, this
   * item is skipped/hidden entirely in favor of DrawLayer's live
   * rendering (see buildFeatureCollection's isEditTool skip check
   * above), so only draftGeometry's type actually affects what gets
   * built here - depending on the whole object during the move tool's
   * continuous per-frame dragging would rebuild the entire feature
   * collection on every frame for no visible difference.
   */
  const draftDependency =
    !isEditTool && !isDrawTool
      ? draftGeometry
      : draftGeometry?.type;

  const featureCollection = useMemo(
    () =>
      buildFeatureCollection(
        data,
        selectedDataItem,
        isEditTool,
        isDrawTool,
        draftGeometry,
      ),
    [
      data,
      selectedDataItem?._id,
      isEditTool,
      isDrawTool,
      draftDependency,
    ],
  );


  useEffect(() => {
    dataRef.current =
      Array.isArray(data)
        ? data
        : [];
  }, [data]);


  useEffect(() => {
    selectedIdRef.current =
      selectedDataItem?._id != null
        ? String(selectedDataItem._id)
        : null;
  }, [selectedDataItem?._id]);


  useEffect(() => {
    featureCollectionRef.current = featureCollection;
  }, [featureCollection]);


  /*
   * Create the Mapbox source and layers once per map instance, and
   * again every time Mapbox reloads the style (confirmed empirically:
   * setStyle() does NOT preserve runtime-added sources/layers, they
   * disappear and must be re-added). Rather than a React counter/state
   * flag to signal "please re-add", listening for the map's own native
   * "style.load" event triggers the same addGeometryLayers call
   * directly. The `if (!getSource(...))` guards inside it aren't a
   * "skip if unchanged" optimization - they exist so this can't throw
   * if it's ever invoked twice for an unrelated reason (Mapbox's
   * addLayer throws on a duplicate id). featureCollectionRef (not
   * featureCollection directly) keeps this reading current data
   * without needing to recreate the listener on every data change.
   */
  useEffect(() => {
    if (!mapboxMap) return;

    const applyLayers = () => {
      addGeometryLayers(mapboxMap, featureCollectionRef.current);
    };

    applyLayers();
    mapboxMap.on("style.load", applyLayers);

    return () => {
      mapboxMap.off("style.load", applyLayers);
      removeGeometryLayers(mapboxMap);
    };
  }, [mapboxMap]);


  /*
   * Update the existing GeoJSON source whenever Mapdex data or
   * selection changes.
   */
  useEffect(() => {
    if (!mapboxMap) return;

    const source =
      mapboxMap.getSource(SOURCE_ID);

    if (!source) return;

    source.setData(featureCollection);
  }, [
    mapboxMap,
    featureCollection,
  ]);


  /*
   * Mapbox click / hover interaction.
   */
  useEffect(() => {
    if (!mapboxMap) return;

    const interactiveLayerIds = [
      POINT_LAYER_ID,
      LINE_LAYER_ID,
      POLYGON_FILL_LAYER_ID,
    ];


    const handleGeometryClick = (event) => {
      const feature =
        event.features?.[0];

      const mapdexId =
        feature?.properties?.mapdexId;

      if (!mapdexId) return;

      const dataItem =
        dataRef.current.find(
          (item) =>
            String(item?._id) ===
            String(mapdexId),
        );

      if (!dataItem) return;

      /*
       * While actively adding a new point/line/polygon, a click
       * anywhere on the map (including on top of an existing, saved
       * item) should only place/extend the new draft, never select
       * the item underneath it - the map-level click listener in
       * useDrawController.js still fires independently and handles
       * the actual drawing. Selecting still works normally for the
       * move tool, which needs it to choose what to move.
       */
      if (isDrawTool) {
        return;
      }

      if (isEditTool) {
        if (dataItem?.userRole !== "editor") {
          system?.notify?.(
            "You can only edit data items you can edit.",
          );

          return;
        }

        /*
         * Neither tool applies to a MultiPoint any more than to a lone
         * Point, per Brody's own call - a Point has no vertices to
         * remove or insert a midpoint between (it IS the one vertex),
         * and MultiPoint's own several points aren't connected by
         * anything a midpoint could sit on either. Removing one of a
         * MultiPoint's own points is instead the "remove sub-geometry"
         * tool's job below, which works at the whole-point/line/
         * polygon level rather than a single vertex - not this one.
         */
        if (
          (isRemovePointTool || isAddMidpointTool) &&
          (dataItem.geometry?.type === "Point" ||
            dataItem.geometry?.type === "MultiPoint")
        ) {
          return;
        }

        /*
         * The inverse restriction for "remove sub-geometry" - it only
         * ever operates on a MultiPoint/MultiLineString/MultiPolygon's
         * own several parts, so a plain Point/LineString/Polygon
         * (which has no "parts" to remove one of) isn't selectable
         * with it at all. Also schema-gated: an item's own Multi- type
         * has to still be in schema.geometry.types for the tool to
         * touch it (see shared/validation/geometryTypeRules.js).
         */
        if (
          isRemoveSubgeometryTool &&
          !canSelectForRemoveSubgeometry(schema?.geometry?.types, dataItem.geometry?.type)
        ) {
          return;
        }

        /*
         * Add Sub-Geometry promotes a single into its Multi-
         * counterpart (or grows an existing Multi-), so it needs that
         * Multi- type allowed by schema.geometry.types either way -
         * not selectable otherwise, regardless of whether the item's
         * own current type (single or already-multi) is itself
         * allowed.
         */
        if (
          isAddSubgeometryTool &&
          !canAddSubgeometryToItem(schema?.geometry?.types, dataItem.geometry?.type)
        ) {
          return;
        }

        setSelectedDataItem(dataItem);

        /*
         * addSubgeometry doesn't want a verbatim clone the way every
         * other edit tool above does - it converts the selection into
         * an addable Multi- type draft instead (see
         * createAddSubgeometryDraft's own comment).
         */
        setDraftGeometry(
          isAddSubgeometryTool
            ? createAddSubgeometryDraft(dataItem.geometry)
            : structuredClone(dataItem.geometry),
        );

        return;
      }

      const isAlreadySelected =
        selectedIdRef.current ===
        String(mapdexId);

      setSelectedDataItem(
        isAlreadySelected
          ? null
          : dataItem,
      );
    };


    const handleMouseEnter = () => {
      mapboxMap.getCanvas().style.cursor =
        "pointer";
    };


    const handleMouseLeave = () => {
      mapboxMap.getCanvas().style.cursor =
        "";
    };


    for (const layerId of interactiveLayerIds) {
      mapboxMap.on(
        "click",
        layerId,
        handleGeometryClick,
      );

      mapboxMap.on(
        "mouseenter",
        layerId,
        handleMouseEnter,
      );

      mapboxMap.on(
        "mouseleave",
        layerId,
        handleMouseLeave,
      );
    }


    return () => {
      for (const layerId of interactiveLayerIds) {
        mapboxMap.off(
          "click",
          layerId,
          handleGeometryClick,
        );

        mapboxMap.off(
          "mouseenter",
          layerId,
          handleMouseEnter,
        );

        mapboxMap.off(
          "mouseleave",
          layerId,
          handleMouseLeave,
        );
      }
    };
  }, [
    mapboxMap,
    setSelectedDataItem,
    isEditTool,
    isRemovePointTool,
    isAddMidpointTool,
    isRemoveSubgeometryTool,
    isAddSubgeometryTool,
    isDrawTool,
    setDraftGeometry,
    system,
  ]);


  return (
    <MapboxSelectedItemPopup
      mapboxMap={mapboxMap}
      selectedDataItem={selectedDataItem}
      enabled={!isEditTool}
      getGeometry={(dataItem) => {
        const geometry = dataItem?.geometry;

        const useDraft =
          !isEditTool &&
          !isDrawTool &&
          draftGeometry?.type === geometry?.type;

        return useDraft ? draftGeometry : geometry;
      }}
      getCentroid={(dataItem) => dataItem?.geometry?.centroid}
      dataUtils={dataUtils}
      schema={schema}
    />
  );
}