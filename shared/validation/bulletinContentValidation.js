// shared/validation/bulletinContentValidation.js

import {
  BULLETIN_LIMITS,
  EXTENSION_LIMITS,
} from "./validationConstants.js";

function valid() {
  return { isValid: true, error: null };
}

function invalid(error = "Invalid bulletin payload.") {
  return { isValid: false, error };
}

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

export function getBulletinConfig(schema) {
  const extension = schema?.extensions?.Bulletin || {};

  return {
    enabled: extension.enabled === true,
    maxMessages: clampLimit(
      extension.maxMessages,
      EXTENSION_LIMITS.Bulletin.maxMessages,
    ),
    messageLength: clampLimit(
      extension.messageLength,
      EXTENSION_LIMITS.Bulletin.messageLength,
    ),
    titleLength: BULLETIN_LIMITS.titleMaxLength,
  };
}

export function validateBulletinEnabled(schema) {
  const bulletinConfig = getBulletinConfig(schema);

  if (!bulletinConfig.enabled) {
    return invalid("Bulletin is not enabled for this project.");
  }

  return valid();
}

export function validateBulletinGetPayload(payload) {
  if (!hasExactKeys(payload, ["projectId"])) {
    return invalid("Invalid bulletin get payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  return valid();
}

export function validateBulletinAddPayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "bulletinMessage"])) {
    return invalid("Invalid bulletin add payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  if (!isPlainObject(payload.bulletinMessage)) {
    return invalid("Invalid bulletin message.");
  }

  return valid();
}

export function validateBulletinUpdatePayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "messageId", "updates"])) {
    return invalid("Invalid bulletin update payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  const idValidation = validateBulletinMessageId(payload.messageId);

  if (!idValidation.isValid) {
    return idValidation;
  }

  if (!isPlainObject(payload.updates)) {
    return invalid("Invalid bulletin message.");
  }

  return valid();
}

export function validateBulletinRemovePayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "messageId"])) {
    return invalid("Invalid bulletin remove payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  return validateBulletinMessageId(payload.messageId);
}

export function validateBulletinMessagePayload(schema, bulletinMessage) {
  if (!hasExactKeys(bulletinMessage, ["title", "body"])) {
    return invalid("Invalid bulletin message.");
  }

  if (typeof bulletinMessage.title !== "string") {
    return invalid("Invalid bulletin title.");
  }

  if (typeof bulletinMessage.body !== "string") {
    return invalid("Invalid bulletin body.");
  }

  const bulletinConfig = getBulletinConfig(schema);

  const title = bulletinMessage.title.trim();
  const body = bulletinMessage.body.trim();

  if (!title) {
    return invalid("Title is required.");
  }

  if (!body) {
    return invalid("Message is required.");
  }

  if (title.length > bulletinConfig.titleLength) {
    return invalid("Title is too long.");
  }

  if (body.length > bulletinConfig.messageLength) {
    return invalid("Message is too long.");
  }

  return valid();
}

export function cleanBulletinMessagePayload(bulletinMessage) {
  if (!isPlainObject(bulletinMessage)) return null;

  return {
    title:
      typeof bulletinMessage.title === "string"
        ? bulletinMessage.title.trim()
        : "",
    body:
      typeof bulletinMessage.body === "string"
        ? bulletinMessage.body.trim()
        : "",
  };
}

export function validateBulletinMessageId(messageId) {
  if (typeof messageId !== "string") {
    return invalid("Invalid bulletin message.");
  }

  if (messageId.trim() === "" || messageId.length > 100) {
    return invalid("Invalid bulletin message.");
  }

  return valid();
}