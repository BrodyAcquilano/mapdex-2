// src/map/mapbox/utils/computeFlyDuration.js

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/*
 * Constant-speed, zoom-aware fly duration calculator, in seconds.
 * Mirrors src/map/leaflet/utils/ComputeFlyDuration.js so flyTo/focus
 * feel the same whether the active panel is Leaflet or Mapbox.
 */
export function computeFlyDuration(mapboxMap, targetLat, targetLng) {
  const currentCenter = mapboxMap.getCenter();
  const currentZoom = mapboxMap.getZoom();

  const distanceMeters = haversineMeters(
    currentCenter.lat,
    currentCenter.lng,
    targetLat,
    targetLng,
  );

  const FLY_SPEED_METERS_PER_SECOND = 500_000;
  const MIN_DURATION = 0.35;
  const MAX_DURATION = 10;

  let duration = distanceMeters / FLY_SPEED_METERS_PER_SECOND;

  if (!Number.isFinite(duration)) duration = MIN_DURATION;

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 18;

  const normalizedZoom = (currentZoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
  const zoomFactor = 0.6 + normalizedZoom * 1.0;

  duration *= zoomFactor;

  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration));
}
