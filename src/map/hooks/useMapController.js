// src/map/hooks/useMapController.js

import { useMemo } from "react";

import { TILE_STYLES } from "../tiles/tileStyles.js";

/*
 * The `map` object every page and engine uses to drive the map -
 * setCenter/setZoom/fitToData/focus and the read-only getters. Lifted
 * out of GlobalRuntime, which is where it grew; it belongs here because
 * it only moves the camera and reports map state, feeding no form or
 * draft (Brody's own rule for what counts as a map hook, as opposed to
 * the draw/edit tools that produce geometry and live under
 * src/forms/hooks and src/boundaries/hooks).
 *
 * It's a useMemo'd object of callbacks rather than a set of loose
 * functions because consumers put it in effect dependency arrays - see
 * the project memory note about never putting this object in a dep
 * array alongside a map.focus/flyTo call.
 */
export function useMapController({
  mapCenter,
  setMapCenter,
  mapZoom,
  setMapZoom,
  mapBounds,
  setMapAction,
  minFitZoom,
  maxFitZoom,
  DEFAULT_EMPTY_CENTER,
  DEFAULT_EMPTY_ZOOM,
  MAX_LAT_BOUNDS,
  MAX_LNG_BOUNDS,
}) {
  const map = useMemo(
    () => ({
      setCenter: (lat, lng) => {
        setMapCenter([lat, lng]);
        setMapAction({ type: "center", lat, lng });
      },

      setZoom: (zoom) => {
        setMapZoom(zoom);
        setMapAction({ type: "zoom", zoom });
      },

      flyTo: (lat, lng, duration) => {
        setMapCenter([lat, lng]);
        setMapAction({ type: "flyTo", lat, lng, duration });
      },

      focus: (lat, lng, id, duration) => {
        setMapCenter([lat, lng]);
        setMapAction({ type: "focus", lat, lng, id, duration });
      },

      closePopup: () => setMapAction({ type: "closePopup" }),

      openPopup: (id) => setMapAction({ type: "openPopup", id }),

      /*
       * fitToData/panNorth/panSouth/panEast/panWest are the only
       * actions whose own resulting center/zoom isn't already known by
       * the caller up front the way setCenter/flyTo/focus's own
       * lat/lng is (those three call setMapCenter directly, right
       * here, before the action even dispatches) - so these instead
       * hand setMapCenter/setMapZoom themselves through as part of the
       * action payload, for src/map/mapbox/controllers/MapActionController.jsx
       * (only mounted while the shell is actually visible - see
       * MapboxMapShell.jsx's own comment on why) to call once it
       * knows the real, settled result. Passed this
       * way - as data the action itself carries, the same way
       * DEFAULT_EMPTY_CENTER/DEFAULT_EMPTY_ZOOM already do below -
       * rather than as a standing prop on the controller, so a future
       * action never needs the controller itself to be threaded with
       * yet another prop it may not even use; it just carries
       * whatever it needs along with it, per Brody's own call.
       */
      fitToData: (data) => {
        setMapAction({
          type: "fitToData",
          data,
          DEFAULT_EMPTY_CENTER,
          DEFAULT_EMPTY_ZOOM,
          setMapCenter,
          setMapZoom,
        });
      },

      panNorth: () =>
        setMapAction({ type: "panNorth", fraction: 0.5, setMapCenter }),

      panSouth: () =>
        setMapAction({ type: "panSouth", fraction: 0.5, setMapCenter }),

      panEast: () =>
        setMapAction({ type: "panEast", fraction: 0.5, setMapCenter }),

      panWest: () =>
        setMapAction({ type: "panWest", fraction: 0.5, setMapCenter }),

      getCenter: () => mapCenter,
      getZoom: () => mapZoom,
      getBounds: () => mapBounds,

      getMinZoom: () => minFitZoom,
      getMaxZoom: () => maxFitZoom,

      getDefaultCenter: () => DEFAULT_EMPTY_CENTER,
      getDefaultZoom: () => DEFAULT_EMPTY_ZOOM,

      getMaxBounds: () => [
        [-MAX_LAT_BOUNDS, -MAX_LNG_BOUNDS],
        [MAX_LAT_BOUNDS, MAX_LNG_BOUNDS],
      ],

      getTileStyles: () => TILE_STYLES,
    }),
    [
      mapCenter,
      mapZoom,
      mapBounds,
      minFitZoom,
      maxFitZoom,
      MAX_LAT_BOUNDS,
      MAX_LNG_BOUNDS,
    ],
  );

  return map;
}
