import {
  getQuantitativeValue,
  buildSingleMetricDatasetFallbackResult,
  buildSingleMetricFallbackEntry,
  buildSingleMetricRankedRows,
} from "../utils/analysisHelpers.js";

function hasRequiredAreaField(dataItem) {
  const area = getQuantitativeValue(dataItem, 1, 3, NaN);
  return Number.isFinite(area) && area >= 0;
}

export function areaDistribution(
  data = [],
  ANALYSIS_COLORS,
  analysisInputs = []
) {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      byId: new Map(),
      ranked: [],
      isFallback: false,
      reason: "",
    };
  }

  const supportedItems = data.filter(hasRequiredAreaField);

  if (supportedItems.length === 0) {
    return buildSingleMetricDatasetFallbackResult(
      data,
      ANALYSIS_COLORS,
      {
        valueKey: "areaValue",
        fallbackValue: 0,
        reason: "This project does not include the required land area field.",
      }
    );
  }

  const rankedResult = buildSingleMetricRankedRows(
    supportedItems,
    ANALYSIS_COLORS,
    {
      valueKey: "areaValue",
      valueGetter: (item) => getQuantitativeValue(item, 1, 3, 0),
    }
  );

  const missingRows = data
    .filter((item) => !hasRequiredAreaField(item))
    .map((item) =>
      buildSingleMetricFallbackEntry(item, ANALYSIS_COLORS, {
        valueKey: "areaValue",
        fallbackValue: 0,
        reason: "This zone is missing the required land area field.",
      })
    );

  const allRows = [...rankedResult.ranked, ...missingRows];

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
        areaValue: row.areaValue,
        metricWeights: row.metricWeights,
        reason: row.reason || "",
      },
    ])
  );

  return {
    byId,
    ranked: rankedResult.ranked,
    isFallback: false,
    reason: "",
  };
}