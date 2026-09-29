// src/map/mapbox/controllers/MapViewTracker.jsx

import { useEffect, useRef } from "react";

function serializeBounds(bounds) {
  if (!bounds) return null;

  return {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
  };
}

function boundsEqual(a, b) {
  if (!a || !b) return false;

  return (
    a.south === b.south &&
    a.west === b.west &&
    a.north === b.north &&
    a.east === b.east
  );
}

/*
 * Syncs Mapbox's center/zoom/bounds back into shared React state
 * whenever the user pans or zooms. A real component now, not a hook -
 * mirrors Leaflet's own MapViewTracker.jsx exactly. MapboxMapShell.jsx
 * only mounts this while this shell is actually the visible one (see
 * that file's own comment), so it never listens for moveend on a map
 * instance nobody's looking at, and never runs its own initial
 * immediate sync (below) against a stale/hidden view.
 *
 * Skips syncing while trackLocation is true, the same way Leaflet's
 * own MapViewTracker.jsx does - but only for engines where
 * trackLocation actually means "the camera is autonomously locked to
 * follow the user's live position" (geometry, motion,
 * neighbourhoods). For those, the moveend events the lock's own
 * flyTo/setView calls generate shouldn't be mistaken for the user
 * manually panning and written back into shared state. Presence's
 * trackLocation means something different - "I'm actively
 * broadcasting my own live position" - and never drives a camera lock
 * at all (it never even mounts UserLayer/UserLocationTracker), so the
 * user can freely pan while it's true, and that panning needs to keep
 * syncing into React state normally. `engine`
 * (runtime.schema?.engineKey) is what lets this tell those two
 * meanings apart.
 */
export default function MapViewTracker({
  mapboxMap,
  setMapCenter,
  setMapZoom,
  setMapBounds,
  trackLocation,
  engine,
}) {
  const lastBoundsRef = useRef(null);

  useEffect(() => {
    if (!mapboxMap) return;

    const locksCameraToUser = trackLocation && engine !== "presence";

    const syncViewState = () => {
      if (locksCameraToUser) return;

      const center = mapboxMap.getCenter();

      /*
       * Mapdex stores map center as [lat, lng].
       * Mapbox exposes it as { lat, lng }.
       */
      setMapCenter?.([center.lat, center.lng]);
      setMapZoom?.(mapboxMap.getZoom());

      if (setMapBounds) {
        const nextBounds = serializeBounds(mapboxMap.getBounds());

        if (!boundsEqual(lastBoundsRef.current, nextBounds)) {
          lastBoundsRef.current = nextBounds;
          setMapBounds(nextBounds);
        }
      }
    };

    /*
     * "moveend" alone covers pans, zooms, rotates, and pitches -
     * unlike Leaflet, Mapbox GL fires it after any camera transform,
     * not just panning, so a separate "zoomend" listener would be
     * redundant here. "resize" is a genuinely different event (a
     * container size change, not a camera transform) that doesn't
     * trigger "moveend" on its own, so it needs its own listener -
     * without it, a window resize could change what's actually
     * visible (bounds) without updating React's copy of them.
     */
    mapboxMap.on("moveend", syncViewState);
    mapboxMap.on("resize", syncViewState);

    // Sync once immediately so React state matches the initial view.
    syncViewState();

    return () => {
      mapboxMap.off("moveend", syncViewState);
      mapboxMap.off("resize", syncViewState);
    };
  }, [mapboxMap, setMapCenter, setMapZoom, setMapBounds, trackLocation, engine]);

  return null;
}
