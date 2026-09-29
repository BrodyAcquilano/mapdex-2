// src/map/mapbox/layers/UserLayer.jsx

import { useEffect, useRef } from "react";
import * as mapboxgl from "mapbox-gl/esm";

import { createUserMarkerElement } from "../icons/createUserMarkerElement.js";
import UserLocationTracker from "../controllers/UserLocationTracker.jsx";

/*
 * Mapbox counterpart to src/map/leaflet/layers/UserLayer.jsx: the
 * pulsing "you are here" marker shown while track-location mode is
 * on, plus the camera-lock behavior (UserLocationTracker.jsx mirrors
 * Leaflet's controller of the same name). Same icon markup/animation
 * (createUserMarkerElement mirrors createUserIcon), just built as a
 * native mapboxgl.Marker instead of a react-leaflet <Marker>, the
 * same way the draft point/vertex markers in DrawLayer.jsx are.
 */
export default function MapboxUserLayer({
  mapboxMap,
  userLocation,
  trackLocation,
  userColorTheme,
  suspendTracking,
}) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (!mapboxMap || !trackLocation || !userLocation) return;

    const lat = Number(userLocation.lat);
    const lng = Number(userLocation.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const element = createUserMarkerElement(userColorTheme);

    const marker = new mapboxgl.Marker({
      element,
      anchor: "center",
    })
      .setLngLat([lng, lat])
      .addTo(mapboxMap);

    /*
     * The user marker should always sit above the data/draw layers
     * (matching Leaflet, where UserLayer is mounted last inside
     * MapContainer and so ends up on top in the DOM) - setting this
     * directly rather than relying on mount order is more robust,
     * since it doesn't depend on this effect happening to run after
     * every other layer's marker-creation effects.
     */
    marker.getElement().style.zIndex = "500";

    markerRef.current = marker;

    return () => {
      marker.remove();
    };
  }, [mapboxMap, trackLocation, userLocation, userColorTheme]);

  return (
    <UserLocationTracker
      mapboxMap={mapboxMap}
      userLocation={userLocation}
      trackLocation={trackLocation}
      suspendTracking={suspendTracking}
    />
  );
}
