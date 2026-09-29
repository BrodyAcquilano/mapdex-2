// src/map/mapbox/content/BoundaryToolMapContent.jsx

import { useMapboxMapInstance } from "../context/MapboxMapContext.jsx";
import BoundaryToolLayer from "../layers/BoundaryToolLayer.jsx";

/*
 * Mapbox counterpart to ../../leaflet/content/BoundaryToolMapContent.jsx -
 * see that file's own comment.
 */
export default function BoundaryToolMapContent({
  geometryTool,
  isDrawing,
  draftGeometry,
  setDraftGeometry,
  draftColors,
  system,
}) {
  const mapboxMap = useMapboxMapInstance();

  if (!mapboxMap) return null;

  return (
    <BoundaryToolLayer
      mapboxMap={mapboxMap}
      geometryTool={geometryTool}
      isDrawing={isDrawing}
      draftGeometry={draftGeometry}
      setDraftGeometry={setDraftGeometry}
      draftColors={draftColors}
      system={system}
    />
  );
}
