import { useEffect, useMemo } from "react";
import "../../styles/panels.css";

function NeighbourhoodAnalysisPanel({
  analysisInputs,
  setAnalysisInputs,
  analysisAlgorithm,
  setAnalysisAlgorithm,
  ALGORITHM_OPTIONS,
}) {
  const handleToggle = (index) => {
    setAnalysisInputs((prev) => {
      const next = prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item,
      );

      if (!next.some((item) => item.selected)) {
        return prev;
      }

      return next;
    });
  };

  const groupedOptions = useMemo(() => {
    const groups = {
      accessWithCapacity: [],
      access: [],
      distribution: [],
    };

    (ALGORITHM_OPTIONS || []).forEach((option) => {
      if (!option?.category) return;
      if (!groups[option.category]) return;
      groups[option.category].push(option);
    });

    return groups;
  }, [ALGORITHM_OPTIONS]);

  const CATEGORY_DESCRIPTIONS = useMemo(
    () => ({
      accessWithCapacity:
        "These models estimate access conditions using resource counts, population pressure, and service thresholds. The idea is that resources like schools, libraries, healthcare, transit, and community spaces can absorb population demand up to a certain point before access starts to fall. The thresholds used here are based on statistical averages, not the real measured capacity of each specific place.",

      access:
        "These models estimate access by combining resource counts with barriers that can make access harder. Depending on the method, the barrier may be population as competition, population density as crowding or social interference, average travel distance within the neighbourhood, or distance to nearby neighbourhoods that can add support to the local zone.",

      distribution:
        "These models do not show access conditions. They show how something is spread across the map, such as resource counts, land area, population, population density, proximity to neighbouring zones, or the influence of resource counts from nearby neighbours. They are best used as reference maps to help explain the access models.",
    }),
    [],
  );

  const selectedAlgorithm = useMemo(() => {
    return (ALGORITHM_OPTIONS || []).find(
      (option) => option.value === analysisAlgorithm,
    );
  }, [ALGORITHM_OPTIONS, analysisAlgorithm]);

  const selectedCategory = selectedAlgorithm?.category || "accessWithCapacity";

  const filteredAlgorithmOptions = groupedOptions[selectedCategory] || [];

  useEffect(() => {
    if (!filteredAlgorithmOptions.length) return;

    const currentStillValid = filteredAlgorithmOptions.some(
      (option) => option.value === analysisAlgorithm,
    );

    if (!currentStillValid) {
      setAnalysisAlgorithm(filteredAlgorithmOptions[0].value);
    }
  }, [filteredAlgorithmOptions, analysisAlgorithm, setAnalysisAlgorithm]);

  const handleCategoryChange = (nextCategory) => {
    const nextOptions = groupedOptions[nextCategory] || [];
    if (!nextOptions.length) return;

    setAnalysisAlgorithm(nextOptions[0].value);
  };

  const selectedCategoryDescription =
    CATEGORY_DESCRIPTIONS[selectedCategory] || "";

  return (
    <div className="panel" role="region" aria-label="Analysis Panel">
      <div className="section">
        <h2>Analysis Panel</h2>
      </div>

      <div className="section">
        <h3>Algorithm</h3>

        <div className="form-group">
          <label htmlFor="analysis-category-select">Algorithm Category</label>
          <select
            id="analysis-category-select"
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            {groupedOptions.accessWithCapacity.length > 0 && (
              <option value="accessWithCapacity">Access with Capacity</option>
            )}
            {groupedOptions.access.length > 0 && (
              <option value="access">Access</option>
            )}
            {groupedOptions.distribution.length > 0 && (
              <option value="distribution">Distributions</option>
            )}
          </select>
        </div>

        {selectedCategoryDescription ? (
          <p className="info-panel-description">
            {selectedCategoryDescription}
          </p>
        ) : null}

        <div className="form-group">
          <label htmlFor="analysis-algorithm-select">Analysis Method</label>
          <select
            id="analysis-algorithm-select"
            value={analysisAlgorithm}
            onChange={(e) => setAnalysisAlgorithm(e.target.value)}
          >
            {filteredAlgorithmOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {selectedAlgorithm?.note ? (
          <p className="info-panel-description">{selectedAlgorithm.note}</p>
        ) : null}
      </div>

      <div className="section">
        <h3>Included Inputs</h3>

        {analysisInputs?.map((input, index) => (
          <div key={input.id || input.label} className="inline-checkbox-row">
            <div className="checkbox-container">
              <input
                id={`analysis-input-${index}`}
                type="checkbox"
                checked={Boolean(input.selected)}
                onChange={() => handleToggle(index)}
              />
            </div>

            <label htmlFor={`analysis-input-${index}`} className="notes-cell">
              {input.label}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NeighbourhoodAnalysisPanel;
