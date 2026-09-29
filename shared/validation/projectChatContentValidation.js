// shared/validation/projectChatContentValidation.js

import { EXTENSION_LIMITS } from "./validationConstants.js";

function valid() {
  return { isValid: true, error: null };
}

function invalid(error = "Invalid chat payload.") {
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

export function getProjectChatConfig(schema) {
  const extension = schema?.extensions?.Chat || {};

  return {
    enabled: extension.enabled === true,
    maxMessages: clampLimit(
      extension.maxMessages,
      EXTENSION_LIMITS.Chat.maxMessages,
    ),
    messageLength: clampLimit(
      extension.messageLength,
      EXTENSION_LIMITS.Chat.messageLength,
    ),
  };
}

export function validateProjectChatEnabled(schema) {
  const chatConfig = getProjectChatConfig(schema);

  if (!chatConfig.enabled) {
    return invalid("Chat is not enabled for this project.");
  }

  return valid();
}

export function validateProjectChatGetPayload(payload) {
  if (!hasExactKeys(payload, ["projectId"])) {
    return invalid("Invalid project chat get payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  return valid();
}

export function validateProjectChatAddPayload(payload) {
  if (!hasExactKeys(payload, ["projectId", "chatMessage"])) {
    return invalid("Invalid project chat add payload.");
  }

  if (!isObjectIdLike(payload.projectId)) {
    return invalid("Invalid projectId.");
  }

  if (!isPlainObject(payload.chatMessage)) {
    return invalid("Invalid chat message.");
  }

  return valid();
}

export function validateProjectChatMessagePayload(schema, chatMessage) {
  if (!hasExactKeys(chatMessage, ["message"])) {
    return invalid("Invalid chat message.");
  }

  if (typeof chatMessage.message !== "string") {
    return invalid("Invalid chat message.");
  }

  const chatConfig = getProjectChatConfig(schema);
  const message = chatMessage.message.trim();

  if (!message) {
    return invalid("Message cannot be empty.");
  }

  if (message.length > chatConfig.messageLength) {
    return invalid("Message is too long.");
  }

  return valid();
}

export function cleanProjectChatMessagePayload(chatMessage) {
  if (!isPlainObject(chatMessage)) return null;

  return {
    message:
      typeof chatMessage.message === "string"
        ? chatMessage.message.trim()
        : "",
  };
}