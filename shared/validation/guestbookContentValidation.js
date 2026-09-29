// shared/validation/guestbookContentValidation.js

import {
  GEOMETRY_LIMITS,
  GUESTBOOK_LIMITS,
} from "./validationConstants.js";

const GUESTBOOK_ENGINE_KEYS = [
  "places",
  "events",
];

const SIGN_RADIUS_METERS = 500;
const INSTANT_TIME_BUFFER_MS = 2 * 60 * 60 * 1000;
const GUESTBOOK_STATUS_OPTIONS = ["visible", "hidden"];
const EARTH_RADIUS_METERS = 6371000;

function valid() {
  return { isValid: true, error: null };
}

function invalid(error = "Invalid guestbook payload.") {
  return { isValid: false, error };
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  if (!isPlainObject(value)) return false;

  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function hasExactKeys(value, requiredKeys) {
  if (!isPlainObject(value)) return false;

  const keys = Object.keys(value);
  if (keys.length !== requiredKeys.length) return false;

  const required = new Set(requiredKeys);
  return keys.every((key) => required.has(key));
}

function isObjectIdLike(value) {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
}

function nowInTimezone(tz) {
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function normalizeLongitudeDelta(delta) {
  let normalized = delta;

  while (normalized > 180) {
    normalized -= 360;
  }

  while (normalized < -180) {
    normalized += 360;
  }

  return normalized;
}

function isValidLngLatPair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) {
    return false;
  }

  const lng = Number(pair[0]);
  const lat = Number(pair[1]);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return false;
  }

  return (
    lat >= GEOMETRY_LIMITS.latitudeMin &&
    lat <= GEOMETRY_LIMITS.latitudeMax &&
    lng >= GEOMETRY_LIMITS.longitudeMin &&
    lng <= GEOMETRY_LIMITS.longitudeMax
  );
}

function initialBearingRadians(
  lat1,
  lon1,
  lat2,
  lon2,
) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);

  const deltaLambda = toRadians(
    normalizeLongitudeDelta(
      lon2 - lon1,
    ),
  );

  const y =
    Math.sin(deltaLambda) *
    Math.cos(phi2);

  const x =
    Math.cos(phi1) *
      Math.sin(phi2) -
    Math.sin(phi1) *
      Math.cos(phi2) *
      Math.cos(deltaLambda);

  return Math.atan2(y, x);
}

function distanceToSegmentMeters(
  lat,
  lng,
  startLat,
  startLng,
  endLat,
  endLng,
) {
  const segmentDistance = haversineMeters(
    startLat,
    startLng,
    endLat,
    endLng,
  );

  if (segmentDistance === 0) {
    return haversineMeters(
      lat,
      lng,
      startLat,
      startLng,
    );
  }

  const distanceStartToPoint =
    haversineMeters(
      startLat,
      startLng,
      lat,
      lng,
    );

  const delta13 =
    distanceStartToPoint /
    EARTH_RADIUS_METERS;

  const delta12 =
    segmentDistance /
    EARTH_RADIUS_METERS;

  const theta13 =
    initialBearingRadians(
      startLat,
      startLng,
      lat,
      lng,
    );

  const theta12 =
    initialBearingRadians(
      startLat,
      startLng,
      endLat,
      endLng,
    );

  const bearingDifference =
    theta13 - theta12;

  const crossTrackInput =
    Math.sin(delta13) *
    Math.sin(bearingDifference);

  const clampedCrossTrackInput =
    Math.max(
      -1,
      Math.min(
        1,
        crossTrackInput,
      ),
    );

  const crossTrackAngle =
    Math.asin(
      clampedCrossTrackInput,
    );

  const alongTrackAngle =
    Math.atan2(
      Math.sin(delta13) *
        Math.cos(bearingDifference),
      Math.cos(delta13),
    );

  if (
    alongTrackAngle < 0 ||
    alongTrackAngle > delta12
  ) {
    return Math.min(
      haversineMeters(
        lat,
        lng,
        startLat,
        startLng,
      ),
      haversineMeters(
        lat,
        lng,
        endLat,
        endLng,
      ),
    );
  }

  return (
    Math.abs(crossTrackAngle) *
    EARTH_RADIUS_METERS
  );
}

