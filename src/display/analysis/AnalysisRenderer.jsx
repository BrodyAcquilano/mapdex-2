export function renderAnalysisSection(
  selectedDataItem,
  schema,
  analysisResult,
) {
  if (schema?.engineKey !== "neighbourhoods") return null;
  if (!selectedDataItem?._id) return null;
  if (!(analysisResult?.byId instanceof Map)) return null;

  const result = analysisResult.byId.get(selectedDataItem._id);
  if (!result) return null;

  return (
    <div
      className="section analysis-result-section"
      role="region"
      aria-labelledby="analysis-result-title"
    >
      <h3 id="analysis-result-title">Analysis Result</h3>

      <div className="inline-row">
        <div className="label-container">Rank</div>
        <div className="value-container">
          {result.rank != null ? result.rank : "—"}
        </div>
      </div>

      <div className="inline-row">
        <div className="label-container">Score</div>
        <div className="value-container">
          {typeof result.score === "number" ? result.score.toFixed(4) : "—"}
        </div>
      </div>

      <div className="inline-row">
        <div className="label-container">Access Class</div>
        <div className="value-container">{result.accessClass || "—"}</div>
      </div>

      <div className="inline-row">
        <div className="label-container">Per Capita Assets</div>
        <div className="value-container">
          {Array.isArray(result.perCapitaAssets)
            ? result.perCapitaAssets
                .map((value) =>
                  typeof value === "number" ? value.toFixed(4) : "0.0000"
                )
                .join(", ")
            : "—"}
        </div>
      </div>

      <div className="inline-row">
        <div className="label-container">Adjusted Metrics</div>
        <div className="value-container">
          {Array.isArray(result.adjustedMetrics)
            ? result.adjustedMetrics
                .map((value) =>
                  typeof value === "number" ? value.toFixed(4) : "0.0000"
                )
                .join(", ")
            : "—"}
        </div>
      </div>

      <div className="inline-row">
        <div className="label-container">Metric Weights</div>
        <div className="value-container">
          {Array.isArray(result.metricWeights)
            ? result.metricWeights
                .map((value) =>
                  typeof value === "number" ? value.toFixed(4) : "0.0000"
                )
                .join(", ")
            : "—"}
        </div>
      </div>

      {result.reason ? (
        <div className="inline-row">
          <div className="label-container">Reason</div>
          <div className="value-container">{result.reason}</div>
        </div>
      ) : null}
    </div>
  );
}