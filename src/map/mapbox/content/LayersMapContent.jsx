// src/map/mapbox/content/LayersMapContent.jsx

import { useMapboxMapInstance } from "../context/MapboxMapContext.jsx";
import LayersGeometryLayer from "../layers/LayersGeometryLayer.jsx";

/*
 * Mapbox counterpart to ../../leaflet/content/LayersMapContent.jsx -
 * see that file's own comment for why this exists as a separate
 * content pair from GeometryMapContent instead of extending it.
 */
export default function LayersMapContent({
  layers,
  data,
  schema,
  filterTimeZone,
  showDataLayer,
  dataLayerOpacity,
  boundaries,
}) {
  const mapboxMap = useMapboxMapInstance();

  if (!mapboxMap) return null;

  return (
    <LayersGeometryLayer
      mapboxMap={mapboxMap}
      layers={layers}
      data={data}
      schema={schema}
      filterTimeZone={filterTimeZone}
      showDataLayer={showDataLayer}
      dataLayerOpacity={dataLayerOpacity}
      boundaries={boundaries}
    />
  );
}
