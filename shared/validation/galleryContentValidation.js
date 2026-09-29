// shared/validation/galleryContentValidation.js

import { ENGINE_KEYS } from "./schemaConstants.js";
import { EXTENSION_LIMITS } from "./validationConstants.js";

export const GALLERY_IMAGE_UPLOAD_LIMIT_BYTES = 15 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function valid() {
  return { isValid: true, error: null };
}

function invalid(error = "Invalid gallery payload.") {
  return { isValid: false, error };
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(payload, expectedKeys) {
  if (!isPlainObject(payload)) return false;

  const keys = Object.keys(payload);
  if (keys.length !== expectedKeys.length) return false;

  const expected = new Set(expectedKeys);
  return keys.every((key) => expected.has(key));
}

function isObjectIdLike(value) {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
}

function clampLimit(configured, limits) {
  const n = Number(configured);

  if (!Number.isFinite(n)) {
    return limits.default;
  }

  return Math.max(limits.min, Math.min(limits.max, n));
}

export function validateGalleryEngineKey(engineKey) {
  if (typeof engineKey !== "string") {
    return invalid("Invalid engineKey.");
  }

  if (!ENGINE_KEYS.includes(engineKey)) {
    return invalid("Invalid engineKey.");
  }

  return valid();
}

export function validateGalleryGetPayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "dataItemId", "engineKey"])) {
    return invalid("Invalid gallery get payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  if (!isObjectIdLike(payload.dataItemId)) {
    return invalid("Invalid dataItemId.");
  }

  return validateGalleryEngineKey(payload.engineKey);
}

export function validateGalleryAddPayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "dataItemId", "engineKey"])) {
    return invalid("Invalid gallery add payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  if (!isObjectIdLike(payload.dataItemId)) {
    return invalid("Invalid dataItemId.");
  }

  return validateGalleryEngineKey(payload.engineKey);
}

export function validateGalleryRemovePayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "imageId", "engineKey"])) {
    return invalid("Invalid gallery remove payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  if (!isObjectIdLike(payload.imageId)) {
    return invalid("Invalid imageId.");
  }

  return validateGalleryEngineKey(payload.engineKey);
}

export function validateGalleryRemoveAllPayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "dataItemId", "engineKey"])) {
    return invalid("Invalid gallery remove-all payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  if (!isObjectIdLike(payload.dataItemId)) {
    return invalid("Invalid dataItemId.");
  }

  return validateGalleryEngineKey(payload.engineKey);
}

export function isAllowedGalleryMimeType(mimetype) {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimetype);
}

export function validateGalleryEnabled({ schema, dataItem } = {}) {
  if (schema?.extensions?.Gallery?.enabled !== true) {
    return invalid("Gallery is not enabled.");
  }

  if (dataItem?.extensions?.Gallery !== true) {
    return invalid("Gallery is not enabled for this item.");
  }

  return valid();
}

export function getGalleryMaxImages(schema) {
  return clampLimit(
    schema?.extensions?.Gallery?.maxImages,
    EXTENSION_LIMITS.Gallery.maxImages,
  );
}

export function validateGalleryImageUpload({
  schema,
  dataItem,
  existingImageCount,
} = {}) {
  const enabledValidation = validateGalleryEnabled({
    schema,
    dataItem,
  });

  if (!enabledValidation.isValid) {
    return enabledValidation;
  }

  const maxImages = getGalleryMaxImages(schema);

  if (existingImageCount >= maxImages) {
    return invalid("Gallery image limit reached.");
  }

  return valid();
}