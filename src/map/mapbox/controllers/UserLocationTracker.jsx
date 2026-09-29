// src/map/mapbox/controllers/UserLocationTracker.jsx

import { useEffect } from "react";

/*
 * Mapbox counterpart to
 * src/map/leaflet/controllers/UserLocationTracker.jsx - same
 * controller shape (a mounted, render-nothing component next to the
 * map), same "lock" behavior, just translated to Mapbox GL's
 * equivalent APIs/events in place of react-leaflet's useMap/useMapEvents:
 * - user location updates: ease to the new position
 * - dragend (the user panned): fly back for that rubber-band snap
 * - zoomend (the user zoomed): re-center after a tiny delay, so it
 *   reads as a deliberate "snap" rather than fighting the zoom
 *   gesture itself
 *
 * suspendTracking (see src/map/utils/isEditingGeometryPosition.js)
 * pauses all of the above without touching trackLocation itself,
 * while a place/event's geometry is actively being drawn or edited -
 * otherwise this would fight flying to or dragging a point/line/
 * polygon that isn't near the user's own live location, snapping the
 * camera back to them mid-edit.
 */
export default function UserLocationTracker({
  mapboxMap,
  userLocation,
  trackLocation,
  suspendTracking = false,
}) {
  // When tracking is enabled (or a new location arrives), ease to the user immediately
  useEffect(() => {
    if (!mapboxMap || !trackLocation || !userLocation || suspendTracking) return;

    const lat = Number(userLocation.lat);
    const lng = Number(userLocation.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    mapboxMap.easeTo({
      center: [lng, lat],
      duration: 600,
    });
  }, [mapboxMap, trackLocation, userLocation, suspendTracking]);

  // "bounce back" after dragging, and stay locked on zoom
  useEffect(() => {
    if (!mapboxMap) return;

    const handleDragEnd = () => {
      if (!trackLocation || !userLocation || suspendTracking) return;

      const lat = Number(userLocation.lat);
      const lng = Number(userLocation.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      mapboxMap.flyTo({
        center: [lng, lat],
        duration: 600, // addictive snap
      });
    };

    const handleZoomEnd = () => {
      if (!trackLocation || !userLocation || suspendTracking) return;

      const lat = Number(userLocation.lat);
      const lng = Number(userLocation.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      // tiny delay = "snap" feel
      window.setTimeout(() => {
        mapboxMap.jumpTo({ center: [lng, lat] });
      }, 60);
    };

    mapboxMap.on("dragend", handleDragEnd);
    mapboxMap.on("zoomend", handleZoomEnd);

    return () => {
      mapboxMap.off("dragend", handleDragEnd);
      mapboxMap.off("zoomend", handleZoomEnd);
    };
  }, [mapboxMap, trackLocation, userLocation, suspendTracking]);

  return null;
}
