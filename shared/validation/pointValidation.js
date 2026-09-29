import { GEOMETRY_LIMITS } from "./validationConstants.js";

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;

  const keys = Object.keys(value);

  if (keys.length !== expectedKeys.length) return false;

  const expected = new Set(expectedKeys);

  return keys.every((key) => expected.has(key));
}

function hasOnlyKeys(value, allowedKeys) {
  if (!isPlainObject(value)) return false;

  const allowed = new Set(allowedKeys);

  return Object.keys(value).every((key) =>
    allowed.has(key),
  );
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(
    value,
    key,
  );
}

function isValidHexColor(value) {
  return (
    typeof value === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(value)
  );
}

export function validatePointCoordinates(coordinates) {
  if (
    !Array.isArray(coordinates) ||
    coordinates.length !== 2
  ) {
    return false;
  }

  const lngRaw = coordinates[0];
  const latRaw = coordinates[1];

  const lng =
    typeof lngRaw === "string"
      ? parseFloat(lngRaw)
      : Number(lngRaw);

  const lat =
    typeof latRaw === "string"
      ? parseFloat(latRaw)
      : Number(latRaw);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return false;
  }

  if (
    lat < GEOMETRY_LIMITS.latitudeMin ||
    lat > GEOMETRY_LIMITS.latitudeMax
  ) {
    return false;
  }

  if (
    lng < GEOMETRY_LIMITS.longitudeMin ||
    lng > GEOMETRY_LIMITS.longitudeMax
  ) {
    return false;
  }

  if (
    String(latRaw).length >
      GEOMETRY_LIMITS.coordinateMaxLength ||
    String(lngRaw).length >
      GEOMETRY_LIMITS.coordinateMaxLength
  ) {
    return false;
  }

  return true;
}

export function validatePointGeometry(geometry) {
  if (
    !hasExactKeys(geometry, [
      "type",
      "coordinates",
      "borderColor",
      "fillColor",
    ])
  ) {
    return false;
  }

  if (geometry.type !== "Point") {
    return false;
  }

  if (
    !validatePointCoordinates(
      geometry.coordinates,
    )
  ) {
    return false;
  }

  if (!isValidHexColor(geometry.borderColor)) {
    return false;
  }

  if (!isValidHexColor(geometry.fillColor)) {
    return false;
  }

  return true;
}

export function validatePresencePointGeometry(
  geometry,
) {
  if (
    !hasOnlyKeys(geometry, [
      "type",
      "coordinates",
      "borderColor",
      "fillColor",
    ])
  ) {
    return false;
  }

  if (geometry.type !== "Point") {
    return false;
  }

  if (
    !validatePointCoordinates(
      geometry.coordinates,
    )
  ) {
    return false;
  }

  if (
    hasOwn(geometry, "borderColor") &&
    !isValidHexColor(
      geometry.borderColor,
    )
  ) {
    return false;
  }

  if (
    hasOwn(geometry, "fillColor") &&
    !isValidHexColor(
      geometry.fillColor,
    )
  ) {
    return false;
  }

  return true;
}