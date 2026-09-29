export function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getStoredInput(dataItem, sectionIndex, inputIndex) {
  return dataItem?.sections?.[sectionIndex]?.inputs?.[inputIndex] || null;
}

export function getQuantitativeValue(
  dataItem,
  sectionIndex,
  inputIndex,
  fallback = 0
) {
  const input = getStoredInput(dataItem, sectionIndex, inputIndex);
  if (!input || typeof input !== "object") return fallback;

  if (input.mode !== "Single Value") return fallback;

  return toFiniteNumber(input.singleValue, fallback);
}

export function getTextValue(
  dataItem,
  sectionIndex,
  inputIndex,
  fallback = ""
) {
  const value = getStoredInput(dataItem, sectionIndex, inputIndex)?.value;
  return typeof value === "string" ? value : fallback;
}

export function getCentroid(dataItem) {
  const lat = toFiniteNumber(dataItem?.geometry?.centroid?.lat, NaN);
  const lng = toFiniteNumber(dataItem?.geometry?.centroid?.lng, NaN);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

export function getDistanceKm(a, b) {
  if (!a || !b) return Infinity;

  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const lat1 = toRadians(a.lat);
  const lng1 = toRadians(a.lng);
  const lat2 = toRadians(b.lat);
  const lng2 = toRadians(b.lng);

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const haversine =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return 6371 * c;
}

export function hasInputsAtIndexes(dataItem, sectionIndex, indexes = []) {
  const section = dataItem?.sections?.[sectionIndex];
  if (!section || !Array.isArray(section.inputs)) return false;

  return indexes.every((index) => {
    const input = section.inputs[index];
    return Boolean(input && input.id != null);
  });
}

export function hasRequiredAssetFields(dataItem) {
  return hasInputsAtIndexes(dataItem, 2, [0, 1, 2, 3, 4, 5]);
}

export function normalizeMetricArray(values) {
  const cleanValues = values.map((value) =>
    Number.isFinite(value) && value >= 0 ? value : 0
  );

  if (cleanValues.length === 0) {
    return [];
  }

  const max = Math.max(...cleanValues);

  if (!Number.isFinite(max) || max <= 0) {
    return cleanValues.map(() => 0);
  }

  return cleanValues.map((value) => value / max);
}

export function hasDuplicateScores(sortedRows) {
  for (let i = 1; i < sortedRows.length; i += 1) {
    if (sortedRows[i].score === sortedRows[i - 1].score) {
      return true;
    }
  }
  return false;
}

export function classifyByRankThirds(sortedRows) {
  const totalCount = sortedRows.length;
  if (totalCount === 0) return [];

  const baseSize = Math.floor(totalCount / 3);
  const remainder = totalCount % 3;

  const leastCount = baseSize;
  const averageCount = baseSize + (remainder >= 2 ? 1 : 0);
  const mostCount = baseSize + (remainder >= 1 ? 1 : 0);

  return sortedRows.map((_, index) => {
    if (index < leastCount) return "least";
    if (index < leastCount + averageCount) return "average";
    return "most";
  });
}

export function classifyByScoreThresholds(sortedRows) {
  const totalCount = sortedRows.length;
  if (totalCount === 0) return [];

  const lowIndex = Math.max(0, Math.floor(totalCount / 3) - 1);
  const highIndex = Math.max(0, Math.floor((totalCount * 2) / 3) - 1);

  const lowCutoff = sortedRows[lowIndex]?.score ?? 0;
  const highCutoff = sortedRows[highIndex]?.score ?? 0;

  return sortedRows.map((row) => {
    if (row.score <= lowCutoff) return "least";
    if (row.score > highCutoff) return "most";
    return "average";
  });
}

export function classifyRows(sortedRows) {
  if (!hasDuplicateScores(sortedRows)) {
    return classifyByRankThirds(sortedRows);
  }

  return classifyByScoreThresholds(sortedRows);
}

export function getAnalysisColors(ANALYSIS_COLORS) {
  return {
    fallbackBorder: ANALYSIS_COLORS?.fallback?.borderColor || "#2563eb",
    fallbackFill: ANALYSIS_COLORS?.fallback?.fillColor || "#3b82f6",
  };
}

export function buildSingleMetricFallbackEntry(
  item,
  ANALYSIS_COLORS,
  {
    valueKey = "value",
    fallbackValue = 0,
    reason = "Missing required field.",
    nameFallback = "Unnamed",
  } = {}
) {
  const { fallbackBorder, fallbackFill } = getAnalysisColors(ANALYSIS_COLORS);

  return {
    _id: item?._id,
    name: getTextValue(item, 0, 0, nameFallback),
    item,
    [valueKey]: fallbackValue,
    adjustedMetrics: [0],
    metricWeights: [1],
    score: 0,
    rank: null,
    accessClass: "fallback",
    borderColor: fallbackBorder,
    fillColor: fallbackFill,
    reason,
  };
}

export function buildSingleMetricDatasetFallbackResult(
  data = [],
  ANALYSIS_COLORS,
  {
    valueKey = "value",
    fallbackValue = 0,
    reason = "This project does not include the required field.",
    nameFallback = "Unnamed",
  } = {}
) {
  const ranked = (Array.isArray(data) ? data : []).map((item) =>
    buildSingleMetricFallbackEntry(item, ANALYSIS_COLORS, {
      valueKey,
      fallbackValue,
      reason,
      nameFallback,
    })
  );

  const byId = new Map(
    ranked.map((row) => [
      row._id,
      {
        score: row.score,
        rank: row.rank,
        accessClass: row.accessClass,
        borderColor: row.borderColor,
        fillColor: row.fillColor,
        adjustedMetrics: row.adjustedMetrics,
        [valueKey]: row[valueKey],
        metricWeights: row.metricWeights,
        reason: row.reason,
      },
    ])
  );

  return {
    byId,
    ranked,
    isFallback: true,
    reason,
  };
}

export function buildSingleMetricRankedRows(
  supportedItems = [],
  ANALYSIS_COLORS,
  {
    valueGetter,
    valueKey = "value",
    nameFallback = "Unnamed",
  } = {}
) {
  const metricWeights = [1];
  const { fallbackBorder, fallbackFill } = getAnalysisColors(ANALYSIS_COLORS);

  const analyzedRows = (Array.isArray(supportedItems) ? supportedItems : []).map(
    (item) => {
      const metricValue =
        typeof valueGetter === "function" ? valueGetter(item) : 0;

      return {
        _id: item?._id,
        name: getTextValue(item, 0, 0, nameFallback),
        item,
        [valueKey]: metricValue,
      };
    }
  );

  const adjustedValues = normalizeMetricArray(
    analyzedRows.map((row) => row[valueKey] ?? 0)
  );

  const rankedAnalyzed = analyzedRows.map((row, rowIndex) => {
    const score = adjustedValues[rowIndex] ?? 0;

    return {
      _id: row._id,
      name: row.name,
      item: row.item,
      [valueKey]: row[valueKey],
      adjustedMetrics: [score],
      metricWeights,
      score,
      rank: null,
      accessClass: "average",
      borderColor: fallbackBorder,
      fillColor: fallbackFill,
      reason: "",
    };
  });

  rankedAnalyzed.sort((a, b) => a.score - b.score);

  const scoreClasses = classifyRows(rankedAnalyzed);

  rankedAnalyzed.forEach((row, index) => {
    row.rank = rankedAnalyzed.length - index;
    row.accessClass = scoreClasses[index];
    row.borderColor =
      ANALYSIS_COLORS?.[row.accessClass]?.borderColor || fallbackBorder;
    row.fillColor =
      ANALYSIS_COLORS?.[row.accessClass]?.fillColor || fallbackFill;
  });

  return {
    byId: new Map(
      rankedAnalyzed.map((row) => [
        row._id,
        {
          score: row.score,
          rank: row.rank,
          accessClass: row.accessClass,
          borderColor: row.borderColor,
          fillColor: row.fillColor,
          adjustedMetrics: row.adjustedMetrics,
          [valueKey]: row[valueKey],
          metricWeights: row.metricWeights,
          reason: row.reason || "",
        },
      ])
    ),
    ranked: [...rankedAnalyzed].sort((a, b) => b.score - a.score),
    isFallback: false,
    reason: "",
  };
}

export function buildMultiMetricFallbackEntry(
  item,
  ANALYSIS_COLORS,
  metricWeights,
  {
    valueKey = "values",
    reason = "Missing required fields.",
    nameFallback = "Unnamed",
  } = {}
) {
  const { fallbackBorder, fallbackFill } = getAnalysisColors(ANALYSIS_COLORS);

  return {
    _id: item?._id,
    name: getTextValue(item, 0, 0, nameFallback),
    item,
    [valueKey]: [],
    adjustedMetrics: [],
    metricWeights,
    score: 0,
    rank: null,
    accessClass: "fallback",
    borderColor: fallbackBorder,
    fillColor: fallbackFill,
    reason,
  };
}

export function buildMultiMetricDatasetFallbackResult(
  data = [],
  ANALYSIS_COLORS,
  metricWeights,
  {
    valueKey = "values",
    reason = "This project does not include the required fields.",
    nameFallback = "Unnamed",
  } = {}
) {
  const ranked = (Array.isArray(data) ? data : []).map((item) =>
    buildMultiMetricFallbackEntry(item, ANALYSIS_COLORS, metricWeights, {
      valueKey,
      reason,
      nameFallback,
    })
  );

  const byId = new Map(
    ranked.map((row) => [
      row._id,
      {
        score: row.score,
        rank: row.rank,
        accessClass: row.accessClass,
        borderColor: row.borderColor,
        fillColor: row.fillColor,
        adjustedMetrics: row.adjustedMetrics,
        [valueKey]: row[valueKey],
        metricWeights: row.metricWeights,
        reason: row.reason,
      },
    ])
  );

  return {
    byId,
    ranked,
    isFallback: true,
    reason,
  };
}

export function hasRequiredCapacityFields(dataItem, schema) {
  const dataSection = dataItem?.sections?.[3];
  const schemaSection = schema?.sections?.[3];

  if (!dataSection || !Array.isArray(dataSection.inputs)) return false;
  if (!schemaSection || !Array.isArray(schemaSection.inputs)) return false;

  return [0, 1, 2, 3, 4, 5].every((index) => {
    const dataInput = dataSection.inputs[index];
    const schemaInput = schemaSection.inputs[index];

    return Boolean(
      dataInput &&
        dataInput.id != null &&
        dataInput.mode === "Single Value" &&
        Number.isFinite(Number(dataInput.singleValue)) &&
        schemaInput &&
        schemaInput.type === "capacity"
    );
  });
}

export function hasRequiredAssetAndCapacityFields(dataItem, schema) {
  return (
    hasRequiredAssetFields(dataItem) &&
    hasRequiredCapacityFields(dataItem, schema)
  );
}