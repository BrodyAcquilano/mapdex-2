// src/engines/presence/MapAdapter.jsx

import { useMemo } from "react";

import MapboxPresenceMapContent from "../../map/mapbox/content/PresenceMapContent.jsx";
import { useSpatialToolsMapContent } from "../../map/mapbox/content/SpatialToolsMapContent.jsx";

import "../../map/styles/MapPanel.css";

function getLayerOneData(data) {
  if (!Array.isArray(data)) return [];
  return data.filter((dataItem) => Number(dataItem?.layer || 1) === 1);
}

function usePresenceMapData(runtime) {
  return useMemo(() => {
    const layerOneData = getLayerOneData(runtime.filteredData);

    if (runtime.currentPage !== "editor") {
      return layerOneData;
    }

    if (!runtime.draftUser?._id) {
      return [];
    }

    const matchingDataItem = layerOneData.find(
      (item) => String(item._id) === String(runtime.draftUser._id),
    );

    return matchingDataItem ? [matchingDataItem] : [];
  }, [runtime.currentPage, runtime.filteredData, runtime.draftUser?._id]);
}

export function MapboxMapContent({ runtime, system }) {
  const mapData = usePresenceMapData(runtime);

  /*
   * The Boundaries/Layers/Aggregates pages, which are not engine
   * specific at all - see src/map/mapbox/content/SpatialToolsMapContent.jsx.
   * null means none of them is what is on screen, and this engine own
   * content below takes over.
   */
  const spatialToolsContent = useSpatialToolsMapContent(runtime, system);

  if (spatialToolsContent) return spatialToolsContent;

  return (
    <MapboxPresenceMapContent
      mapData={mapData}
      selectedDataItem={runtime.selectedDataItem}
      setSelectedDataItem={runtime.setSelectedDataItem}
      USER_ICON_THEMES={runtime.USER_ICON_THEMES}
      currentPage={runtime.currentPage}
      dataUtils={runtime.dataUtils}
      schema={runtime.schema}
      map={runtime.map}
    />
  );
}

/*
 * Presence's own "don't pause view-state syncing during trackLocation"
 * behavior (Leaflet's own PresenceMapViewTracker.jsx used to provide
 * this by omission - it had no trackLocation param or pause check at
 * all) already has full Mapbox parity - src/map/mapbox/controllers/
 * MapViewTracker.jsx's own `locksCameraToUser = trackLocation && engine
 * !== "presence"` check (engine === runtime.schema?.engineKey, passed
 * in by MapboxMapShell.jsx) means it never skips syncing for Presence
 * regardless of trackLocation, matching the old Leaflet-only tracker
 * exactly. No separate PresenceMapViewTracker equivalent needed here -
 * an earlier version of this comment incorrectly claimed this was a
 * gap without actually re-checking MapViewTracker.jsx's current code.
 */
const MapAdapter = { MapboxMapContent };

export default MapAdapter;
