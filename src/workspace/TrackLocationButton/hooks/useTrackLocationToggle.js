// src/workspace/TrackLocationButton/hooks/useTrackLocationToggle.js

import { useCallback } from "react";

/*
 * The TrackLocationButton's own toggle - asks for geolocation
 * permission and flips trackLocation, or turns it straight off.
 *
 * Every engine runtime held its own copy of this. They were the same
 * logic throughout: Places and Events byte-identical, Presence and
 * Neighbourhoods differing only in formatting, and Motion differing in
 * one real way - it clears its own recorded samples whenever tracking
 * starts. That difference is expressed here as an optional
 * `onStartTracking` callback rather than a branch on engineKey, so the
 * hook has no knowledge of which engine is using it.
 *
 * Still imported per engine runtime rather than hoisted into
 * GlobalRuntime, precisely because that callback differs per engine.
 */
export function useTrackLocationToggle({
  trackLocation,
  setTrackLocation,
  onStartTracking,
}) {
  return useCallback(() => {
    if (trackLocation) {
      setTrackLocation(false);
      return;
    }

    if (!("geolocation" in navigator) || !("permissions" in navigator)) {
      alert("Geolocation not supported by this browser.");
      return;
    }

    const startTracking = () => {
      onStartTracking?.();
      setTrackLocation(true);
    };

    navigator.permissions
      .query({ name: "geolocation" })
      .then((permissionStatus) => {
        if (permissionStatus.state === "granted") {
          startTracking();
        } else if (permissionStatus.state === "prompt") {
          navigator.geolocation.getCurrentPosition(startTracking, () =>
            alert("Location permission denied."),
          );
        } else {
          alert("Location permission not granted. Enable it in browser settings.");
        }
      })
      .catch(() => alert("Failed to check location permissions."));
  }, [trackLocation, setTrackLocation, onStartTracking]);
}