function distanceToCoordinateSequenceMeters(
  coordinates,
  lat,
  lng,
  closeRing = false,
) {
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  ) {
    return null;
  }

  let minimumDistance = Infinity;

  for (
    let i = 0;
    i < coordinates.length - 1;
    i += 1
  ) {
    const start = coordinates[i];
    const end = coordinates[i + 1];

    if (
      !isValidLngLatPair(start) ||
      !isValidLngLatPair(end)
    ) {
      return null;
    }

    const distance =
      distanceToSegmentMeters(
        lat,
        lng,
        Number(start[1]),
        Number(start[0]),
        Number(end[1]),
        Number(end[0]),
      );

    if (distance < minimumDistance) {
      minimumDistance = distance;
    }
  }

  if (closeRing) {
    const first = coordinates[0];
    const last =
      coordinates[
        coordinates.length - 1
      ];

    if (
      !isValidLngLatPair(first) ||
      !isValidLngLatPair(last)
    ) {
      return null;
    }

    const ringAlreadyClosed =
      Number(first[0]) ===
        Number(last[0]) &&
      Number(first[1]) ===
        Number(last[1]);

    if (!ringAlreadyClosed) {
      const closingDistance =
        distanceToSegmentMeters(
          lat,
          lng,
          Number(last[1]),
          Number(last[0]),
          Number(first[1]),
          Number(first[0]),
        );

      if (
        closingDistance <
        minimumDistance
      ) {
        minimumDistance =
          closingDistance;
      }
    }
  }

  return Number.isFinite(minimumDistance)
    ? minimumDistance
    : null;
}

function projectToLocalMeters(
  coordinate,
  originLat,
  originLng,
) {
  if (!isValidLngLatPair(coordinate)) {
    return null;
  }

  const lng = Number(coordinate[0]);
  const lat = Number(coordinate[1]);

  const x =
    EARTH_RADIUS_METERS *
    toRadians(
      normalizeLongitudeDelta(
        lng - originLng,
      ),
    ) *
    Math.cos(
      toRadians(originLat),
    );

  const y =
    EARTH_RADIUS_METERS *
    toRadians(
      lat - originLat,
    );

  return [x, y];
}

function pointIsInsidePolygon(
  geometry,
  lat,
  lng,
) {
  const ring =
    geometry?.coordinates?.[0];

  if (
    !Array.isArray(ring) ||
    ring.length < 4
  ) {
    return false;
  }

  const projectedRing =
    ring.map((coordinate) =>
      projectToLocalMeters(
        coordinate,
        lat,
        lng,
      ),
    );

  if (
    projectedRing.some(
      (point) => !point,
    )
  ) {
    return false;
  }

  let inside = false;

  for (
    let i = 0,
      j = projectedRing.length - 1;
    i < projectedRing.length;
    j = i,
      i += 1
  ) {
    const [xi, yi] =
      projectedRing[i];

    const [xj, yj] =
      projectedRing[j];

    const crossesHorizontalRay =
      (yi > 0) !== (yj > 0);

    if (!crossesHorizontalRay) {
      continue;
    }

    const intersectionX =
      ((xj - xi) * -yi) /
        (yj - yi) +
      xi;

    if (intersectionX > 0) {
      inside = !inside;
    }
  }

  return inside;
}

export function haversineMeters(
  lat1,
  lon1,
  lat2,
  lon2,
) {
  const dLat =
    toRadians(lat2 - lat1);

  const dLon =
    toRadians(
      normalizeLongitudeDelta(
        lon2 - lon1,
      ),
    );

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(dLon / 2) ** 2;

  const clampedA =
    Math.max(
      0,
      Math.min(1, a),
    );

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.asin(
      Math.sqrt(clampedA),
    )
  );
}

export function distanceToGeometryMeters({
  geometry,
  lat,
  lng,
} = {}) {
  const signLat = Number(lat);
  const signLng = Number(lng);

  if (
    !geometry?.type ||
    !Number.isFinite(signLat) ||
    !Number.isFinite(signLng)
  ) {
    return null;
  }

  if (geometry.type === "Point") {
    const coordinate =
      geometry.coordinates;

    if (!isValidLngLatPair(coordinate)) {
      return null;
    }

    return haversineMeters(
      signLat,
      signLng,
      Number(coordinate[1]),
      Number(coordinate[0]),
    );
  }

  if (
    geometry.type ===
    "LineString"
  ) {
    return distanceToCoordinateSequenceMeters(
      geometry.coordinates,
      signLat,
      signLng,
      false,
    );
  }

  if (geometry.type === "Polygon") {
    const ring =
      geometry.coordinates?.[0];

    if (
      !Array.isArray(ring) ||
      ring.length < 4
    ) {
      return null;
    }

    if (
      pointIsInsidePolygon(
        geometry,
        signLat,
        signLng,
      )
    ) {
      return 0;
    }

    return distanceToCoordinateSequenceMeters(
      ring,
      signLat,
      signLng,
      true,
    );
  }

  return null;
}

