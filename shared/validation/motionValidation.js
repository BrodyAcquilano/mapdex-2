import { GEOMETRY_LIMITS } from "./validationConstants.js";
import { parseISOToMs } from "./formValueHelpers.js";
import { isValidLngLatPair } from "./lineStringValidation.js";

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  if (!isPlainObject(value)) return false;

  const allowed = new Set(allowedKeys);

  return Object.keys(value).every((key) => allowed.has(key));
}

function validateMotionSample(sample) {
  if (!hasOnlyKeys(sample, ["lat", "lng", "timestampISO"])) {
    return false;
  }

  const lat = Number(sample.lat);
  const lng = Number(sample.lng);

  if (!isValidLngLatPair([lng, lat])) {
    return false;
  }

  if (parseISOToMs(sample.timestampISO) == null) {
    return false;
  }

  return true;
}

export function validateMotionTimePayload(time, geometry) {
  if (!isPlainObject(time)) return false;

  if (!hasOnlyKeys(time, ["type", "mode", "timezone", "samples"])) {
    return false;
  }

  if (time.type !== "Motion") return false;
  if (time.mode !== "Sampled") return false;

  if (!time.timezone || typeof time.timezone !== "string") {
    return false;
  }

  const samples = time.samples;

  if (!Array.isArray(samples)) return false;
  if (samples.length < 2) return false;

  if (samples.length > GEOMETRY_LIMITS.maxCoordinatesPerGeometry) {
    return false;
  }

  if (
    geometry &&
    geometry.type === "LineString" &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length !== samples.length
  ) {
    return false;
  }

  let previousMs = null;

  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];

    if (!validateMotionSample(sample)) {
      return false;
    }

    const currentMs = parseISOToMs(sample.timestampISO);

    if (currentMs == null) {
      return false;
    }

    if (previousMs != null && currentMs < previousMs) {
      return false;
    }

    previousMs = currentMs;

    if (
      geometry &&
      geometry.type === "LineString" &&
      Array.isArray(geometry.coordinates)
    ) {
      const coordinate = geometry.coordinates[i];

      if (!isValidLngLatPair(coordinate)) {
        return false;
      }

      const coordinateLng = Number(coordinate[0]);

      const coordinateLat = Number(coordinate[1]);

      if (Number(sample.lng) !== coordinateLng) {
        return false;
      }

      if (Number(sample.lat) !== coordinateLat) {
        return false;
      }
    }
  }

  return true;
}
