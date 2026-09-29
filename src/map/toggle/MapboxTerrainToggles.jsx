// src/map/toggle/MapboxTerrainToggles.jsx

import { Sun, Moon, Mountain, Minus } from "lucide-react";

import "./MapboxTerrainToggles.css";

/*
 * Day/night and terrain switches for Mapbox's "Standard"/"Standard
 * Satellite" styles - both are runtime add-ons on the same style
 * (mapInstance.setConfigProperty/setTerrain, see useMapboxMap.js),
 * not separate style URLs the way Navigation Day/Night are, so a
 * switch fits better than doubling the catalog. Rendered by
 * MapShellHost only while Mapbox is the active renderer and one of
 * those two styles is selected - the state lives there too and is
 * deliberately not persisted (resets to day/terrain-on) whenever the
 * active style changes, since these controls disappear at the same
 * time and there's nothing meaningful to remember them for.
 */
export default function MapboxTerrainToggles({
  lightPreset,
  setLightPreset,
  terrainEnabled,
  setTerrainEnabled,
  terrainDisabled,
}) {
  /*
   * Day is the "on" (green, knob-right) state and the default -
   * green reads as positive/active, red as off, so day (the default)
   * gets the positive slot rather than night. Moon sits on the left
   * (the "off" side), sun on the right (the "on" side), so the icon
   * beside the knob always matches whichever state is active.
   */
  const isDay = lightPreset !== "night";

  return (
    <div className="mapbox-terrain-toggles-container">
      <button
        type="button"
        className={`mapbox-terrain-toggle ${isDay ? "is-on" : ""}`}
        onClick={() => setLightPreset(isDay ? "night" : "day")}
        aria-label="Toggle day/night lighting"
        aria-pressed={isDay}
      >
        <Moon className="mapbox-terrain-toggle-icon mapbox-terrain-toggle-icon-night" />

        <span className="mapbox-terrain-toggle-track">
          <span className="mapbox-terrain-toggle-knob" />
        </span>

        <Sun className="mapbox-terrain-toggle-icon mapbox-terrain-toggle-icon-day" />
      </button>

      {/*
       * Mountain sits on the right (the "on" side) so the icon is
       * always beside the knob when terrain is enabled, matching the
       * day/night toggle's icon-follows-the-active-side layout. The
       * left side has no real "off" icon to pair with it (there's no
       * obvious symbol for "no terrain"), so a plain flat line stands
       * in - purely to keep this toggle's icon-track-icon width
       * matching the day/night toggle above it, not meant to carry
       * its own meaning.
       */}
      <button
        type="button"
        className={`mapbox-terrain-toggle ${terrainEnabled && !terrainDisabled ? "is-on" : ""}`}
        onClick={() => setTerrainEnabled(!terrainEnabled)}
        disabled={terrainDisabled}
        aria-label="Toggle 3D terrain"
        aria-pressed={terrainEnabled && !terrainDisabled}
        title={terrainDisabled ? "3D terrain isn't available in 2D" : undefined}
      >
        <Minus className="mapbox-terrain-toggle-icon mapbox-terrain-toggle-icon-flat" />

        <span className="mapbox-terrain-toggle-track">
          <span className="mapbox-terrain-toggle-knob" />
        </span>

        <Mountain className="mapbox-terrain-toggle-icon mapbox-terrain-toggle-icon-static" />
      </button>
    </div>
  );
}
