// src/map/mapbox/content/PolygonsMapContent.jsx

import { useMapboxMapInstance } from "../context/MapboxMapContext.jsx";

import MapboxPolygonLayer from "../layers/PolygonLayer.jsx";
import MapboxAnalysisPolygonLayer from "../layers/AnalysisPolygonLayer.jsx";
import MapboxUserLayer from "../layers/UserLayer.jsx";
import GeometryFilterLayer from "../layers/GeometryFilterLayer.jsx";

/*
 * Mapbox's neighbourhoods (polygon) content, rendered inside
 * MapboxMapShell's persistent map instance (read via context).
 * Mounts/unmounts as the active engine changes; the map instance
 * itself (owned by the shell) does not.
 */
export default function PolygonsMapContent({
  filteredData,
  selectedDataItem,
  setSelectedDataItem,
  dataUtils,
  schema,
  geometryFilter,
  filterBoundaryGeometry,
  userLocation,
  trackLocation,
  userColorTheme,
  /*
   * Set by the neighbourhoods MapAdapter only while the Analysis page
   * is the current one AND an algorithm has actually produced a result
   * (see useAnalysisMapData there). Null on every other page and for
   * every other engine, which is what leaves the ordinary polygons in
   * place.
   */
  analysisResult,
}) {
  const mapboxMap = useMapboxMapInstance();

  if (!mapboxMap) return null;

  /*
   * Two distinct layers, and exactly one of them is mounted at a time.
   *
   * Mounting is what swaps them, not a paint change: each owns its own
   * Mapbox source and layer ids and removes them on unmount, so leaving
   * the Analysis page tears the choropleth down rather than leaving it
   * underneath the ordinary polygons in the persistent map instance.
   */
  const showAnalysisLayer = Boolean(analysisResult);

  return (
    <>
      {schema?.geometry?.isFilter === true && (
        <GeometryFilterLayer
          filterValue={geometryFilter}
          filterBoundaryGeometry={filterBoundaryGeometry}
        />
      )}

      {showAnalysisLayer ? (
        <MapboxAnalysisPolygonLayer
          mapboxMap={mapboxMap}
          data={filteredData}
          selectedDataItem={selectedDataItem}
          setSelectedDataItem={setSelectedDataItem}
          dataUtils={dataUtils}
          schema={schema}
          analysisResult={analysisResult}
        />
      ) : (
        <MapboxPolygonLayer
          mapboxMap={mapboxMap}
          data={filteredData}
          selectedDataItem={selectedDataItem}
          setSelectedDataItem={setSelectedDataItem}
          dataUtils={dataUtils}
          schema={schema}
        />
      )}

      <MapboxUserLayer
        mapboxMap={mapboxMap}
        userLocation={userLocation}
        trackLocation={trackLocation}
        userColorTheme={userColorTheme}
      />
    </>
  );
}
