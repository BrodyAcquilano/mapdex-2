// src/engines/neighbourhoods/MapAdapter.jsx

import { useEffect, useMemo } from "react";

import MapboxPolygonsMapContent from "../../map/mapbox/content/PolygonsMapContent.jsx";
import { useSpatialToolsMapContent } from "../../map/mapbox/content/SpatialToolsMapContent.jsx";
import {
  resolveFilterBoundaryGeometry,
  buildBoundariesById,
} from "../../../shared/boundaries/filterBoundaryGeometry.js";

import "../../map/styles/MapPanel.css";

function getLayerScopedData(data, activeLayer, activeParentDataItemId) {
  if (!Array.isArray(data)) return [];

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

function usePolygonsMapData(runtime) {
  const mapData = useMemo(() => {
    const safeFilteredData = Array.isArray(runtime.filteredData)
      ? runtime.filteredData
      : [];

    const layerScopedData = getLayerScopedData(
      safeFilteredData,
      runtime.activeLayer,
      runtime.activeParentDataItemId,
    );

    if (runtime.currentPage !== "editor") {
      return layerScopedData;
    }

    return layerScopedData.filter(
      (dataItem) => dataItem?.userRole === "editor",
    );
  }, [
    runtime.filteredData,
    runtime.currentPage,
    runtime.activeLayer,
    runtime.activeParentDataItemId,
  ]);

  useEffect(() => {
    if (runtime.currentPage !== "editor") return;
    if (!runtime.selectedDataItem) return;
    if (runtime.selectedDataItem.userRole === "editor") return;

    runtime.setSelectedDataItem(null);
  }, [
    runtime.currentPage,
    runtime.selectedDataItem?._id,
    runtime.selectedDataItem?.userRole,
    runtime.setSelectedDataItem,
  ]);

  return mapData;
}

/*
 * The Analysis page's choropleth, or null for "not this page's
 * concern" - the same contract the spatial tool pages' own map hooks
 * use.
 *
 * Both conditions matter. currentPage alone is not enough: an
 * algorithm that has not run, or cannot run against the current
 * schema, yields a null result, and rendering the analysis layer then
 * would paint every zone in the missing-data grey rather than showing
 * the ordinary polygons the page still sits over.
 */
function useAnalysisMapData(runtime) {
  return useMemo(() => {
    if (runtime.currentPage !== "analysis") return null;
    if (!(runtime.analysisResult?.byId instanceof Map)) return null;

    return runtime.analysisResult;
  }, [runtime.currentPage, runtime.analysisResult]);
}

export function MapboxMapContent({ runtime, system }) {
  const mapData = usePolygonsMapData(runtime);
  const analysisResult = useAnalysisMapData(runtime);

  /*
   * The Boundaries/Layers/Aggregates pages, which are not engine
   * specific at all - see src/map/mapbox/content/SpatialToolsMapContent.jsx.
   * null means none of them is what is on screen, and this engine own
   * content below takes over.
   */
  const spatialToolsContent = useSpatialToolsMapContent(runtime, system);

  if (spatialToolsContent) return spatialToolsContent;

  return (
    <MapboxPolygonsMapContent
      filteredData={mapData}
      selectedDataItem={runtime.selectedDataItem}
      setSelectedDataItem={runtime.setSelectedDataItem}
      dataUtils={runtime.dataUtils}
      schema={runtime.schema}
      /*
       * While the boundary picker is open the overlay follows the
       * DRAFT, not the committed filter - the point of the picker is
       * seeing a pick before it is saved.
       */
      geometryFilter={
        runtime.isSelectingFilterBoundary
          ? runtime.filterBoundaryDraft
          : runtime.filterState?.geometry
      }
      /*
       * Resolved here rather than in the layer: the filter stores only
       * a boundary id, and the boundaries list is runtime state the map
       * layer has no access to. Deliberately the FILTERING resolver -
       * with nothing picked there is nothing to shade.
       */
      filterBoundaryGeometry={resolveFilterBoundaryGeometry(
        runtime.isSelectingFilterBoundary
          ? runtime.filterBoundaryDraft
          : runtime.filterState?.geometry,
        buildBoundariesById(runtime.boundaries),
      )}
      userLocation={runtime.userLocation}
      trackLocation={runtime.trackLocation}
      userColorTheme={runtime.userColorTheme}
      analysisResult={analysisResult}
    />
  );
}

const MapAdapter = { MapboxMapContent };

export default MapAdapter;
