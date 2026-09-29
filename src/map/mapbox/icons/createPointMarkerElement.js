// src/map/mapbox/icons/createPointMarkerElement.js

import "./PointMarker.css";

export const DEFAULT_POINT_FILL_COLOR = "#3b82f6";
export const DEFAULT_POINT_BORDER_COLOR = "#1d4ed8";

/*
 * Builds the small colored-circle DOM element used for the draft
 * Point marker. mapboxgl.Marker takes a real DOM element (unlike
 * Leaflet's icon-based Markers), so this plays the same role
 * src/map/leaflet/icons/PointIcon.jsx's createPointIcon does, just
 * handed to `new mapboxgl.Marker({ element })` instead of a
 * react-leaflet <Marker icon=.../>. The draft point is always shown
 * in its "selected" look, matching how the Leaflet draft layer always
 * passes isSelected: true for it.
 */
export function createPointMarkerElement({
  fillColor = DEFAULT_POINT_FILL_COLOR,
  borderColor = DEFAULT_POINT_BORDER_COLOR,
  isMoving = false,
} = {}) {
  const element = document.createElement("div");

  element.className = `mapdex-mapbox-point-marker ${
    isMoving ? "mapdex-mapbox-point-marker-move" : ""
  }`;

  element.style.backgroundColor = fillColor;
  element.style.borderColor = borderColor;
  return element;
}
