// src/map/mapbox/icons/createVertexMarkerElement.js

import "./VertexMarker.css";

function isValidHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/*
 * Builds the small draft-vertex handle DOM element for a line/polygon
 * being drawn, moved, or edited with the remove-point/add-midpoint
 * tools, playing the same role Leaflet's createVertexIcon
 * (src/map/leaflet/layers/DrawLayer.jsx) does for a react-leaflet
 * <Marker icon=.../> - handed instead to `new mapboxgl.Marker({
 * element })`.
 *
 * isClickable marks a vertex that responds to a click rather than a
 * drag (the remove-point/add-midpoint tools). isPrimarySelected is
 * the add-midpoint tool's first-picked vertex for its two-click
 * gesture: enlarged, with a thinner border in the draft's own
 * line/border color (primarySelectedColor), so it reads as "this is
 * the point you've chosen to connect a midpoint from" rather than
 * just another plain vertex.
 */
export function createVertexMarkerElement({
  isStartVertex = false,
  isMoving = false,
  isClickable = false,
  isPrimarySelected = false,
  primarySelectedColor,
} = {}) {
  const element = document.createElement("div");

  element.className = `mapdex-mapbox-vertex-marker-hitbox ${
    isMoving ? "mapdex-mapbox-vertex-marker-move-hitbox" : ""
  } ${isClickable ? "mapdex-mapbox-vertex-marker-clickable-hitbox" : ""}`;

  const dot = document.createElement("div");

  dot.className = `mapdex-mapbox-vertex-marker ${
    isStartVertex ? "mapdex-mapbox-vertex-marker-start" : ""
  } ${isPrimarySelected ? "mapdex-mapbox-vertex-marker-primary-selected" : ""}`;

  if (isPrimarySelected) {
    dot.style.borderColor = isValidHexColor(primarySelectedColor)
      ? primarySelectedColor
      : "#2563eb";
  }

  element.appendChild(dot);

  return element;
}
