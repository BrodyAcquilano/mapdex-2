// src/map/MapShellHost.jsx

import { useEffect, useState } from "react";

import MapboxMapShell from "./mapbox/MapboxMapShell.jsx";
import MapStyleToggle from "./toggle/MapStyleToggle.jsx";
import MapboxTerrainToggles from "./toggle/MapboxTerrainToggles.jsx";

/*
 * One persistent Mapbox map instance for the whole app, created once
 * and kept alive for as long as this component stays mounted -
 * switching engines, projects, or tile styles never recreates it.
 * Only the active engine's content (its own layers and controllers)
 * mounts and unmounts on top of it.
 *
 * `hidden` (from MainApp.jsx) covers pages that don't display the map
 * at all (projects/community/profile/schema/account). It must only
 * ever hide the shell, never unmount this component or the shell
 * itself - MainApp renders MapShellHost unconditionally for exactly
 * that reason.
 *
 * Formerly hosted a second, parallel Leaflet shell (LeafletMapShell.jsx,
 * removed) alongside this one, switched between via a `mapPlan` user
 * preference and a runtime `selectedMapStyle` toggle - Brody's own
 * call to drop Leaflet entirely once Mapbox's own equalEarth
 * projection support made it possible to offer a proper 2D map without
 * a second rendering engine (see MapStyleToggle.jsx's own comment on
 * what replaced that old engine toggle).
 */
export default function MapShellHost({ runtime, system, engine, hidden }) {
  /*
   * addSubgeometry is cursor-wise a hybrid of the two groups below -
   * selecting an item with it works the same "click, get a pointer
   * cursor over selectable items" way every other edit tool does, but
   * once that selection converts the draft (draftGeometry becomes
   * non-null - see createAddSubgeometryDraft/GeometryLayer.jsx) it's
   * re-entered a draw-like "click empty space to add a vertex"
   * workflow that deserves the same crosshair cursor the plain draw
   * tools get, per Brody's own call. So it contributes to isDrawTool
   * (crosshair) only once something's selected, and to isEditTool
   * (default/pointer) only while nothing is - the two are mutually
   * exclusive for this one tool, same as everywhere else it behaves
   * like an edit tool right up until a selection starts an add.
   */
  const isAddSubgeometryTool = runtime.geometryTool === "addSubgeometry";
  const isAddSubgeometryDrawing = isAddSubgeometryTool && !!runtime.draftGeometry;

  const isDrawTool =
    runtime.geometryTool === "point" ||
    runtime.geometryTool === "line" ||
    runtime.geometryTool === "polygon" ||
    runtime.geometryTool === "multipoint" ||
    runtime.geometryTool === "multiline" ||
    runtime.geometryTool === "multipolygon" ||
    isAddSubgeometryDrawing;

  const isEditTool =
    runtime.geometryTool === "move" ||
    runtime.geometryTool === "moveGeometry" ||
    runtime.geometryTool === "midpoint" ||
    (isAddSubgeometryTool && !isAddSubgeometryDrawing) ||
    runtime.geometryTool === "remove" ||
    runtime.geometryTool === "removeSubgeometry";

  /*
   * The Boundaries page's own draw/edit tools (Draw Boundary/Move
   * Vertex/Move Boundary) hold one of these same draftGeometry.js tool
   * keys directly in boundaryTool - see src/workflows/Boundaries.jsx -
   * so they need their own crosshair/move-cursor classes here too, the
   * same way the places/events editor gets them from geometryTool/
   * isDrawing above. isDrawingBoundary is that page's counterpart to
   * isDrawing; Move Vertex/Move Boundary have no equivalent "not yet
   * drawing" phase (dragging is live the moment the tool and a boundary
   * are both selected), so those only ever need boundaryTool itself.
   *
   * This used to be hardcoded to currentPage === "aggregates" and
   * aggregatesActiveTool, which is why the Layers page's own boundary
   * tab never got a crosshair and drawing there felt dead. One page and
   * one piece of state now, so there is nothing left to keep in sync.
   */
  const isBoundaryDrawTool =
    runtime.currentPage === "boundaries" &&
    runtime.boundaryTool === "multipolygon" &&
    runtime.isDrawingBoundary;

  const isBoundaryEditTool =
    runtime.currentPage === "boundaries" &&
    (runtime.boundaryTool === "move" || runtime.boundaryTool === "moveGeometry");

  const extraClassName = `${
    (isDrawTool && runtime.isDrawing) || isBoundaryDrawTool ? "draw-tool" : ""
  } ${isEditTool || isBoundaryEditTool ? "move-tool" : ""}`;

  /*
   * Day/night + terrain + 2D/3D projection toggle state for whichever
   * of TILE_STYLES actually supports each one (MAPBOX_TERRAIN_TOGGLE_STYLE_KEYS/
   * MAPBOX_PROJECTION_TOGGLE_STYLE_KEYS - GlobalRuntime.jsx). Deliberately
   * not persisted anywhere - these controls disappear the moment the
   * active style stops supporting them, and Brody's explicit call was
   * to just reinitialize to day/terrain-on/3D rather than remember a
   * value there's no visible control for anymore.
   */
  const [mapboxLightPreset, setMapboxLightPreset] = useState("day");
  const [mapboxTerrainEnabled, setMapboxTerrainEnabled] = useState(true);
  const [mapboxProjectionMode, setMapboxProjectionMode] = useState("3d");

  useEffect(() => {
    setMapboxLightPreset("day");
    setMapboxTerrainEnabled(true);
    setMapboxProjectionMode("3d");
  }, [runtime.tileStyleKey]);

  const isTerrainToggleStyle =
    runtime.MAPBOX_TERRAIN_TOGGLE_STYLE_KEYS?.includes(runtime.tileStyleKey);

  const isProjectionToggleStyle =
    runtime.MAPBOX_PROJECTION_TOGGLE_STYLE_KEYS?.includes(runtime.tileStyleKey);

  return (
    <>
      {!hidden && isProjectionToggleStyle && (
        <MapStyleToggle
          is2D={mapboxProjectionMode === "2d"}
          setIs2D={(is2D) => setMapboxProjectionMode(is2D ? "2d" : "3d")}
          isMobile={runtime.isMobile}
        />
      )}

      {!hidden && isTerrainToggleStyle && (
        <MapboxTerrainToggles
          lightPreset={mapboxLightPreset}
          setLightPreset={setMapboxLightPreset}
          terrainEnabled={mapboxTerrainEnabled}
          setTerrainEnabled={setMapboxTerrainEnabled}
          terrainDisabled={mapboxProjectionMode === "2d"}
        />
      )}

      <MapboxMapShell
        runtime={runtime}
        system={system}
        hidden={hidden}
        extraClassName={extraClassName}
        mapboxLightPreset={mapboxLightPreset}
        mapboxTerrainEnabled={mapboxTerrainEnabled}
        mapboxProjectionMode={mapboxProjectionMode}
        ContentComponent={engine?.MapAdapter?.MapboxMapContent}
      />
    </>
  );
}
