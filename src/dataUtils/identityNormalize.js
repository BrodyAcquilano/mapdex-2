// src/data/identityNormalize.js

// raw data with no schema projection or reordering; just ensure an array shape.
// useful when data is already highly structured and preordered.
export function identityNormalizeData(rawData) {
  const data = Array.isArray(rawData) ? rawData : [];
  return data;
}

export function identityNormalizeDataItem(rawDataItem) {
  if (!rawDataItem) return rawDataItem;

  const { createdAt, updatedAt, ...safeRawDataItem } = rawDataItem;
  return safeRawDataItem;
}