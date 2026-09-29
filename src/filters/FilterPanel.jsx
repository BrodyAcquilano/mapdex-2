import { useState } from "react";
import "../styles/panels.css";
import { renderFiltersBySchema } from "./renderFiltersBySchema.jsx";

function FilterPanel({
  schema,
  filterState,
  setFilterState,
  viewerTimeZone,
  timeFilterOverride,
  setTimeFilterOverride,
  filterTimezoneMode,
  setFilterTimezoneMode,
  filterTimeZone,
  setFilterTimeZone,
  TIMEZONE_OPTIONS,
  clearFilters,
  filteredData,
  system,
  exports,
  /*
   * The project's boundaries, plus the callback that opens the
   * boundary-selection sub-workflow. Both optional: a page that has
   * not wired that sub-workflow up simply gets no boundary control in
   * the geometry section rather than a dead button.
   */
  boundaries,
  onSelectBoundary,
  // Layers.jsx passes this while its own Add Layer panel has its own
  // export button on screen - having both here would read as two
  // competing exports for the same filtered data.
  hideExportButton,
}) {
  const [tagFilterDrafts, setTagFilterDrafts] = useState({});
  const [priceRangeFilterDrafts, setPriceRangeFilterDrafts] = useState({});

  /*
   * Anyone who can see the project can export it - see src/exports/.
   * Presence stays excluded: those data items are people's GPS
   * positions, which is a rule about the data itself, not a permission.
   */
  const canExportFilteredData =
    !hideExportButton && schema?.engineKey !== "presence";

  /* Local now - see runtime.exports. */
  const handleExportFilteredData = () => {
    exports.filteredProject({ schema, filteredData, system });
  };

  return (
    <div className="panel" role="region" aria-label="Filter Panel">
      <div className="section">
        <h2>Filter Panel</h2>
      </div>

      {renderFiltersBySchema({
        schema,
        filterState,
        setFilterState,
        boundaries,
        onSelectBoundary,
        filterTimeZone,
        setFilterTimeZone,
        filterTimezoneMode,
        setFilterTimezoneMode,
        viewerTimeZone,
        timeFilterOverride,
        setTimeFilterOverride,
        TIMEZONE_OPTIONS,
        tagFilterDrafts,
        setTagFilterDrafts,
        priceRangeFilterDrafts,
        setPriceRangeFilterDrafts,
      })}

      <div className="section">
        <div className="buttons-container-two">
          <button type="button" className="clear-button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {canExportFilteredData && (
        <div className="section">
          <div className="buttons-container-two">
            <button
              type="button"
              className="clear-button"
              onClick={handleExportFilteredData}
            >
              Export Filtered Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterPanel;