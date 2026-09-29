import {
  getQuantitativeValue,
  buildSingleMetricDatasetFallbackResult,
  buildSingleMetricFallbackEntry,
  buildSingleMetricRankedRows,
} from "../utils/analysisHelpers.js";

function hasRequiredPopulationDensityField(dataItem) {
  const density = getQuantitativeValue(dataItem, 1, 4, NaN);
  return Number.isFinite(density) && density >= 0;
}

export function populationDensityDistribution(
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

  const supportedItems = data.filter(hasRequiredPopulationDensityField);

  if (supportedItems.length === 0) {
    return buildSingleMetricDatasetFallbackResult(
      data,
      ANALYSIS_COLORS,
      {
        valueKey: "populationDensityValue",
        fallbackValue: 0,
        reason:
          "This project does not include the required population density field.",
      }
    );
  }

  const rankedResult = buildSingleMetricRankedRows(
    supportedItems,
    ANALYSIS_COLORS,
    {
      valueKey: "populationDensityValue",
      valueGetter: (item) => getQuantitativeValue(item, 1, 4, 0),
    }
  );

  const missingRows = data
    .filter((item) => !hasRequiredPopulationDensityField(item))
    .map((item) =>
      buildSingleMetricFallbackEntry(item, ANALYSIS_COLORS, {
        valueKey: "populationDensityValue",
        fallbackValue: 0,
        reason: "This zone is missing the required population density field.",
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
        populationDensityValue: row.populationDensityValue,
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