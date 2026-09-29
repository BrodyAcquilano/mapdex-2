import {
  getQuantitativeValue,
  getTextValue,
  hasRequiredAssetAndCapacityFields,
  normalizeMetricArray,
  classifyRows,
  getAnalysisColors,
  buildMultiMetricFallbackEntry,
  buildMultiMetricDatasetFallbackResult,
} from "../utils/analysisHelpers.js";

function computeThresholdedMetric(
  assetCount,
  population,
  usageShare,
  totalCapacity,
  w0 = 1,
  power = 1
) {
  if (!Number.isFinite(assetCount) || assetCount <= 0) return 0;
  if (!Number.isFinite(population) || population <= 0) return 0;
  if (!Number.isFinite(usageShare) || usageShare <= 0) return 0;
  if (!Number.isFinite(totalCapacity) || totalCapacity <= 0) return 0;

  const affectedPopulation = population * usageShare;
  const thresholdCapacity = totalCapacity;
  const excessDemand = Math.max(0, affectedPopulation - thresholdCapacity);

  const safeThresholdCapacity =
    Number.isFinite(thresholdCapacity) && thresholdCapacity > 0
      ? thresholdCapacity
      : 1;

  const w1 = 1 / safeThresholdCapacity;

  return assetCount / (w0 + w1 * excessDemand ** power);
}

export function accessByThresholdedDemand(
  data = [],
  ANALYSIS_COLORS,
  analysisInputs = [],
  schema,
) {
  const baseMetricWeights = [
    0.16666666666, // Green Space
    0.16666666666, // Schools
    0.16666666666, // Libraries
    0.16666666666, // Healthcare
    0.16666666666, // Transit Stops
    0.16666666666, // Community Spaces
  ];

  const usageShares = [
    1.0,
    0.2,
    0.35,
    0.85,
    0.55,
    0.5,
  ];

  const w0 = 1;
  const power = 1;
  const { fallbackBorder, fallbackFill } = getAnalysisColors(ANALYSIS_COLORS);

  if (!Array.isArray(data) || data.length === 0) {
    return {
      byId: new Map(),
      ranked: [],
      isFallback: false,
      reason: "",
    };
  }

  const supportedItems = data.filter((item) =>
    hasRequiredAssetAndCapacityFields(item, schema)
  );

  if (supportedItems.length === 0) {
    return buildMultiMetricDatasetFallbackResult(
      data,
      ANALYSIS_COLORS,
      baseMetricWeights,
      {
        valueKey: "thresholdedAssets",
        reason:
          "This project does not include the required Neighbourhood Assets and Neighbourhood Capacity fields.",
      }
    );
  }

  const enabledInputs =
    Array.isArray(analysisInputs) && analysisInputs.length === 6
      ? analysisInputs.map((input) => Boolean(input?.selected))
      : [true, true, true, true, true, true];

  const activeMetricIndexes = enabledInputs
    .map((enabled, index) => (enabled ? index : -1))
    .filter((index) => index !== -1);

  if (activeMetricIndexes.length === 0) {
    return buildMultiMetricDatasetFallbackResult(
      data,
      ANALYSIS_COLORS,
      baseMetricWeights,
      {
        valueKey: "thresholdedAssets",
        reason: "At least one analysis input must be selected.",
      }
    );
  }

  const activeWeightTotal = activeMetricIndexes.reduce(
    (sum, index) => sum + baseMetricWeights[index],
    0
  );

  const metricWeights = baseMetricWeights.map((weight, index) =>
    activeMetricIndexes.includes(index) ? weight / activeWeightTotal : 0
  );

  const analyzedRows = supportedItems.map((item) => {
    const population = getQuantitativeValue(item, 0, 1, 0);

    const assetCounts = [
      getQuantitativeValue(item, 2, 0, 0),
      getQuantitativeValue(item, 2, 1, 0),
      getQuantitativeValue(item, 2, 2, 0),
      getQuantitativeValue(item, 2, 3, 0),
      getQuantitativeValue(item, 2, 4, 0),
      getQuantitativeValue(item, 2, 5, 0),
    ];

    const totalCapacities = [
      getQuantitativeValue(item, 3, 0, 0),
      getQuantitativeValue(item, 3, 1, 0),
      getQuantitativeValue(item, 3, 2, 0),
      getQuantitativeValue(item, 3, 3, 0),
      getQuantitativeValue(item, 3, 4, 0),
      getQuantitativeValue(item, 3, 5, 0),
    ];

    const thresholdedAssets = assetCounts.map((count, index) =>
      computeThresholdedMetric(
        count,
        population,
        usageShares[index],
        totalCapacities[index],
        w0,
        power
      )
    );

    return {
      _id: item?._id,
      name: getTextValue(item, 0, 0, "Unnamed"),
      item,
      thresholdedAssets,
    };
  });

  const metricColumns = Array.from({ length: 6 }, (_, metricIndex) =>
    analyzedRows.map((row) => row.thresholdedAssets[metricIndex] ?? 0)
  );

  const adjustedMetricColumns = Array.from({ length: 6 }, (_, metricIndex) => {
    if (!enabledInputs[metricIndex]) {
      return analyzedRows.map(() => 0);
    }

    return normalizeMetricArray(metricColumns[metricIndex]);
  });

  const rankedAnalyzed = analyzedRows.map((row, rowIndex) => {
    const adjustedMetrics = adjustedMetricColumns.map(
      (column) => column[rowIndex] ?? 0
    );

    const score = activeMetricIndexes.reduce((sum, metricIndex) => {
      return sum + adjustedMetrics[metricIndex] * metricWeights[metricIndex];
    }, 0);

    return {
      _id: row._id,
      name: row.name,
      item: row.item,
      thresholdedAssets: row.thresholdedAssets,
      adjustedMetrics,
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

  const missingRows = data
    .filter((item) => !hasRequiredAssetAndCapacityFields(item, schema))
    .map((item) =>
      buildMultiMetricFallbackEntry(
        item,
        ANALYSIS_COLORS,
        metricWeights,
        {
          valueKey: "thresholdedAssets",
          reason:
            "This zone is missing the required Neighbourhood Assets or Neighbourhood Capacity fields.",
        }
      )
    );

  const allRows = [...rankedAnalyzed, ...missingRows];

  const byId = new Map(
    allRows.map((row) => [
      row._id,
      {
        score: row.score,
        rank: row.rank,
        accessClass: row.accessClass,
        borderColor: row.borderColor,
        fillColor: row.fillColor,
        adjustedMetrics: row.adjustedMetrics,
        thresholdedAssets: row.thresholdedAssets,
        metricWeights: row.metricWeights,
        reason: row.reason || "",
      },
    ])
  );

  return {
    byId,
    ranked: [...rankedAnalyzed].sort((a, b) => b.score - a.score),
    isFallback: false,
    reason: "",
  };
}