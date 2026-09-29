// src/map/mapbox/content/MotionMapContent.jsx

import { useMapboxMapInstance } from "../context/MapboxMapContext.jsx";

import MapboxMotionLayer from "../layers/MotionLayer.jsx";
import MapboxUserLayer from "../layers/UserLayer.jsx";

/*
 * Mapbox's motion content, rendered inside MapboxMapShell's
 * persistent map instance (read via context). Mounts/unmounts as the
 * active engine changes; the map instance itself (owned by the shell)
 * does not.
 */
export default function MotionMapContent({
  mapData,
  motionSamples,
  selectedDataItem,
  setSelectedDataItem,
  trackLocation,
  userColorTheme,
  dataUtils,
  schema,
  map,
  userLocation,
}) {
  const mapboxMap = useMapboxMapInstance();

  if (!mapboxMap) return null;

  return (
    <>
      <MapboxMotionLayer
        mapboxMap={mapboxMap}
        data={mapData}
        motionSamples={motionSamples}
        selectedDataItem={selectedDataItem}
        setSelectedDataItem={setSelectedDataItem}
        trackLocation={trackLocation}
        userColorTheme={userColorTheme}
        dataUtils={dataUtils}
        schema={schema}
        map={map}
      />

      <MapboxUserLayer
        mapboxMap={mapboxMap}
        userLocation={userLocation}
        trackLocation={trackLocation}
        userColorTheme={userColorTheme}
      />
    </>
  );
}
