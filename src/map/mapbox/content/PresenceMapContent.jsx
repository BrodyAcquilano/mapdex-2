// src/map/mapbox/content/PresenceMapContent.jsx

import { useMapboxMapInstance } from "../context/MapboxMapContext.jsx";

import MapboxPresenceLayer from "../layers/PresenceLayer.jsx";

/*
 * Mapbox's presence content, rendered inside MapboxMapShell's
 * persistent map instance (read via context). Mounts/unmounts as the
 * active engine changes; the map instance itself (owned by the shell)
 * does not.
 */
export default function PresenceMapContent({
  mapData,
  selectedDataItem,
  setSelectedDataItem,
  USER_ICON_THEMES,
  currentPage,
  dataUtils,
  schema,
  map,
}) {
  const mapboxMap = useMapboxMapInstance();

  if (!mapboxMap) return null;

  return (
    <MapboxPresenceLayer
      mapboxMap={mapboxMap}
      map={map}
      data={mapData}
      selectedDataItem={selectedDataItem}
      setSelectedDataItem={setSelectedDataItem}
      USER_ICON_THEMES={USER_ICON_THEMES}
      currentPage={currentPage}
      dataUtils={dataUtils}
      schema={schema}
    />
  );
}
