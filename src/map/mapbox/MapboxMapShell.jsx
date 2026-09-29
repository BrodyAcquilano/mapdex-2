// src/map/mapbox/MapboxMapShell.jsx

import { useEffect } from "react";

import { useMapboxMap } from "./utils/useMapboxMap.js";
import MapViewTracker from "./controllers/MapViewTracker.jsx";
import MapActionController from "./controllers/MapActionController.jsx";
import VisibilityController from "./controllers/VisibilityController.jsx";
import { MapboxMapProvider } from "./context/MapboxMapContext.jsx";

import "../styles/MapPanel.css";
import "./styles/MapPanel.css";

/*
 * The single, session-persistent Mapbox map instance for the whole
 * app - created once and never torn down while this component stays
 * mounted. Switching engines, projects, or tile styles never
 * recreates it; only the active engine's content (ContentComponent)
 * mounts and unmounts on top of it. `hidden` covers pages that don't
 * display the map at all (see MapShellHost.jsx's own comment).
 */
/*
 * Only matters while the terrain toggle is on - not configurable yet,
 * per Brody's own testing call ("1.5x exaggeration is perfect").
 */
const TERRAIN_EXAGGERATION = 1.5;

export default function MapboxMapShell({
  runtime,
  system,
  hidden,
  extraClassName,
  mapboxLightPreset,
  mapboxTerrainEnabled,
  mapboxProjectionMode,
  ContentComponent,
}) {
  const activeTileStyle = runtime.TILE_STYLES?.[runtime.tileStyleKey] || runtime.TILE_STYLES?.Standard;

  /*
   * lightPreset/terrain aren't catalog fields - Standard/Standard
   * Satellite are the only styles that support either, and both are
   * driven by MapShellHost's day/night + terrain toggle state
   * (MapboxTerrainToggles.jsx) rather than being fixed per style.
   */
  const isTerrainToggleStyle = runtime.MAPBOX_TERRAIN_TOGGLE_STYLE_KEYS?.includes(
    runtime.tileStyleKey,
  );

  const isProjectionToggleStyle = runtime.MAPBOX_PROJECTION_TOGGLE_STYLE_KEYS?.includes(
    runtime.tileStyleKey,
  );

  /*
   * "day" must be an explicit lightPreset value here, not null/auto -
   * useMapboxMap.js only ever calls setConfigProperty when this is
   * truthy, so mapping "back to day" to null (meaning "no explicit
   * value") meant nothing ever actually reset the basemap off
   * "night" once it had been set. Both toggle states need to be
   * explicit for the switch to work in both directions.
   */
  const effectiveLightPreset = isTerrainToggleStyle
    ? mapboxLightPreset === "night"
      ? "night"
      : "day"
    : null;

  /*
   * 3D terrain isn't supported outside Globe/Mercator (Mapbox's own
   * documented restriction), so it's forced off here regardless of
   * the toggle's own state whenever the 2D projection override is
   * active - MapShellHost.jsx already disables the terrain toggle's
   * own button in that case too, this is just the same rule enforced
   * again at the point it actually matters.
   */
  const effectiveTerrain =
    isTerrainToggleStyle && !!mapboxTerrainEnabled && mapboxProjectionMode !== "2d";

  /*
   * The 2D override (equalEarth) replaces this style's own catalog
   * default (globe) live, via mapInstance.setProjection() alone - see
   * useMapboxMap.js's own projection-only fast path, which applies
   * this without a style reload or recreating the map instance.
   */
  const effectiveProjection =
    isProjectionToggleStyle && mapboxProjectionMode === "2d"
      ? "equalEarth"
      : activeTileStyle?.projection;

  /*
   * A themed background color behind the map canvas - the Mapbox
   * counterpart to Leaflet's old per-style `waterColor` (visible
   * before tiles finish loading, and at the edges of a flat 2D
   * projection where there's map beyond the rendered bounds; a 3D
   * globe already renders its own space/void natively, so this is
   * only meaningful for styles that offer the 2D override -
   * isProjectionToggleStyle again). Only Standard has one defined so
   * far (day/night variants, since its day/night lightPreset already
   * changes independently of the projection toggle) - the actual color
   * values live in src/map/mapbox/styles/MapPanel.css, keyed off this
   * same className. Deliberately hardcoded rather
   * than a generic per-style-and-preset config in the TILE_STYLES
   * catalog, per Brody's own call - there's only ever going to be a
   * handful of these.
   */
  const mapPanelBackgroundClassName = isProjectionToggleStyle
    ? `${runtime.tileStyleKey.toLowerCase().replace(/\s+/g, "-")}-${
        effectiveLightPreset === "night" ? "night" : "day"
      }`
    : "";

  const { mapContainerRef, mapboxMap } = useMapboxMap({
    mapCenter: runtime.mapCenter,
    mapZoom: runtime.mapZoom,
    DEFAULT_EMPTY_CENTER: runtime.DEFAULT_EMPTY_CENTER,
    DEFAULT_EMPTY_ZOOM: runtime.DEFAULT_EMPTY_ZOOM,
    mapboxStyleUrl: activeTileStyle?.styleUrl,
    mapboxProjection: effectiveProjection,
    mapboxMinZoom: activeTileStyle?.minZoom,
    mapboxMaxZoom: activeTileStyle?.maxZoom,
    mapboxLightPreset: effectiveLightPreset,
    mapboxTerrain: effectiveTerrain,
    mapboxTerrainExaggeration: TERRAIN_EXAGGERATION,
  });

  /*
   * Generic map voice commands (zoom, pan, fit to data, popups, clear
   * selection) - registered once here rather than per engine, since
   * none of them are actually engine-specific (they only ever touch
   * the shared `map` object and setSelectedDataItem). See
   * src/system/voice/commands/mapCommands.js.
   */
  useEffect(() => {
    const cleanupVoice = system.registerVoiceCommands("map", {
      map: runtime.map,
      data: runtime.filteredData,
      selectedDataItem: runtime.selectedDataItem,
      setSelectedDataItem: runtime.setSelectedDataItem,
      system,
    });

    return () => {
      cleanupVoice();
    };
  }, [
    system,
    runtime.map,
    runtime.filteredData,
    runtime.selectedDataItem,
    runtime.setSelectedDataItem,
  ]);

  /*
   * VisibilityController/MapActionController/MapViewTracker are only
   * mounted at all while this shell is actually visible (and, for
   * VisibilityController/MapActionController, only once mapboxMap
   * itself exists) - per Brody's own call, rather than staying always-
   * mounted and internally skipping their own work while hidden. This
   * is what stops a fitToData/pan* dispatched while the map is hidden
   * (a non-map page) from ever being processed against this instance's
   * own hidden, effectively zero-sized container. Mounting
   * VisibilityController this way also replaces its own former
   * wasHiddenRef/needsSyncRef tracking (now living in that component's
   * own file): its mount IS the "just became visible and usable"
   * signal, so there's no transition to detect from the outside
   * anymore, and no deferred/queued state that could still be pending
   * by the time some other effect races it.
   */
  return (
    <div
      className={`map-panel mapbox-map-panel ${extraClassName || ""} ${mapPanelBackgroundClassName}`}
      hidden={hidden}
      aria-hidden={hidden}
    >
      <div ref={mapContainerRef} className="mapbox-map-container" />

      {!hidden && mapboxMap && (
        <>
          <VisibilityController
            mapboxMap={mapboxMap}
            mapCenter={runtime.mapCenter}
            mapZoom={runtime.mapZoom}
          />

          <MapActionController
            mapboxMap={mapboxMap}
            mapAction={runtime.mapAction}
            setMapAction={runtime.setMapAction}
          />

          <MapViewTracker
            mapboxMap={mapboxMap}
            setMapCenter={runtime.setMapCenter}
            setMapZoom={runtime.setMapZoom}
            setMapBounds={runtime.setMapBounds}
            trackLocation={runtime.trackLocation}
            engine={runtime.schema?.engineKey}
          />
        </>
      )}

      {mapboxMap && ContentComponent && (
        <MapboxMapProvider mapboxMap={mapboxMap}>
          <ContentComponent runtime={runtime} system={system} />
        </MapboxMapProvider>
      )}
    </div>
  );
}
