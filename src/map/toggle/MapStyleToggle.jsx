// src/map/toggle/MapStyleToggle.jsx

import "./MapStyleToggle.css";

/*
 * Toggles the active Mapbox style's own projection live, between its
 * catalog default (globe, "3D") and equalEarth ("2D") - via
 * mapInstance.setProjection() alone (see useMapboxMap.js's own
 * projection-only fast path), never a style reload or a second map
 * instance. Rendered by MapShellHost only while the current tile
 * style is one of MAPBOX_PROJECTION_TOGGLE_STYLE_KEYS
 * (GlobalRuntime.jsx).
 *
 * Formerly switched the whole active map panel between a separate 2D
 * Leaflet engine and 3D Mapbox engine (selectedMapStyle/setSelectedMapStyle) -
 * Brody's own call to repurpose this exact same "2D/3D" toggle, in
 * place, for the new projection switch once Leaflet was removed,
 * rather than build a new control from scratch.
 */
export default function MapStyleToggle({ is2D, setIs2D, isMobile }) {
  const is3D = !is2D;

  const handleToggle = () => {
    setIs2D(is3D);
  };

  return (
    <div
      className={`map-style-toggle-container ${isMobile ? "is-mobile" : ""}`}
    >
      <button
        type="button"
        className={`map-style-toggle ${is3D ? "is-3d" : ""}`}
        onClick={handleToggle}
        aria-label="Toggle 3D map"
        aria-pressed={is3D}
      >
        <span className="map-style-toggle-label map-style-toggle-label-2d">
          2D
        </span>

        <span className="map-style-toggle-track">
          <span className="map-style-toggle-knob" />
        </span>

        <span className="map-style-toggle-label map-style-toggle-label-3d">
          3D
        </span>
      </button>
    </div>
  );
}
