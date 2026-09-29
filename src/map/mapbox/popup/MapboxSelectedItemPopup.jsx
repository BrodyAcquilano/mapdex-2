// src/map/mapbox/popup/MapboxSelectedItemPopup.jsx

import { useEffect, useState } from "react";

import PositionedPopup from "../../popup/PositionedPopup.jsx";
import { getRepresentativeLngLat } from "../../popup/getRepresentativeLngLat.js";

function getPreviewLines(dataUtils, schema, dataItem) {
  if (!dataUtils || !schema || !dataItem) return [];

  try {
    return (
      dataUtils.getPreviewText(schema.previewText, dataItem, schema) || []
    );
  } catch {
    return [];
  }
}

/*
 * Positions the shared PositionedPopup card for the selected data item
 * over the Mapbox map. Its screen position is recomputed from the
 * item's geo-coordinate via mapboxMap.project() every time the map
 * moves, so it tracks the marker the way a native popup would -
 * Mapbox has no popup positioning of its own to reuse here, unlike
 * Leaflet (see LeafletSelectedItemPopup.jsx, which does the same job
 * with Leaflet's own projection API so both engines behave the same).
 *
 * This is rendered as a sibling of the map's container div inside the
 * same position:relative map panel, so mapboxMap.project()'s pixel
 * coordinates (relative to the map container's top-left corner) line
 * up directly with this element's own left/top.
 *
 * Popup visibility is tracked separately from selection: closing the
 * popup (the x button) only hides it, it doesn't deselect the item -
 * you may still want the map visible behind it (editing in the edit
 * panel) or need to click a vertex the popup happens to be covering
 * without losing the in-progress move. Selecting a *different* item
 * always shows a fresh popup regardless of whether the previous one
 * was closed.
 */
export default function MapboxSelectedItemPopup({
  mapboxMap,
  selectedDataItem,
  getGeometry,
  getCentroid,
  getHeaderText,
  dataUtils,
  schema,
  enabled = true,
}) {
  const [point, setPoint] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(true);

  useEffect(() => {
    setIsPopupOpen(true);
  }, [selectedDataItem?._id]);

  const lngLat =
    enabled && selectedDataItem
      ? getRepresentativeLngLat(
          getGeometry(selectedDataItem),
          getCentroid?.(selectedDataItem),
        )
      : null;

  const lng = lngLat?.[0];
  const lat = lngLat?.[1];

  useEffect(() => {
    if (!mapboxMap || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      setPoint(null);
      return;
    }

    const updatePoint = () => {
      const projected = mapboxMap.project([lng, lat]);
      setPoint({ x: projected.x, y: projected.y });
    };

    updatePoint();

    mapboxMap.on("move", updatePoint);

    return () => {
      mapboxMap.off("move", updatePoint);
    };
  }, [mapboxMap, lng, lat]);

  if (!point || !selectedDataItem || !isPopupOpen) return null;

  return (
    <PositionedPopup
      x={point.x}
      y={point.y}
      headerText={getHeaderText?.(selectedDataItem)}
      lines={getPreviewLines(dataUtils, schema, selectedDataItem)}
      onClose={() => setIsPopupOpen(false)}
    />
  );
}
