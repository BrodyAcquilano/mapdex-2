import express from "express";

export const BODY_LIMITS = {
  tiny: "25kb",
  small: "100kb",
  medium: "1mb",
  large: "5mb",
  import: "10mb",
  largeImport: "20mb",
  extraLargeImport: "100mb",
};

export function jsonLimit(size) {
  return express.json({ limit: size });
}

export function urlencodedLimit(size) {
  return express.urlencoded({
    extended: true,
    limit: size,
  });
}

export const tinyJson = jsonLimit(BODY_LIMITS.tiny);
export const smallJson = jsonLimit(BODY_LIMITS.small);
export const mediumJson = jsonLimit(BODY_LIMITS.medium);
export const largeJson = jsonLimit(BODY_LIMITS.large);
export const importJson = jsonLimit(BODY_LIMITS.import);
export const largeImportJson = jsonLimit(BODY_LIMITS.largeImport);
export const extraLargeImportJson = jsonLimit(BODY_LIMITS.extraLargeImport);

export const tinyUrlencoded = urlencodedLimit(BODY_LIMITS.tiny);
export const smallUrlencoded = urlencodedLimit(BODY_LIMITS.small);
export const mediumUrlencoded = urlencodedLimit(BODY_LIMITS.medium);
export const largeUrlencoded = urlencodedLimit(BODY_LIMITS.large);
export const importUrlencoded = urlencodedLimit(BODY_LIMITS.import);
export const largeImportUrlencoded = urlencodedLimit(BODY_LIMITS.largeImport);
export const extraLargeImportUrlencoded = urlencodedLimit(BODY_LIMITS.extraLargeImport);