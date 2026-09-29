const EARTH_RADIUS_METERS = 6371000;
const FLY_SPEED_METERS_PER_SECOND = 500_000;
const MIN_DURATION_SECONDS = 0.35;
const MAX_DURATION_SECONDS = 10;
const MIN_ZOOM = 1;
const MAX_ZOOM = 18;

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
 * Mirrors src/map/leaflet/utils/ComputeFlyDuration.js and
 * src/map/mapbox/utils/computeFlyDuration.js, but works off the
 * shared runtime `map` API (getCenter/getZoom) instead of a specific
 * engine's map instance, since this fires from the edit panel before
 * either engine-specific controller runs the actual animation.
 */
function computeFlyDurationSeconds(map, targetLat, targetLng) {
  const [currentLat, currentLng] = map?.getCenter?.() || [];
  const currentZoom = map?.getZoom?.();

  if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) {
    return MIN_DURATION_SECONDS;
  }

  const distanceMeters = haversineMeters(
    currentLat,
    currentLng,
    targetLat,
    targetLng,
  );

  let duration = distanceMeters / FLY_SPEED_METERS_PER_SECOND;

  if (!Number.isFinite(duration)) duration = MIN_DURATION_SECONDS;

  const normalizedZoom = (currentZoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
  const zoomFactor = 0.6 + normalizedZoom * 1.0;

  duration *= zoomFactor;

  return Math.max(
    MIN_DURATION_SECONDS,
    Math.min(MAX_DURATION_SECONDS, duration),
  );
}

/*
 * Handles a finalized Point lat/lng edit from the edit panel: flies
 * the map to the new coordinate, but deliberately delays revealing
 * the draft marker/popup there (setDraftGeometry) until the flyover
 * animation has actually finished, computing that duration itself so
 * the delay and the animation always match, rather than jumping the
 * marker to the destination the instant the field is finalized while
 * the camera is still mid-flight.
 *
 * `tokenRef` (a ref owned by the caller, e.g. EditPanel.jsx) guards
 * against a stale timeout applying an old edit's geometry after a
 * newer edit or a deselect has already superseded it.
 */
export function createOnLatLngFinalized({
  setDraftGeometry,
  selectedDataItem,
  map,
  tokenRef,
}) {
  return ({ geometry, lat, lng }) => {
    if (!geometry || geometry.type !== "Point") return;

    if (!selectedDataItem?._id || !map) {
      setDraftGeometry?.(structuredClone(geometry));
      return;
    }

    const durationSeconds = computeFlyDurationSeconds(map, lat, lng);

    if (tokenRef) tokenRef.current += 1;
    const token = tokenRef?.current;

    map.focus(lat, lng, selectedDataItem._id, durationSeconds);

    window.setTimeout(() => {
      if (tokenRef && tokenRef.current !== token) return;
      setDraftGeometry?.(structuredClone(geometry));
    }, durationSeconds * 1000);
  };
}
