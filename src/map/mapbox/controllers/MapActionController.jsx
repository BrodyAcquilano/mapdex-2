// src/map/mapbox/controllers/MapActionController.jsx

import { useEffect } from "react";
import { computeFlyDuration } from "../utils/computeFlyDuration.js";

function isFiniteCoordinatePair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return false;
  return Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]));
}

/*
 * Collects [lng, lat] pairs across Point/LineString/Polygon geometry
 * for "fitToData". Mapbox geometry coordinates are already [lng, lat],
 * so unlike the Leaflet version this needs no axis flip.
 */
function collectFitLngLats(data) {
  const points = [];

  for (const dataItem of data || []) {
    const geometry = dataItem?.geometry;
    const geometryType = geometry?.type;

    if (geometryType === "Point") {
      if (isFiniteCoordinatePair(geometry.coordinates)) {
        points.push(geometry.coordinates);
      }
      continue;
    }

    if (geometryType === "LineString") {
      const coordinates = geometry?.coordinates;
      if (!Array.isArray(coordinates)) continue;

      for (const pair of coordinates) {
        if (isFiniteCoordinatePair(pair)) points.push(pair);
      }
      continue;
    }

    if (geometryType === "Polygon") {
      const outerRing = geometry?.coordinates?.[0];
      if (!Array.isArray(outerRing)) continue;

      for (const pair of outerRing) {
        if (isFiniteCoordinatePair(pair)) points.push(pair);
      }
      continue;
    }

    if (geometryType === "MultiPoint") {
      const coordinates = geometry?.coordinates;
      if (!Array.isArray(coordinates)) continue;

      for (const pair of coordinates) {
        if (isFiniteCoordinatePair(pair)) points.push(pair);
      }
      continue;
    }

    if (geometryType === "MultiLineString") {
      const lines = geometry?.coordinates;
      if (!Array.isArray(lines)) continue;

      for (const line of lines) {
        if (!Array.isArray(line)) continue;

        for (const pair of line) {
          if (isFiniteCoordinatePair(pair)) points.push(pair);
        }
      }
      continue;
    }

    if (geometryType === "MultiPolygon") {
      const polygons = geometry?.coordinates;
      if (!Array.isArray(polygons)) continue;

      for (const polygon of polygons) {
        const outerRing = polygon?.[0];
        if (!Array.isArray(outerRing)) continue;

        for (const pair of outerRing) {
          if (isFiniteCoordinatePair(pair)) points.push(pair);
        }
      }
      continue;
    }
  }

  return points;
}

/*
 * Interprets the same `mapAction` shape the shared runtime `map`
 * object (see src/runtime/GlobalRuntime.jsx) writes for Leaflet's own
 * MapActionController.jsx, but drives a Mapbox GL map instead. This is
 * what makes existing callers of map.focus/flyTo/fitToData/pan*
 * (voice commands, forms, etc.) keep working once a Mapbox panel is
 * the active map.
 *
 * A real component now, not a hook - mirrors Leaflet's own
 * MapActionController.jsx exactly. MapboxMapShell.jsx only mounts this
 * at all while this shell is actually the visible one (see that
 * file's own comment) - so a fitToData/pan* dispatched while Mapbox is
 * hidden is never processed against this instance's own hidden,
 * effectively zero-sized container. It's left alone for whichever
 * shell IS visible to process and write mapCenter/mapZoom from, and
 * this one catches up via VisibilityController.jsx's own reveal resync
 * the next time it's shown again - rather than both shells racing to
 * independently compute a result and write the same shared state,
 * which is what used to make switching engines land somewhere wrong.
 *
 * Popups are our own component (MapboxSelectedItemPopup), driven by
 * selectedDataItem plus its own local open/closed state, not by this
 * action - so the openPopup/closePopup cases are no-ops here.
 */
