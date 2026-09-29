// src/map/mapbox/controllers/VisibilityController.jsx

import { useEffect } from "react";

/*
 * Runs once, when this shell becomes visible - MapboxMapShell.jsx
 * only renders this component (and only once mapboxMap itself is
 * ready) while this shell is actually the visible one, so mounting IS
 * the "just became visible and usable" signal - no need to track a
 * previous hidden value internally the way this file's own earlier
 * inline wasHiddenRef/needsSyncRef version (formerly in
 * MapboxMapShell.jsx directly) had to, guessing at the transition
 * from the outside. Mirrors Leaflet's own VisibilityController.jsx.
 *
 * 1. resize() - a hidden container (via the `hidden` attribute)
 *    collapses to 0x0, and Mapbox only measures its container at
 *    construction time - becoming visible again needs an explicit
 *    resize() or the canvas stays stuck at whatever size it last had,
 *    which for a container that was hidden this whole session is 0x0.
 *
 * 2. jumpTo(center, zoom) - this instance is persistent and its
 *    camera just sits still while not mounted/visible. If Leaflet was
 *    panned/zoomed (or fit to fresh data) in the meantime, this one is
 *    now stale. Explicitly re-syncing to the current shared
 *    mapCenter/mapZoom on every reveal is what makes switching engines
 *    pick up wherever the other one was left. jumpTo (not flyTo) is
 *    instant - no reason to animate a transition the user didn't
 *    initiate as a camera move.
 */
export default function VisibilityController({ mapboxMap, mapCenter, mapZoom }) {
  useEffect(() => {
    mapboxMap.resize();

    if (Array.isArray(mapCenter) && mapCenter.length === 2) {
      mapboxMap.jumpTo({
        center: [mapCenter[1], mapCenter[0]],
        zoom: Number.isFinite(mapZoom) ? mapZoom : mapboxMap.getZoom(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxMap]);

  return null;
}
