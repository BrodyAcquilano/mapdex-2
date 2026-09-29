import {
  getQuantitativeValue,
  getTextValue,
  getCentroid,
  hasRequiredAssetFields,
  normalizeMetricArray,
  classifyRows,
  getDistanceKm,
  getAnalysisColors,
  buildMultiMetricFallbackEntry,
  buildMultiMetricDatasetFallbackResult,
} from "../utils/analysisHelpers.js";

function hasRequiredInfluenceFields(dataItem) {
  return hasRequiredAssetFields(dataItem) && Boolean(getCentroid(dataItem));
}

// Linear travel-time style decay.
// Nearby zones contribute more.
// Farther zones contribute less, but still accumulate gradually.
function computeInfluenceWeight(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;

  return 1 / (1 + 2 * distanceKm);
}

export function cumulativeResourceInfluence(
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

  const minimumInfluenceWeight = 0.01;
  const { fallbackBorder, fallbackFill } = getAnalysisColors(ANALYSIS_COLORS);

  if (!Array.isArray(data) || data.length === 0) {
    return {
      byId: new Map(),
      ranked: [],
      isFallback: false,
      reason: "",
    };
  }

  const supportedItems = data.filter(hasRequiredInfluenceFields);

  if (supportedItems.length === 0) {
    return buildMultiMetricDatasetFallbackResult(
      data,
      ANALYSIS_COLORS,
      baseMetricWeights,
      {
        valueKey: "cumulativeInfluenceAssets",
        reason:
          "This project does not include the required Neighbourhood Assets fields and centroids needed for cumulative resource influence analysis.",
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
        valueKey: "cumulativeInfluenceAssets",
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
    const centroid = getCentroid(item);

    const rawAssets = [
      getQuantitativeValue(item, 2, 0, 0),
      getQuantitativeValue(item, 2, 1, 0),
      getQuantitativeValue(item, 2, 2, 0),
      getQuantitativeValue(item, 2, 3, 0),
      getQuantitativeValue(item, 2, 4, 0),
      getQuantitativeValue(item, 2, 5, 0),
    ];

    return {
      _id: item?._id,
      name: getTextValue(item, 0, 0, "Unnamed"),
      item,
      centroid,
      rawAssets,
    };
  });

  const influenceRows = analyzedRows.map((row, rowIndex) => {
    const cumulativeInfluenceAssets = row.rawAssets.map(
      (localMetric, metricIndex) => {
        let total = localMetric;

        for (
          let otherIndex = 0;
          otherIndex < analyzedRows.length;
          otherIndex += 1
        ) {
          if (otherIndex === rowIndex) continue;

          const otherRow = analyzedRows[otherIndex];
          const otherMetric = otherRow.rawAssets[metricIndex] ?? 0;

          if (!Number.isFinite(otherMetric) || otherMetric <= 0) continue;

          const distanceKm = getDistanceKm(row.centroid, otherRow.centroid);
          const weight = computeInfluenceWeight(distanceKm);

          if (weight < minimumInfluenceWeight) continue;

          total += otherMetric * weight;
        }

        return total;
      }
    );

    return {
      ...row,
      cumulativeInfluenceAssets,
    };
  });

  const metricColumns = Array.from({ length: 6 }, (_, metricIndex) =>
    influenceRows.map((row) => row.cumulativeInfluenceAssets[metricIndex] ?? 0)
  );

  const adjustedMetricColumns = Array.from({ length: 6 }, (_, metricIndex) => {
    if (!enabledInputs[metricIndex]) {
      return influenceRows.map(() => 0);
    }

    return normalizeMetricArray(metricColumns[metricIndex]);
  });

  const rankedAnalyzed = influenceRows.map((row, rowIndex) => {
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
      rawAssets: row.rawAssets,
      cumulativeInfluenceAssets: row.cumulativeInfluenceAssets,
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
    .filter((item) => !hasRequiredInfluenceFields(item))
    .map((item) =>
      buildMultiMetricFallbackEntry(
        item,
        ANALYSIS_COLORS,
        metricWeights,
        {
          valueKey: "cumulativeInfluenceAssets",
          reason:
            "This zone is missing the required Neighbourhood Assets fields or centroid needed for cumulative resource influence analysis.",
        }
      )
    )
    .map((row) => ({
      ...row,
      rawAssets: [],
    }));

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
        rawAssets: row.rawAssets,
        cumulativeInfluenceAssets: row.cumulativeInfluenceAssets,
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