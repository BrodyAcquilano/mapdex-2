// src/map/tiles/tileStyles.js

/*
 * The Mapbox style catalog and the two per-style toggle lists, lifted
 * out of GlobalRuntime - these are plain constants, not state, and
 * they're a large block that made the runtime harder to read.
 * GlobalRuntime re-exposes them on the runtime object unchanged.
 */


/*
 * All ten styles here are Mapbox's built-in "Core styles" -
 * available on every plan including free, since Mapbox bills by map
 * load count, not by which built-in style is used.
 *
 * minZoom/maxZoom are what src/map/mapbox/utils/useMapboxMap.js
 * passes straight into the mapboxgl.Map constructor - every style
 * lists its own, even though they're all 0/22 here, so this stays a
 * property of the style rather than something the map panel assumes.
 *
 * projection is each style's own DEFAULT (globe, for every style
 * currently in this catalog) - MAPBOX_PROJECTION_TOGGLE_STYLE_KEYS
 * below lists which of these can override it live via the 2D/3D
 * toggle (MapStyleToggle.jsx) without switching styles at all; see
 * MapShellHost.jsx's own comment on how that override is applied.
 *
 * lightPreset and terrain (Standard and Standard Satellite only)
 * aren't constructor options or even catalog-level fields - both are
 * runtime add-ons (mapInstance.setConfigProperty('basemap',
 * 'lightPreset', ...) / mapInstance.setTerrain(), see
 * useMapboxMap.js) driven by the day/night and terrain toggles
 * (MapboxTerrainToggles.jsx), which only render for these two
 * styles. See MAPBOX_TERRAIN_TOGGLE_STYLE_KEYS below.
 */
export const TILE_STYLES = {
  Standard: {
    styleUrl: "mapbox://styles/mapbox/standard",
    projection: "globe",
    minZoom: 0,
    maxZoom: 22,
  },

  "Standard Satellite": {
    styleUrl: "mapbox://styles/mapbox/standard-satellite",
    projection: "globe",
    minZoom: 0,
    maxZoom: 22,
  },

  Streets: {
    styleUrl: "mapbox://styles/mapbox/streets-v12",
    projection: "globe",
    minZoom: 0,
    maxZoom: 22,
  },

  Outdoors: {
    styleUrl: "mapbox://styles/mapbox/outdoors-v12",
    projection: "globe",
    minZoom: 0,
    maxZoom: 22,
  },

  Light: {
    styleUrl: "mapbox://styles/mapbox/light-v11",
    projection: "globe",
    minZoom: 0,
    maxZoom: 22,
  },

  Dark: {
    styleUrl: "mapbox://styles/mapbox/dark-v11",
    projection: "globe",
    minZoom: 0,
    maxZoom: 22,
  },

  Satellite: {
    styleUrl: "mapbox://styles/mapbox/satellite-v9",
    projection: "globe",
    minZoom: 0,
    maxZoom: 22,
  },

  "Satellite Streets": {
    styleUrl: "mapbox://styles/mapbox/satellite-streets-v12",
    projection: "globe",
    minZoom: 0,
    maxZoom: 22,
  },

  "Navigation Day": {
    styleUrl: "mapbox://styles/mapbox/navigation-day-v1",
    projection: "globe",
    minZoom: 0,
    maxZoom: 22,
  },

  "Navigation Night": {
    styleUrl: "mapbox://styles/mapbox/navigation-night-v1",
    projection: "globe",
    minZoom: 0,
    maxZoom: 22,
  },
};

/*
 * Which TILE_STYLES keys get the day/night + terrain toggles
 * (MapboxTerrainToggles.jsx) instead of being separate catalog
 * entries - unlike Navigation, whose day/night variants really are
 * different style IDs, Standard/Standard Satellite's lighting and
 * terrain are both runtime add-ons on the same style, so a switch
 * fits better than doubling the catalog for every combination.
 */
export const MAPBOX_TERRAIN_TOGGLE_STYLE_KEYS = ["Standard", "Standard Satellite"];

/*
 * Which TILE_STYLES keys get the 2D/3D projection toggle
 * (MapStyleToggle.jsx, repurposed from its old Leaflet/Mapbox-engine
 * role) - live-switches that one style's own projection between its
 * catalog default (globe, "3D") and equalEarth ("2D") without
 * reloading the style or recreating the map instance (see
 * useMapboxMap.js's own projection-only fast path). Starting with
 * just Standard, per Brody's own call - easy to extend to more
 * styles later by adding their keys here.
 */
export const MAPBOX_PROJECTION_TOGGLE_STYLE_KEYS = ["Standard"];
