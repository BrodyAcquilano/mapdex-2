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

function hasRequiredDistributionFields(dataItem) {
  return hasRequiredAssetFields(dataItem) && Boolean(getCentroid(dataItem));
}

function computeDistributionPull(
  localWeight,
  otherWeight,
  distanceKm,
  minimumDistanceKm = 0.25
) {
  if (!Number.isFinite(localWeight)) return 0;
  if (!Number.isFinite(otherWeight)) return 0;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;

  const safeDistance = Math.max(distanceKm, minimumDistanceKm);
  return (localWeight - otherWeight) / (safeDistance * safeDistance);
}

export function resourceDistributionMapping(
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

  const supportedItems = data.filter(hasRequiredDistributionFields);

  if (supportedItems.length === 0) {
    return buildMultiMetricDatasetFallbackResult(
      data,
      ANALYSIS_COLORS,
      baseMetricWeights,
      {
        valueKey: "distributionAssets",
        reason:
          "This project does not include the required Neighbourhood Assets fields and centroids needed for resource distribution analysis.",
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
        valueKey: "distributionAssets",
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
      normalizedAssets: [],
    };
  });

  const rawMetricColumns = Array.from({ length: 6 }, (_, metricIndex) =>
    analyzedRows.map((row) => row.rawAssets[metricIndex] ?? 0)
  );

  const normalizedMetricColumns = Array.from({ length: 6 }, (_, metricIndex) =>
    normalizeMetricArray(rawMetricColumns[metricIndex])
  );

  const normalizedRows = analyzedRows.map((row, rowIndex) => {
    const normalizedAssets = normalizedMetricColumns.map(
      (column) => column[rowIndex] ?? 0
    );

    return {
      ...row,
      normalizedAssets,
    };
  });

  const distributionRows = normalizedRows.map((row, rowIndex) => {
    const distributionAssets = row.normalizedAssets.map(
      (localWeight, metricIndex) => {
        let total = 0;

        for (
          let otherIndex = 0;
          otherIndex < normalizedRows.length;
          otherIndex += 1
        ) {
          if (otherIndex === rowIndex) continue;

          const otherRow = normalizedRows[otherIndex];
          const otherWeight = otherRow.normalizedAssets[metricIndex] ?? 0;
          const distanceKm = getDistanceKm(row.centroid, otherRow.centroid);

          total += computeDistributionPull(
            localWeight,
            otherWeight,
            distanceKm,
            minimumDistanceKm
          );
        }

        return total;
      }
    );

    return {
      ...row,
      distributionAssets,
    };
  });

  const metricColumns = Array.from({ length: 6 }, (_, metricIndex) =>
    distributionRows.map((row) => row.distributionAssets[metricIndex] ?? 0)
  );

  const adjustedMetricColumns = Array.from({ length: 6 }, (_, metricIndex) => {
    if (!enabledInputs[metricIndex]) {
      return distributionRows.map(() => 0);
    }

    const column = metricColumns[metricIndex];
    const min = Math.min(...column);
    const max = Math.max(...column);

    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      return distributionRows.map(() => 0);
    }

    return column.map((value) => (value - min) / (max - min));
  });

  const rankedAnalyzed = distributionRows.map((row, rowIndex) => {
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
      normalizedAssets: row.normalizedAssets,
      distributionAssets: row.distributionAssets,
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
    .filter((item) => !hasRequiredDistributionFields(item))
    .map((item) =>
      buildMultiMetricFallbackEntry(
        item,
        ANALYSIS_COLORS,
        metricWeights,
        {
          valueKey: "distributionAssets",
          reason:
            "This zone is missing the required Neighbourhood Assets fields or centroid needed for resource distribution analysis.",
        }
      )
    )
    .map((row) => ({
      ...row,
      rawAssets: [],
      normalizedAssets: [],
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
        normalizedAssets: row.normalizedAssets,
        distributionAssets: row.distributionAssets,
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