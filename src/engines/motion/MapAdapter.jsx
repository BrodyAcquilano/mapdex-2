// src/engines/motion/MapAdapter.jsx

import { useEffect, useMemo } from "react";

import MapboxMotionMapContent from "../../map/mapbox/content/MotionMapContent.jsx";
import { useSpatialToolsMapContent } from "../../map/mapbox/content/SpatialToolsMapContent.jsx";

import "../../map/styles/MapPanel.css";

function useMotionMapData(runtime) {
  const mapData = useMemo(() => {
    const safeFilteredData = Array.isArray(runtime.filteredData)
      ? runtime.filteredData
      : [];

    if (runtime.currentPage !== "editor") {
      return safeFilteredData;
    }

    return safeFilteredData.filter(
      (dataItem) => dataItem?.userRole === "editor",
    );
  }, [runtime.filteredData, runtime.currentPage]);

  useEffect(() => {
    if (runtime.currentPage !== "editor") return;
    if (!runtime.selectedDataItem) return;
    if (runtime.selectedDataItem.userRole === "editor") return;

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

export function MapboxMapContent({ runtime, system }) {
  const mapData = useMotionMapData(runtime);

  /*
   * The Boundaries/Layers/Aggregates pages, which are not engine
   * specific at all - see src/map/mapbox/content/SpatialToolsMapContent.jsx.
   * null means none of them is what is on screen, and this engine own
   * content below takes over.
   */
  const spatialToolsContent = useSpatialToolsMapContent(runtime, system);

  if (spatialToolsContent) return spatialToolsContent;

  return (
    <MapboxMotionMapContent
      mapData={mapData}
      motionSamples={runtime.motionSamples}
      selectedDataItem={runtime.selectedDataItem}
      setSelectedDataItem={runtime.setSelectedDataItem}
      userLocation={runtime.userLocation}
      trackLocation={runtime.trackLocation}
      userColorTheme={runtime.userColorTheme}
      dataUtils={runtime.dataUtils}
      schema={runtime.schema}
      map={runtime.map}
    />
  );
}

const MapAdapter = { MapboxMapContent };

export default MapAdapter;
