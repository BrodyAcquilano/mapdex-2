import { useEffect, useMemo } from "react";

import MapboxGeometryMapContent from "../../map/mapbox/content/GeometryMapContent.jsx";
import { useSpatialToolsMapContent } from "../../map/mapbox/content/SpatialToolsMapContent.jsx";
import { excludeCorridorIneligibleData } from "../../layers/utils/computeLayerMembers.js";
import {
  resolveFilterBoundaryGeometry,
  buildBoundariesById,
} from "../../../shared/boundaries/filterBoundaryGeometry.js";

import "../../map/styles/MapPanel.css";

function getLayerScopedData(data, activeLayer, activeParentDataItemId) {
  if (!Array.isArray(data)) {
    return [];
  }

  const layer = Number(activeLayer || 1);

  if (layer === 2 && activeParentDataItemId) {
    return data.filter(
      (dataItem) =>
        Number(dataItem?.layer) === 2 &&
        String(dataItem?.parentDataItemId) === String(activeParentDataItemId),
    );
  }

  return data.filter((dataItem) => Number(dataItem?.layer || 1) === 1);
}

function useGeometryMapData(runtime) {
  const mapData = useMemo(() => {
    /*
     * While the boundary picker is open the map shows EVERY data item,
     * not the filtered set. The whole point of that step is judging
     * which items a candidate boundary would take in and which it would
     * leave out - and the filtered set is, by definition, already
     * narrowed by the boundary being replaced. Previewing Cambridge
     * while still looking at what Kitchener let through tells you
     * nothing.
     *
     * The draft boundary's own overlay is drawn on top of this (see
     * the geometryFilter prop below), so inside and outside are still
     * obvious - it is only the data underneath that stops being
     * pre-filtered.
     */
    const safeFilteredData = runtime.isSelectingFilterBoundary
      ? Array.isArray(runtime.data)
        ? runtime.data
        : []
      : Array.isArray(runtime.filteredData)
        ? runtime.filteredData
        : [];

    const layerScopedData = getLayerScopedData(
      safeFilteredData,
      runtime.activeLayer,
      runtime.activeParentDataItemId,
    );

    if (runtime.currentPage !== "editor") {
      /* See the matching comment in places/MapAdapter.jsx. */
      if (
        runtime.currentPage === "layers" &&
        runtime.addLayerClassification === "Corridor"
      ) {
        return excludeCorridorIneligibleData(layerScopedData);
      }

      return layerScopedData;
    }

    return layerScopedData.filter(
      (dataItem) => dataItem?.userRole === "editor",
    );
  }, [
    runtime.filteredData,
    runtime.data,
    runtime.isSelectingFilterBoundary,
    runtime.currentPage,
    runtime.addLayerClassification,
    runtime.activeLayer,
    runtime.activeParentDataItemId,
  ]);

  useEffect(() => {
    if (runtime.currentPage !== "editor") {
      return;
    }

    if (!runtime.selectedDataItem) {
      return;
    }

    if (runtime.selectedDataItem.userRole === "editor") {
      return;
    }

    runtime.setSelectedDataItem(null);
    runtime.setIsMiniGalleryOpen?.(false);
  }, [
    runtime.currentPage,
    runtime.selectedDataItem?._id,
    runtime.selectedDataItem?.userRole,
    runtime.setSelectedDataItem,
    runtime.setIsMiniGalleryOpen,
  ]);

  return mapData;
}

/*
 * See places/MapAdapter.jsx's matching comment - the Layers page's own
 * default list/stack view (LayersMapContent) vs. its admin-only "Add
 * Layer" tool (ordinary interactive GeometryMapContent, same as
 * Viewer).
 */
export function MapboxMapContent({ runtime, system }) {
  const mapData = useGeometryMapData(runtime);

  /*
   * The Boundaries/Layers/Aggregates pages, which are not engine
   * specific at all - see src/map/mapbox/content/SpatialToolsMapContent.jsx.
   * null means none of them is what is on screen, and this engine own
   * content below takes over.
   */
  const spatialToolsContent = useSpatialToolsMapContent(runtime, system);

  if (spatialToolsContent) return spatialToolsContent;

  return (
    <MapboxGeometryMapContent
      data={mapData}
      selectedDataItem={runtime.selectedDataItem}
      setSelectedDataItem={runtime.setSelectedDataItem}
      dataUtils={runtime.dataUtils}
      schema={runtime.schema}
      geometryTool={runtime.geometryTool}
      isDrawing={runtime.isDrawing}
      isAddPanelOpen={runtime.isAddPanelOpen}
      /*
       * While the boundary picker is open the overlay follows the
       * DRAFT, not the committed filter - the point of the picker is
       * seeing a pick before it is saved. Back discards the draft and
       * the overlay snaps back to whatever was committed.
       */
      geometryFilter={
        runtime.isSelectingFilterBoundary
          ? runtime.filterBoundaryDraft
          : runtime.filterState?.geometry
      }
      /*
       * Resolved here rather than in the layer: the filter stores only
       * a boundary id, and the boundaries list is runtime state the map
       * layer has no access to. Deliberately the FILTERING resolver, not
       * the drawing one - with nothing picked there is nothing to shade,
       * so an empty selection draws no overlay rather than shading the
       * whole world.
       */
      filterBoundaryGeometry={resolveFilterBoundaryGeometry(
        runtime.isSelectingFilterBoundary
          ? runtime.filterBoundaryDraft
          : runtime.filterState?.geometry,
        buildBoundariesById(runtime.boundaries),
      )}
      draftGeometry={runtime.draftGeometry}
      setDraftGeometry={runtime.setDraftGeometry}
      geometryEditHistory={runtime.geometryEditHistory}
      setGeometryEditHistory={runtime.setGeometryEditHistory}
      drawDraft={runtime.drawDraft}
      system={system}
      map={runtime.map}
      userLocation={runtime.userLocation}
      trackLocation={runtime.trackLocation}
      userColorTheme={runtime.userColorTheme}
    />
  );
}

const MapAdapter = { MapboxMapContent };

export default MapAdapter;
