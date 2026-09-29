// src/map/mapbox/icons/createUserMarkerElement.js

import "./UserIcon.css";

const DEFAULT_USER_COLOR_THEME = {
  pulseColor: "rgb(119, 188, 126)",
  fill: "rgba(26, 203, 53, 0.96)",
  stroke: "rgba(35, 98, 47, 0.8)",
};

/*
 * Builds the pulsing user-location marker element - originally just the
 * single track-location "you are here" marker (UserLayer.jsx), now also
 * reused directly for every live point on the Presence engine's own map
 * (PresenceLayer.jsx), where each presence data item IS someone's live
 * location the same way track-location's own single marker is. isSelected
 * scales the marker up slightly (mirrors the GL circle-layer's own former
 * `"circle-radius": ["case", ["get", "selected"], 10, 8]` selected-size
 * bump) - meaningless for the single always-unselected track-location
 * marker, so it defaults off.
 */
export function createUserMarkerElement(userColorTheme, { isSelected = false } = {}) {
  const { pulseColor, fill, stroke } = userColorTheme || DEFAULT_USER_COLOR_THEME;

  const wrapper = document.createElement("div");
  wrapper.className = `pulse-user-icon ${isSelected ? "pulse-user-icon-selected" : ""}`;

  wrapper.innerHTML = `
    <div class="pulse-marker">
      <div
        class="pulse-ring"
        style="background: radial-gradient(circle, ${pulseColor} 40%, transparent 70%);"
      ></div>
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="10" fill="${fill}" stroke="${stroke}" stroke-width="2" />
      </svg>
    </div>
  `;

  return wrapper;
}
