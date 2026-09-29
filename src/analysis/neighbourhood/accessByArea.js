import {
  getQuantitativeValue,
  getTextValue,
  hasRequiredAssetFields,
  normalizeMetricArray,
  classifyRows,
  getAnalysisColors,
  buildMultiMetricFallbackEntry,
  buildMultiMetricDatasetFallbackResult,
} from "../utils/analysisHelpers.js";

function computeRadiusFromAreaKm2(areaKm2) {
  if (!Number.isFinite(areaKm2) || areaKm2 <= 0) return 0;
  return Math.sqrt(areaKm2 / Math.PI);
}

function computeAverageTravelDistanceKm(
  areaKm2,
  travelFactor = 128 / (45 * Math.PI),
  minimumDistanceKm = 0.25
) {
  const radiusKm = computeRadiusFromAreaKm2(areaKm2);
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return 0;

  return Math.max(minimumDistanceKm, travelFactor * radiusKm);
}

function computeAreaDistanceMetric(
  assetCount,
  areaKm2,
  travelFactor = 128 / (45 * Math.PI),
  minimumDistanceKm = 0.25
) {
  if (!Number.isFinite(assetCount) || assetCount <= 0) return 0;
  if (!Number.isFinite(areaKm2) || areaKm2 <= 0) return 0;

  const averageTravelDistanceKm = computeAverageTravelDistanceKm(
    areaKm2,
    travelFactor,
    minimumDistanceKm
  );

  if (
    !Number.isFinite(averageTravelDistanceKm) ||
    averageTravelDistanceKm <= 0
  ) {
    return 0;
  }

  return assetCount / averageTravelDistanceKm;
}

export function accessByArea(
  data = [],
  ANALYSIS_COLORS,
  analysisInputs = []
) {
  const baseMetricWeights = [
    1 / 6, // Green Space
    1 / 6, // Schools
    1 / 6, // Libraries
    1 / 6, // Healthcare
    1 / 6, // Transit Stops
    1 / 6, // Community Spaces
  ];

  const travelFactor = 128 / (45 * Math.PI);
  const minimumDistanceKm = 0.25;
  const { fallbackBorder, fallbackFill } = getAnalysisColors(ANALYSIS_COLORS);

  if (!Array.isArray(data) || data.length === 0) {
    return {
      byId: new Map(),
      ranked: [],
      isFallback: false,
      reason: "",
    };
  }

  const supportedItems = data.filter(hasRequiredAssetFields);

  if (supportedItems.length === 0) {
    return buildMultiMetricDatasetFallbackResult(
      data,
      ANALYSIS_COLORS,
      baseMetricWeights,
      {
        valueKey: "areaDistanceAssets",
        reason:
          "This project does not include the required Neighbourhood Assets fields.",
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
        valueKey: "areaDistanceAssets",
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
    const areaKm2 = getQuantitativeValue(item, 1, 3, 0);

    const assetCounts = [
      getQuantitativeValue(item, 2, 0, 0),
      getQuantitativeValue(item, 2, 1, 0),
      getQuantitativeValue(item, 2, 2, 0),
      getQuantitativeValue(item, 2, 3, 0),
      getQuantitativeValue(item, 2, 4, 0),
      getQuantitativeValue(item, 2, 5, 0),
    ];

    const areaDistanceAssets = assetCounts.map((count) =>
      computeAreaDistanceMetric(
        count,
        areaKm2,
        travelFactor,
        minimumDistanceKm
      )
    );

    return {
      _id: item?._id,
      name: getTextValue(item, 0, 0, "Unnamed"),
      item,
      areaDistanceAssets,
    };
  });

  const metricColumns = Array.from({ length: 6 }, (_, metricIndex) =>
    analyzedRows.map((row) => row.areaDistanceAssets[metricIndex] ?? 0)
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
      areaDistanceAssets: row.areaDistanceAssets,
      adjustedMetrics,
      metricWeights,
      score: score,
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
    .filter((item) => !hasRequiredAssetFields(item))
    .map((item) =>
      buildMultiMetricFallbackEntry(
        item,
        ANALYSIS_COLORS,
        metricWeights,
        {
          valueKey: "areaDistanceAssets",
          reason: "This zone is missing the required Neighbourhood Assets fields.",
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
        areaDistanceAssets: row.areaDistanceAssets,
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