export default function MapActionController({
  mapboxMap,
  mapAction,
  setMapAction,
}) {
  useEffect(() => {
    if (!mapboxMap || !mapAction) return;

    const flyWithSmartDuration = (lat, lng, overrideDurationSeconds) => {
      const durationMs =
        typeof overrideDurationSeconds === "number"
          ? overrideDurationSeconds * 1000
          : computeFlyDuration(mapboxMap, lat, lng) * 1000;

      mapboxMap.flyTo({ center: [lng, lat], duration: durationMs });
    };

    /*
     * setMapCenter is passed in by the caller as part of the action
     * itself (GlobalRuntime.jsx's own map.panNorth/panSouth/panEast/
     * panWest), not as a standing prop on this component - see that
     * file's own comment on why.
     */
    const panByViewportFraction = (direction, fraction = 0.5, setMapCenter) => {
      const bounds = mapboxMap.getBounds();
      const center = mapboxMap.getCenter();

      const latSpan = bounds.getNorth() - bounds.getSouth();
      const lngSpan = bounds.getEast() - bounds.getWest();

      let nextLat = center.lat;
      let nextLng = center.lng;

      if (direction === "north") nextLat += latSpan * fraction;
      if (direction === "south") nextLat -= latSpan * fraction;
      if (direction === "east") nextLng += lngSpan * fraction;
      if (direction === "west") nextLng -= lngSpan * fraction;

      mapboxMap.jumpTo({ center: [nextLng, nextLat] });

      /*
       * Reads the settled center straight back off the map (this
       * instance has no maxBounds today, so it should always match
       * nextLat/nextLng exactly, but reading it back rather than
       * trusting the just-computed value stays correct even if that
       * ever changes) and syncs it into React state, keeping mapCenter
       * in sync the same way center/flyTo/focus already are.
       */
      const settledCenter = mapboxMap.getCenter();
      setMapCenter?.([settledCenter.lat, settledCenter.lng]);
    };

    switch (mapAction.type) {
      case "focus": {
        const { lat, lng, duration } = mapAction;
        flyWithSmartDuration(lat, lng, duration);
        break;
      }

      case "flyTo": {
        const { lat, lng, duration } = mapAction;
        flyWithSmartDuration(lat, lng, duration);
        break;
      }

      case "closePopup":
      case "openPopup": {
        // No-op: Mapbox geometry layers don't have popups yet.
        break;
      }

      case "zoom": {
        mapboxMap.setZoom(mapAction.zoom);
        break;
      }

      case "center": {
        const { lat, lng } = mapAction;
        mapboxMap.setCenter([lng, lat]);
        break;
      }

      case "panNorth": {
        panByViewportFraction("north", mapAction.fraction, mapAction.setMapCenter);
        break;
      }

      case "panSouth": {
        panByViewportFraction("south", mapAction.fraction, mapAction.setMapCenter);
        break;
      }

      case "panEast": {
        panByViewportFraction("east", mapAction.fraction, mapAction.setMapCenter);
        break;
      }

      case "panWest": {
        panByViewportFraction("west", mapAction.fraction, mapAction.setMapCenter);
        break;
      }

      case "fitToData": {
        const {
          data,
          DEFAULT_EMPTY_CENTER,
          DEFAULT_EMPTY_ZOOM,
          setMapCenter,
          setMapZoom,
        } = mapAction;
        const points = collectFitLngLats(data);

        /*
         * Same reasoning as Leaflet's own MapActionController.jsx:
         * fitBounds/jumpTo both size and center themselves against
         * Mapbox's own cached canvas size, which it only refreshes on
         * a window resize event or an explicit resize() call - not
         * just because the container's actual DOM size changed some
         * other way. fitToData fires right after a fresh project's
         * data loads (MainApp.jsx), a moment surrounding layout can
         * still be settling - a stale cached size there makes fitBounds
         * center against the wrong box. Cheap no-op when the size
         * hasn't actually changed.
         */
        mapboxMap.resize();

        if (points.length === 0) {
          const [lat, lng] = DEFAULT_EMPTY_CENTER || [0, 0];

          mapboxMap.jumpTo({
            center: [lng, lat],
            zoom: DEFAULT_EMPTY_ZOOM ?? 1,
          });
        } else {
          const lngs = points.map((pair) => pair[0]);
          const lats = points.map((pair) => pair[1]);

          mapboxMap.fitBounds(
            [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ],
            { padding: 40, animate: false },
          );
        }

        /*
         * Same reasoning as Leaflet's own MapActionController.jsx:
         * unlike center/flyTo/focus (whose target the caller already
         * writes into mapCenter/mapZoom itself, at the GlobalRuntime.jsx
         * call site), fitToData's own resulting view is only known
         * once the fitting math above runs, so this reads it straight
         * back off the live map and syncs it into React state directly
         * - keeping mapCenter/mapZoom accurate for VisibilityController's
         * own reveal resync the next time this shell is shown.
         * setMapCenter/setMapZoom travel as part of the mapAction
         * payload (GlobalRuntime.jsx's own map.fitToData), not as
         * standing props on this component, the same way
         * DEFAULT_EMPTY_CENTER/DEFAULT_EMPTY_ZOOM already do.
         */
        const center = mapboxMap.getCenter();

        setMapCenter?.([center.lat, center.lng]);
        setMapZoom?.(mapboxMap.getZoom());

        break;
      }

      default:
        break;
    }

    setMapAction(null);
  }, [mapAction, mapboxMap, setMapAction]);

  return null;
}
