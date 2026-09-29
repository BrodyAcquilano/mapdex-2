import {
  getQuantitativeValue,
  buildSingleMetricDatasetFallbackResult,
  buildSingleMetricFallbackEntry,
  buildSingleMetricRankedRows,
} from "../utils/analysisHelpers.js";

function hasRequiredPopulationField(dataItem) {
  const population = getQuantitativeValue(dataItem, 0, 1, NaN);
  return Number.isFinite(population) && population >= 0;
}

export function populationDistribution(
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

  const supportedItems = data.filter(hasRequiredPopulationField);

  if (supportedItems.length === 0) {
    return buildSingleMetricDatasetFallbackResult(
      data,
      ANALYSIS_COLORS,
      {
        valueKey: "populationValue",
        fallbackValue: 0,
        reason: "This project does not include the required population field.",
      }
    );
  }

  const rankedResult = buildSingleMetricRankedRows(
    supportedItems,
    ANALYSIS_COLORS,
    {
      valueKey: "populationValue",
      valueGetter: (item) => getQuantitativeValue(item, 0, 1, 0),
    }
  );

  const missingRows = data
    .filter((item) => !hasRequiredPopulationField(item))
    .map((item) =>
      buildSingleMetricFallbackEntry(item, ANALYSIS_COLORS, {
        valueKey: "populationValue",
        fallbackValue: 0,
        reason: "This zone is missing the required population field.",
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
        populationValue: row.populationValue,
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