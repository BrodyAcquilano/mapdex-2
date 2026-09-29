// src/boundaries/FilterBoundarySelection/FilterBoundarySelection.jsx

import PanelToggle, { PanelContainer } from "../../panels/PanelToggle/PanelToggle.jsx";
import BoundaryPickerPanel from "../BoundaryPickerPanel/BoundaryPickerPanel.jsx";

import "../BoundaryGeometryActions/BoundaryGeometryActions.css";

/*
 * The geometry filter's "pick a boundary" loop, rendered identically
 * wherever the filter panel appears - Viewer and Editor through each
 * engine's AppAdapter, and the Layers and Aggregates pages through
 * their own filter step.
 *
 * The filter panel itself knows nothing about which page it is on: it
 * always offers Select Boundary, and opening it always takes the screen
 * over the same way. What differs per page is only what that page does
 * with the resulting filter state, which happens outside this
 * component.
 *
 * Back here means "return to the filter panel" - it cancels the pick and
 * reveals the panel again. That is deliberately NOT the same as the
 * Back on the Layers and Aggregates pages' own first step, which leaves
 * the Add tool entirely: that step is the page's own, reached before
 * the filter panel ever appears, so there is no panel to go back to.
 * Both routes agree on the primary action, though - Select Boundary
 * commits and lands you on the filter panel either way.
 *
 * The caller is responsible for hiding its own filter panel while this
 * is open (hidden, not unmounted, so nothing about its state changes).
 */
export default function FilterBoundarySelection({
  isSelectingFilterBoundary,
  showFilterBoundaryPicker,
  setShowFilterBoundaryPicker,
  filterBoundaryDraft,
  setFilterBoundaryDraft,
  onCancel,
  onSave,
  boundaries,
}) {
  if (!isSelectingFilterBoundary) return null;

  return (
    <>
      <PanelToggle
        side="left"
        isOpen={showFilterBoundaryPicker}
        setIsOpen={setShowFilterBoundaryPicker}
        label="Toggle Select Boundary Panel"
      />

      <PanelContainer side="left" isOpen={showFilterBoundaryPicker}>
        <BoundaryPickerPanel
          value={filterBoundaryDraft}
          onChange={setFilterBoundaryDraft}
          boundaries={boundaries}
          hint="Choose how this filter constrains the data - a bounding box, or one of the project's boundaries. Draw or import boundaries on the Boundaries page."
        />
      </PanelContainer>

      <div className="boundary-actions-row">
        <button type="button" className="boundary-action-button secondary" onClick={onCancel}>
          Back
        </button>

        <button type="button" className="boundary-action-button primary" onClick={onSave}>
          Select Boundary
        </button>
      </div>
    </>
  );
}
