import { useState, useRef, useMemo, useEffect } from "react";

//Api
import { projectsApi } from "../api/projectsApi.js";
import { usersApi } from "../api/usersApi.js";
import { layersApi } from "../api/layersApi.js";
import { aggregatesApi } from "../api/aggregatesApi.js";
import { boundariesApi } from "../api/boundariesApi.js";
import { computeProjectInsights } from "../insights/utils/computeProjectInsights.js";
import {
  exportProject,
  exportFilteredProject,
} from "../exports/projects/exportProject.js";
import { exportLayers } from "../exports/layers/exportLayers.js";
import { exportAggregates } from "../exports/aggregates/exportAggregates.js";
import {
  exportBoundary,
  exportBoundaries,
} from "../exports/boundaries/exportBoundaries.js";
import { USER_ICON_THEMES } from "../workspace/community/userColorTheme.js";

//Data
import {
  normalizeData,
  normalizeDataItem,
} from "../dataUtils/NormalizeData.js";

import {
  updateDataItemInList,
  removeDataItemFromList,
  removeDataItemsFromList,
  insertDataItemInList,
  selectDataItemById,
  getPreviewText,
  buildAddPayloadFromForm,
  buildUpdatePayloadFromForm,
} from "../dataUtils/dataUtils.js";

//Forms
import { blankFormFromSchema } from "../forms/blankFormFromSchema.js";
import { populateBlankForm } from "../forms/populateBlankForm.js";
import { useBlankFormTemplate } from "../forms/hooks/useBlankFormTemplate.js";
import { injectCurrentLocation } from "../forms/injectCurrentLocation.js";
import { injectCurrentDateTime } from "../forms/injectCurrentDatetime.js";
import { injectRequiredDefaults } from "../forms/injectRequiredDefaults.js";
import { injectLayer } from "../forms/injectLayer.js";
import { injectDraftGeometry } from "../forms/injectDraftGeometry.js";
import { createOnLatLngFinalized } from "../forms/onLatLngFinalized.js";
import { getCenterCoordinates } from "../forms/getCenterCoordinates.js";
import { reapplyTimezoneFromLatLng } from "../../shared/time/reapplyTimezoneFromLatLng.js";

//Map
import {
  TILE_STYLES,
  MAPBOX_TERRAIN_TOGGLE_STYLE_KEYS,
  MAPBOX_PROJECTION_TOGGLE_STYLE_KEYS,
} from "../map/tiles/tileStyles.js";
import { useMapController } from "../map/hooks/useMapController.js";
import { useLayerContext } from "../map/hooks/useLayerContext.js";

//Filters
import { useFilters } from "../filters/hooks/useFilters.js";
import { useFilterBoundarySelection } from "../filters/hooks/useFilterBoundarySelection.js";
import { useSpatialToolsRuntime } from "./useSpatialToolsRuntime.js";

