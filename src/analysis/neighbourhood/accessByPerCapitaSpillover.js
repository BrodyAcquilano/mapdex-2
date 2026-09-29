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

function hasRequiredSpilloverFields(dataItem) {
  return hasRequiredAssetFields(dataItem) && Boolean(getCentroid(dataItem));
}

function computePerCapita(assetCount, population) {
  if (!Number.isFinite(population) || population <= 0) return 0;
  if (!Number.isFinite(assetCount) || assetCount <= 0) return 0;
  return assetCount / population;
}

// Linear round-trip style decay.
// Nearby zones contribute more.
// Farther zones still contribute, but fade gradually.
// This treats the effective effort as scaling with 2d rather than d².
function computeSpilloverWeight(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;

  return 1 / (1 + 2 * distanceKm);
}

export function accessByPerCapitaSpillover(
  data = [],
  ANALYSIS_COLORS,
  analysisInputs = []
) {
  const baseMetricWeights = [
    0.16666666666, // Green Space
    0.16666666666, // Schools
    0.16666666666, // Libraries
    0.16666666666, // Healthcare
    0.16666666666, // Transit Stops
    0.16666666666, // Community Spaces
  ];

  const minimumSpilloverWeight = 0.01;
  const { fallbackBorder, fallbackFill } = getAnalysisColors(ANALYSIS_COLORS);

  if (!Array.isArray(data) || data.length === 0) {
    return {
      byId: new Map(),
      ranked: [],
      isFallback: false,
      reason: "",
    };
  }

  const supportedItems = data.filter(hasRequiredSpilloverFields);

  if (supportedItems.length === 0) {
    return buildMultiMetricDatasetFallbackResult(
      data,
      ANALYSIS_COLORS,
      baseMetricWeights,
      {
        valueKey: "perCapitaAssets",
        reason:
          "This project does not include the required Neighbourhood Assets fields and centroids needed for spillover analysis.",
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
        valueKey: "perCapitaAssets",
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
    const centroid = getCentroid(item);

    const assetCounts = [
      getQuantitativeValue(item, 2, 0, 0),
      getQuantitativeValue(item, 2, 1, 0),
      getQuantitativeValue(item, 2, 2, 0),
      getQuantitativeValue(item, 2, 3, 0),
      getQuantitativeValue(item, 2, 4, 0),
      getQuantitativeValue(item, 2, 5, 0),
    ];

    const perCapitaAssets = assetCounts.map((count) =>
      computePerCapita(count, population)
    );

    return {
      _id: item?._id,
      name: getTextValue(item, 0, 0, "Unnamed"),
      item,
      centroid,
      perCapitaAssets,
    };
  });

  const spilloverRows = analyzedRows.map((row, rowIndex) => {
    const spilloverAssets = row.perCapitaAssets.map((localMetric, metricIndex) => {
      let total = localMetric;

      for (let otherIndex = 0; otherIndex < analyzedRows.length; otherIndex += 1) {
        if (otherIndex === rowIndex) continue;

        const otherRow = analyzedRows[otherIndex];
        const otherMetric = otherRow.perCapitaAssets[metricIndex] ?? 0;

        if (!Number.isFinite(otherMetric) || otherMetric <= 0) continue;

        const distanceKm = getDistanceKm(row.centroid, otherRow.centroid);
        const weight = computeSpilloverWeight(distanceKm);

        if (weight < minimumSpilloverWeight) continue;

        total += otherMetric * weight;
      }

      return total;
    });

    return {
      ...row,
      spilloverAssets,
    };
  });

  const metricColumns = Array.from({ length: 6 }, (_, metricIndex) =>
    spilloverRows.map((row) => row.spilloverAssets[metricIndex] ?? 0)
  );

  const adjustedMetricColumns = Array.from({ length: 6 }, (_, metricIndex) => {
    if (!enabledInputs[metricIndex]) {
      return spilloverRows.map(() => 0);
    }

    return normalizeMetricArray(metricColumns[metricIndex]);
  });

  const rankedAnalyzed = spilloverRows.map((row, rowIndex) => {
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
      perCapitaAssets: row.perCapitaAssets,
      spilloverAssets: row.spilloverAssets,
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
    .filter((item) => !hasRequiredSpilloverFields(item))
    .map((item) =>
      buildMultiMetricFallbackEntry(
        item,
        ANALYSIS_COLORS,
        metricWeights,
        {
          valueKey: "spilloverAssets",
          reason:
            "This zone is missing the required Neighbourhood Assets fields or centroid needed for spillover analysis.",
        }
      )
    )
    .map((row) => ({
      ...row,
      perCapitaAssets: [],
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
        perCapitaAssets: row.perCapitaAssets,
        spilloverAssets: row.spilloverAssets,
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