// src/map/mapbox/content/AggregatesMapContent.jsx

import { useMapboxMapInstance } from "../context/MapboxMapContext.jsx";
import AggregateShapesLayer from "../layers/AggregateShapesLayer.jsx";

/*
 * Mapbox counterpart to ../../leaflet/content/AggregatesMapContent.jsx -
 * see that file's own comment.
 */
export default function AggregatesMapContent({ items }) {
  const mapboxMap = useMapboxMapInstance();

  if (!mapboxMap) return null;

  return <AggregateShapesLayer mapboxMap={mapboxMap} items={items} />;
}
