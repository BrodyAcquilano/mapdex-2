// src/map/mapbox/content/GeometryMapContent.jsx

import { useMapboxMapInstance } from "../context/MapboxMapContext.jsx";
import { isEditingGeometryPosition } from "../../utils/isEditingGeometryPosition.js";

import MapboxGeometryLayer from "../layers/GeometryLayer.jsx";
import MapboxDrawLayer from "../layers/DrawLayer.jsx";
import MapboxUserLayer from "../layers/UserLayer.jsx";
import GeometryFilterLayer from "../layers/GeometryFilterLayer.jsx";

/*
 * Mapbox's places/events geometry content, rendered inside
 * MapboxMapShell's persistent map instance (read via context).
 * Mounts/unmounts as the active engine changes; the map instance
 * itself (owned by the shell) does not. Shared by both the places and
 * events engines, mirroring how a single MapboxGeometryMapPanel used
 * to serve both before this split.
 */
export default function GeometryMapContent({
  data,
  selectedDataItem,
  setSelectedDataItem,
  dataUtils,
  schema,
  geometryTool,
  isDrawing,
  isAddPanelOpen,
  geometryFilter,
  filterBoundaryGeometry,
  draftGeometry,
  setDraftGeometry,
  geometryEditHistory,
  setGeometryEditHistory,
  drawDraft,
  system,
  map,
  userLocation,
  trackLocation,
  userColorTheme,
}) {
  const mapboxMap = useMapboxMapInstance();

  const suspendLocationTracking = isEditingGeometryPosition({
    draftGeometry,
    selectedDataItem,
    isDrawing,
  });

  if (!mapboxMap) return null;

  return (
    <>
      {schema?.geometry?.isFilter === true && (
        <GeometryFilterLayer
          filterValue={geometryFilter}
          filterBoundaryGeometry={filterBoundaryGeometry}
        />
      )}

      <MapboxGeometryLayer
        mapboxMap={mapboxMap}
        data={data}
        selectedDataItem={selectedDataItem}
        setSelectedDataItem={setSelectedDataItem}
        dataUtils={dataUtils}
        schema={schema}
        geometryTool={geometryTool}
        draftGeometry={draftGeometry}
        setDraftGeometry={setDraftGeometry}
        system={system}
        map={map}
      />

      <MapboxDrawLayer
        mapboxMap={mapboxMap}
        geometryTool={geometryTool}
        isDrawing={isDrawing}
        isAddPanelOpen={isAddPanelOpen}
        draftGeometry={draftGeometry}
        setDraftGeometry={setDraftGeometry}
        geometryEditHistory={geometryEditHistory}
        setGeometryEditHistory={setGeometryEditHistory}
        drawDraft={drawDraft}
        system={system}
        selectedDataItem={selectedDataItem}
        schema={schema}
      />

      <MapboxUserLayer
        mapboxMap={mapboxMap}
        userLocation={userLocation}
        trackLocation={trackLocation}
        userColorTheme={userColorTheme}
        suspendTracking={suspendLocationTracking}
      />
    </>
  );
}