export function useGlobalRuntime() {
  //device style switching controls
  //const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  //const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
  // const isSmallViewport = window.innerWidth <= 768;
  const getIsMobile = () => {
    return (
      window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 768
    );
  };

  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    const coarseQuery = window.matchMedia("(pointer: coarse)");

    const updateIsMobile = () => {
      setIsMobile(coarseQuery.matches || window.innerWidth <= 768);
    };

    updateIsMobile();

    window.addEventListener("resize", updateIsMobile);

    if (coarseQuery.addEventListener) {
      coarseQuery.addEventListener("change", updateIsMobile);
    } else {
      coarseQuery.addListener(updateIsMobile);
    }

    return () => {
      window.removeEventListener("resize", updateIsMobile);

      if (coarseQuery.removeEventListener) {
        coarseQuery.removeEventListener("change", updateIsMobile);
      } else {
        coarseQuery.removeListener(updateIsMobile);
      }
    };
  }, []);

  //global app state
  //lightweight project meta data with id, projectName, collectionName, NOT full schemas
  const [projects, setProjects] = useState(null); // owned projects only
  const [publicProjects, setPublicProjects] = useState(null); // lightweight public project list
  const [sharedProjects, setSharedProjects] = useState(null); // lightweight shared project list
  const [favouriteProjects, setFavouriteProjects] = useState(null); // lightweight favourited project list

  const [projectId, setProjectId] = useState(null);
  const [schema, setSchema] = useState(null); //fetch one schema document at a time from mongo...
  const [data, setData] = useState([]);

  /*
   * The project's boundaries, and each viewer's own visibility/opacity
   * overlay for them.
   *
   * The list lives here rather than in the engine runtimes because the
   * shared filter panel can now filter by a boundary (see
   * src/filters/geometry/Geometry.jsx), and useFilters below - which
   * produces filteredData for the whole app - has to resolve a stored
   * boundaryId to a real geometry. The engine runtimes still own the
   * loading and CRUD (useBoundaryCrud) and the drawing tools; they just
   * write into this state instead of their own copy. That split is
   * deliberate: it keeps `runtime.loadBoundaries` defined only on the
   * engines that actually have a Boundaries page, which is what stops
   * MainApp's own load effect firing for engines that don't.
   */
  const [boundaries, setBoundaries] = useState([]);
  const [boundaryViewState, setBoundaryViewState] = useState({});

  /*
   * Boundaries, Layers and Aggregates. Every engine has these pages now,
   * so their state lives here rather than duplicated per engine runtime.
   * See useSpatialToolsRuntime.
   */
  const spatialTools = useSpatialToolsRuntime({ schema, setBoundaries });

  /*
   * The Insights page's numbers. Derived here rather than in the page
   * so the page stays read-only and later analysis modes have somewhere
   * shared to hang off.
   *
   * Counted against the full `data`, never `filteredData` - see
   * computeProjectInsights.js's own comment for why a dashboard must
   * not silently re-count whatever the filter panel happens to be set
   * to.
   */
  const insights = useMemo(
    () =>
      computeProjectInsights({
        schema,
        dataItems: data,
        layers: spatialTools.layers,
        boundaries,
        aggregates: spatialTools.aggregates,
      }),
    [schema, data, spatialTools.layers, boundaries, spatialTools.aggregates],
  );
  const [selectedDataItem, setSelectedDataItem] = useState(null);
  const [currentPage, setCurrentPage] = useState("projects");
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const hasAdminClearance =
    schema?.userRole === "owner" || schema?.userRole === "admin";

  //extensions generic modal meta data and helper function to open the correct modal
  const [activeExtensionModal, setActiveExtensionModal] = useState(null); //{key,mode}:doesnt store the component just metadata
  const onOpenExtension = (key, mode) => setActiveExtensionModal({ key, mode });

  const [viewerTimeZone, setViewerTimeZone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC";
    } catch {
      return "Etc/UTC";
    }
  });

  // ─────────────────────────────────────────────
  // Layer State
  // ─────────────────────────────────────────────

  const {
    activeLayer,
    setActiveLayer,
    activeParentDataItemId,
    setActiveParentDataItemId,
    resetLayerContext,
  } = useLayerContext();

  // ─────────────────────────────────────────────
  // Filter State - see src/filters/hooks/useFilters.js
  // ─────────────────────────────────────────────
  const {
    filteredData,
    setFilteredData,
    filterState,
    setFilterState,
    filterStateReady,
    filterableInputs,
    activeFilters,
    blankFilterStateTemplate,
    clearFilters,
    timeFilterOverride,
    setTimeFilterOverride,
    filterTimezoneMode,
    setFilterTimezoneMode,
    filterTimeZone,
    setFilterTimeZone,
    TIMEZONE_OPTIONS,
  } = useFilters({
    schema,
    data,
    boundaries,
    viewerTimeZone,
    selectedDataItem,
    setSelectedDataItem,
  });

  /*
   * The geometry filter's own "pick a boundary" sub-workflow - see the
   * hook's own comment. Lives here beside the filter state it writes
   * into, so every page that renders the shared filter panel gets the
   * same sub-workflow without re-implementing it.
   */
  const filterBoundarySelection = useFilterBoundarySelection({
    filterState,
    setFilterState,
    currentPage,
  });

  // ─────────────────────────────────────────────
  // 🗺 Map (Mapbox)
  // ─────────────────────────────────────────────

  const [userColorTheme, setUserColorTheme] = useState(USER_ICON_THEMES.green);

  //Map defaults and react state persists outside the map instance, but kept in sync by map object
  const DEFAULT_EMPTY_CENTER = [20, 0];
  const DEFAULT_EMPTY_ZOOM = 1;
  const MAX_LNG_BOUNDS = isMobile ? 200 : 880;
  const MAX_LAT_BOUNDS = 85;
  const [mapCenter, setMapCenter] = useState(DEFAULT_EMPTY_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_EMPTY_ZOOM);
  const [mapBounds, setMapBounds] = useState(null);

  const [tileStyleKey, setTileStyleKey] = useState("Standard");

  const [minFitZoom, setMinFitZoom] = useState(1);
  const [maxFitZoom, setMaxFitZoom] = useState(TILE_STYLES.Standard.maxZoom);

  const [mapAction, setMapAction] = useState(null);

  // ─────────────────────────────────────────────
  // Data + Forms toolkits
  // ─────────────────────────────────────────────

  /*
   * Every engine used to hold identical copies of these. They live here
   * now because every engine has data items and forms - the runtime is
   * the same toolkit regardless of which engine is loaded.
   *
   * `forms` is the whole toolkit, and every engine gets all of it.
   *
   * Each engine runtime used to receive this as `globalForms` and
   * re-export a narrowed copy under the name `forms`. The narrowing
   * never earned its keep: no engine ever added a member of its own, so
   * every copy was a subset, and the widest of them dropped only two
   * entries. All it bought was five near-identical memos to keep in
   * step, and a member arriving as undefined rather than as itself -
   * a silent failure, not a guard.
   *
   * Handing every engine the full toolkit changes no behavior, because
   * the two call sites that read the dropped members cannot be reached
   * by the engines that dropped them: `injectDraftGeometry` is only read
   * by AddPanel.jsx, which only Editor.jsx renders (places and events),
   * and `createOnLatLngFinalized` is only read by EditPanel.jsx behind a
   * `geometry.type === "Point"` check that motion - locked to LineString
   * by its own engine rules - can never satisfy.
   */
  const dataUtils = useMemo(
    () => ({
      normalizeData,
      normalizeDataItem,
      updateDataItemInList,
      insertDataItemInList,
      removeDataItemFromList,
      removeDataItemsFromList,
      selectDataItemById,
      getPreviewText,
      buildAddPayloadFromForm,
      buildUpdatePayloadFromForm,
    }),
    [],
  );

  const forms = useMemo(
    () => ({
      blankFormFromSchema,
      populateBlankForm,
      injectCurrentLocation,
      injectCurrentDateTime,
      injectRequiredDefaults,
      injectLayer,
      injectDraftGeometry,
      reapplyTimezoneFromLatLng,
      createOnLatLngFinalized,
      getCenterCoordinates,
    }),
    [],
  );

  /*
   * Safe here rather than per engine: it already guards on a null schema
   * and re-keys on schema._id, so it simply yields null until a project
   * is loaded - which is what the per-engine copies were guarding
   * against by living downstream of the schema fetch.
   */
  const blankFormTemplate = useBlankFormTemplate(schema);

  //Map object to control the map instance - see src/map/hooks/useMapController.js
  const map = useMapController({
    mapCenter,
    setMapCenter,
    mapZoom,
    setMapZoom,
    mapBounds,
    setMapAction,
    minFitZoom,
    maxFitZoom,
    DEFAULT_EMPTY_CENTER,
    DEFAULT_EMPTY_ZOOM,
    MAX_LAT_BOUNDS,
    MAX_LNG_BOUNDS,
  });

  // ─────────────────────────────────────────────
  // 📍 Track Location Toggle
  // ─────────────────────────────────────────────
  const [userLocation, setUserLocation] = useState(null);
  const [trackLocation, setTrackLocation] = useState(false);
  const geoWatchIdRef = useRef(null);

  /*
   * Global apis. The three spatial ones sit here rather than in each
   * engine runtime because Boundaries, Layers and Aggregates are pages
   * on every engine now - MainApp merges this object under the active
   * engine’s own apis, so a consumer still reads apis.layersApi
   * regardless of which engine is open.
   */
  const apis = useMemo(
    () => ({
      projectApi: projectsApi,
      usersApi,
      layersApi,
      aggregatesApi,
      boundariesApi,
    }),
    [],
  );

  /*
   * Exporting, in the same shape as  above and passed down the
   * same way - but these are plain functions, not network calls.
   *
   * There is no export API any more. An export contains nothing the
   * browser was not already given (see src/exports/utils/
   * geoJSONExport.js), so a route only re-derived, from the database, a
   * file the client could assemble from state it legitimately held.
   * Removing them deleted the surface a script could have hit rather
   * than leaving it guarded - the read routes are still where access is
   * actually decided.
   *
   * Grouped here rather than imported per call site so a page asks
   * for one of these the way it asks for one of the apis, and so there
   * is one place to see everything this app can emit.
   */
  const exports = useMemo(
    () => ({
      project: exportProject,
      filteredProject: exportFilteredProject,
      layers: exportLayers,
      aggregates: exportAggregates,
      boundary: exportBoundary,
      boundaries: exportBoundaries,
    }),
    [],
  );

  return {
    ...spatialTools,
    insights,
    ...filterBoundarySelection,
    boundaries,
    setBoundaries,
    boundaryViewState,
    setBoundaryViewState,
    dataUtils /*Read-Only*/,
    forms /*Read-Only*/,
    blankFormTemplate /*Read-Only*/,
    // values + setters (explicit but readable)
    hasAdminClearance,
    projects,
    setProjects,
    publicProjects,
    setPublicProjects,
    sharedProjects,
    setSharedProjects,
    favouriteProjects,
    setFavouriteProjects,
    projectId,
    setProjectId,
    schema,
    setSchema,
    data,
    setData,
    filteredData,
    setFilteredData,
    selectedDataItem,
    setSelectedDataItem,
    viewerTimeZone,
    setViewerTimeZone,
    activeLayer,
    setActiveLayer,
    activeParentDataItemId,
    setActiveParentDataItemId,
    resetLayerContext,
    filterTimezoneMode,
    setFilterTimezoneMode,
    filterTimeZone,
    setFilterTimeZone,
    TIMEZONE_OPTIONS,
    filterState,
    setFilterState,
    filterStateReady,
    timeFilterOverride,
    setTimeFilterOverride,
    filterableInputs,
    activeFilters,
    blankFilterStateTemplate,
    clearFilters,
    mapCenter,
    setMapCenter,
    mapZoom,
    setMapZoom,
    mapBounds,
    setMapBounds,
    minFitZoom,
    setMinFitZoom,
    maxFitZoom,
    setMaxFitZoom,
    mapAction,
    setMapAction,
    tileStyleKey,
    setTileStyleKey,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    userLocation,
    setUserLocation,
    trackLocation,
    setTrackLocation,
    activeExtensionModal,
    setActiveExtensionModal,
    currentPage,
    setCurrentPage,
    userColorTheme,
    setUserColorTheme,
    map,
    apis,
    exports,
    // helpers / constants / refs
    USER_ICON_THEMES,
    TILE_STYLES,
    MAPBOX_TERRAIN_TOGGLE_STYLE_KEYS,
    MAPBOX_PROJECTION_TOGGLE_STYLE_KEYS,
    MAX_LAT_BOUNDS,
    MAX_LNG_BOUNDS,
    DEFAULT_EMPTY_CENTER,
    DEFAULT_EMPTY_ZOOM,
    geoWatchIdRef,
    onOpenExtension,
    //hasCoarsePointer,
    //hasFinePointer,
    //isSmallViewport,
    isMobile,
  };
}