export function validateGuestbookEngineKey(engineKey) {
  if (typeof engineKey !== "string") {
    return invalid("Invalid engineKey.");
  }

  if (
    !GUESTBOOK_ENGINE_KEYS.includes(
      engineKey,
    )
  ) {
    return invalid("Invalid engineKey.");
  }

  return valid();
}

export function validateGuestbookDataItemIdParam(dataItemId) {
  if (!isObjectIdLike(dataItemId)) {
    return invalid("Invalid dataItemId.");
  }

  return valid();
}

export function validateGuestbookEntryIdParam(entryId) {
  if (
    typeof entryId !== "string" ||
    entryId.trim() === "" ||
    entryId.length > 100
  ) {
    return invalid("Invalid entryId.");
  }

  return valid();
}

export function validateGuestbookGetPayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "engineKey"])) {
    return invalid("Invalid guestbook get payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  return validateGuestbookEngineKey(payload.engineKey);
}

export function validateGuestbookAddEntryPayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "engineKey", "entry"])) {
    return invalid("Invalid guestbook add entry payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  const engineValidation =
    validateGuestbookEngineKey(
      payload.engineKey,
    );

  if (!engineValidation.isValid) {
    return engineValidation;
  }

  return validateGuestbookEntryPayload(
    payload.entry,
  );
}

export function validateGuestbookUpdateEntryPayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "engineKey", "updates"])) {
    return invalid("Invalid guestbook update entry payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  const engineValidation =
    validateGuestbookEngineKey(
      payload.engineKey,
    );

  if (!engineValidation.isValid) {
    return engineValidation;
  }

  return validateGuestbookUpdatesPayload(
    payload.updates,
  );
}

export function validateGuestbookToggleEntriesPayload(payload) {
  if (
    !hasExactKeys(payload, [
      "projectId",
      "dataItemId",
      "engineKey",
      "entryIds",
      "status",
    ])
  ) {
    return invalid("Invalid guestbook toggle entries payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  if (!isObjectIdLike(payload.dataItemId)) {
    return invalid("Invalid dataItemId.");
  }

  const engineValidation =
    validateGuestbookEngineKey(
      payload.engineKey,
    );

  if (!engineValidation.isValid) {
    return engineValidation;
  }

  return validateGuestbookTogglePayload({
    entryIds: payload.entryIds,
    status: payload.status,
  });
}

export function validateGuestbookRemoveAllPayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "engineKey"])) {
    return invalid("Invalid guestbook remove-all payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  return validateGuestbookEngineKey(payload.engineKey);
}

export function isWithinDateTimeRange(dataItem) {
  const timeData = dataItem?.time;

  if (!timeData) return false;

  if (timeData.type === "None") {
    return true;
  }

  if (timeData.type !== "Event") {
    return false;
  }

  const mode = timeData.mode;

  const dates =
    Array.isArray(timeData.dates)
      ? timeData.dates
      : [];

  const date = dates[0];

  if (!date?.start) return false;

  const tz =
    timeData.timezone || "UTC";

  const now =
    nowInTimezone(tz);

  const start =
    new Date(date.start);

  const end =
    date.end
      ? new Date(date.end)
      : null;

  if (mode === "Range") {
    return end
      ? now >= start &&
          now <= end
      : false;
  }

  if (mode === "Ongoing") {
    return now >= start;
  }

  if (mode === "Instant") {
    return (
      Math.abs(now - start) <=
      INSTANT_TIME_BUFFER_MS
    );
  }

  return false;
}

export function validateGuestbookEnabled({
  schema,
  dataItem,
} = {}) {
  if (
    schema?.extensions?.Guestbook
      ?.enabled !== true
  ) {
    return invalid(
      "Guestbook is not enabled.",
    );
  }

  if (
    dataItem?.extensions?.Guestbook !==
    true
  ) {
    return invalid(
      "Guestbook is not enabled for this item.",
    );
  }

  return valid();
}

export function validateGuestbookEntryPayload(entry) {
  if (!hasExactKeys(entry, ["name", "comment", "lat", "lng"])) {
    return invalid("Invalid guestbook entry.");
  }

  if (typeof entry.name !== "string") {
    return invalid("Invalid guestbook name.");
  }

  if (typeof entry.comment !== "string") {
    return invalid("Invalid guestbook comment.");
  }

  const name = entry.name.trim();
  const comment = entry.comment.trim();

  if (!name) {
    return invalid("Name is required.");
  }

  if (name.length > GUESTBOOK_LIMITS.nameMaxLength) {
    return invalid("Name is too long.");
  }

  if (comment.length > GUESTBOOK_LIMITS.commentMaxLength) {
    return invalid("Comment is too long.");
  }

  const lat = Number(entry.lat);
  const lng = Number(entry.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return invalid("Invalid guestbook location.");
  }

  if (
    lat < GEOMETRY_LIMITS.latitudeMin ||
    lat > GEOMETRY_LIMITS.latitudeMax ||
    lng < GEOMETRY_LIMITS.longitudeMin ||
    lng > GEOMETRY_LIMITS.longitudeMax
  ) {
    return invalid("Invalid guestbook location.");
  }

  return valid();
}

export function validateGuestbookSigningEligibility({
  dataItem,
  lat,
  lng,
} = {}) {
  const signLat = Number(lat);
  const signLng = Number(lng);

  if (
    !Number.isFinite(signLat) ||
    !Number.isFinite(signLng)
  ) {
    return invalid(
      "Invalid guestbook location.",
    );
  }

  if (
    signLat <
      GEOMETRY_LIMITS.latitudeMin ||
    signLat >
      GEOMETRY_LIMITS.latitudeMax ||
    signLng <
      GEOMETRY_LIMITS.longitudeMin ||
    signLng >
      GEOMETRY_LIMITS.longitudeMax
  ) {
    return invalid(
      "Invalid guestbook location.",
    );
  }

  const distance =
    distanceToGeometryMeters({
      geometry:
        dataItem?.geometry,
      lat: signLat,
      lng: signLng,
    });

  if (
    distance == null ||
    !Number.isFinite(distance)
  ) {
    return invalid(
      "Data location is unavailable.",
    );
  }

  if (
    distance >
    SIGN_RADIUS_METERS
  ) {
    return invalid(
      "You must be at the location to sign.",
    );
  }

  if (
    !isWithinDateTimeRange(dataItem)
  ) {
    return invalid(
      "You must be at the location during its scheduled time.",
    );
  }

  return valid();
}

export function validateGuestbookUpdatesPayload(updates) {
  if (!hasOnlyKeys(updates, ["name", "comment"])) {
    return invalid("Invalid guestbook updates.");
  }

  if (Object.keys(updates).length === 0) {
    return invalid("Invalid guestbook updates.");
  }

  if (updates.name !== undefined) {
    if (typeof updates.name !== "string") {
      return invalid("Invalid guestbook name.");
    }

    const name = updates.name.trim();

    if (!name) {
      return invalid("Name is required.");
    }

    if (name.length > GUESTBOOK_LIMITS.nameMaxLength) {
      return invalid("Name is too long.");
    }
  }

  if (updates.comment !== undefined) {
    if (typeof updates.comment !== "string") {
      return invalid("Invalid guestbook comment.");
    }

    if (
      updates.comment.trim().length >
      GUESTBOOK_LIMITS.commentMaxLength
    ) {
      return invalid("Comment is too long.");
    }
  }

  return valid();
}

export function validateGuestbookTogglePayload({
  entryIds,
  status,
} = {}) {
  if (!GUESTBOOK_STATUS_OPTIONS.includes(status)) {
    return invalid("Invalid guestbook status.");
  }

  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    return invalid("Invalid guestbook entries.");
  }

  if (
    entryIds.length >
    GUESTBOOK_LIMITS.maxToggleEntryIds
  ) {
    return invalid("Too many guestbook entries selected.");
  }

  for (const id of entryIds) {
    if (
      typeof id !== "string" ||
      id.trim() === "" ||
      id.length > 100
    ) {
      return invalid("Invalid guestbook entries.");
    }
  }

  return valid();
}