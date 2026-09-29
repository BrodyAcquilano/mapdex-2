// src/boundaries/BoundaryListPanel/BoundaryListPanel.jsx

import BoundaryList from "../BoundaryList/BoundaryList.jsx";

import "./BoundaryListPanel.css";

/*
 * The Boundaries page's own list panel - a titled shell around the
 * shared BoundaryList rows, plus the export footer.
 *
 * Boundaries used to be a *tab* inside both the Layers and the
 * Aggregates list panels. Now that they have their own route
 * (src/workflows/Boundaries.jsx) there is nothing to switch between, so
 * this panel carries a plain header instead of a tab strip - and the
 * other two panels lost their tab strips for the same reason, each
 * gaining its own "Layers List"/"Aggregates List" header.
 *
 * The rows themselves still come from BoundaryList, which the Layers
 * and Aggregates pages no longer render but which stays a separate
 * component: BoundaryPickerPanel's own "pick a boundary" list is a
 * different job with different affordances, and this one is still the
 * only place a boundary's own visibility/opacity is controlled.
 */
export default function BoundaryListPanel({
  boundaries,
  selectedBoundaryId,
  onSelectBoundary,
  onToggleVisible,
  onOpacityChange,
  canExport,
  onExport,
  isExporting,
}) {
  const hasVisibleBoundaries = (boundaries || []).some(
    (boundary) => boundary.visible !== false,
  );

  return (
    <div className="boundary-list-panel" role="region" aria-label="Boundary List Panel">
      <div className="boundary-list-panel-header">Boundaries List</div>

      <BoundaryList
        boundaries={boundaries}
        selectedBoundaryId={selectedBoundaryId}
        onSelectBoundary={onSelectBoundary}
        onToggleVisible={onToggleVisible}
        onOpacityChange={onOpacityChange}
      />

      {canExport && (
        <div className="boundary-list-panel-footer">
          <button
            type="button"
            className="boundary-list-export-button"
            onClick={onExport}
            disabled={isExporting || !hasVisibleBoundaries}
          >
            Export Visible Boundaries
          </button>
        </div>
      )}
    </div>
  );
}
