// src/filters/hooks/useFilterBoundarySelection.js

import { useCallback, useState } from "react";

import { useCloseBoundarySelectionOnPageChange } from "../../boundaries/hooks/useCloseBoundarySelectionOnPageChange.js";

/*
 * The geometry filter's own "pick a boundary" sub-workflow.
 *
 * The filter panel never edits the boundary inline - it shows what the
 * boundary half currently amounts to and hands off to here, which takes
 * the screen over: the filter panel is hidden (its state untouched), the
 * map stops drawing data and draws the project's boundaries instead, and
 * BoundaryPickerPanel opens in its place. Saving writes the whole
 * geometry filter value back into filterState; backing out discards it.
 *
 * The draft is the ENTIRE geometry filter value, not just an id - the
 * picker owns the boundary mode, the filter type, and either the
 * bounding box or the picked boundary, and those have to move together.
 * Holding it as a draft is what makes Back a genuine cancel: filterState
 * is only touched on save, so the map's data doesn't re-filter
 * underneath you while you're still choosing.
 *
 * Lives in src/filters/ rather than the runtime because what it
 * ultimately produces is a filter value, matching how the rest of the
 * runtime's hooks are filed by what they produce.
 */
export function useFilterBoundarySelection({ filterState, setFilterState, currentPage }) {
  const [isSelectingFilterBoundary, setIsSelectingFilterBoundary] = useState(false);
  const [showFilterBoundaryPicker, setShowFilterBoundaryPicker] = useState(true);
  const [filterBoundaryDraft, setFilterBoundaryDraft] = useState({});

  const openFilterBoundarySelection = useCallback(() => {
    const geometry = filterState?.geometry;

    setFilterBoundaryDraft(
      geometry && typeof geometry === "object" ? { ...geometry } : {},
    );

    setShowFilterBoundaryPicker(true);
    setIsSelectingFilterBoundary(true);
  }, [filterState?.geometry]);

  const cancelFilterBoundarySelection = useCallback(() => {
    setIsSelectingFilterBoundary(false);
  }, []);

  /*
   * This state is shared but the panel it drives is rendered per page,
   * so leaving a page mid-selection would otherwise carry the picker
   * onto the next one. See the hook's own comment.
   */
  useCloseBoundarySelectionOnPageChange(currentPage, cancelFilterBoundarySelection);

  const saveFilterBoundarySelection = useCallback(() => {
    setFilterState((prev) => ({
      ...prev,
      geometry: {
        ...(prev?.geometry || {}),
        ...filterBoundaryDraft,
      },
    }));

    setIsSelectingFilterBoundary(false);
  }, [filterBoundaryDraft, setFilterState]);

  return {
    isSelectingFilterBoundary,
    showFilterBoundaryPicker,
    setShowFilterBoundaryPicker,
    filterBoundaryDraft,
    setFilterBoundaryDraft,
    openFilterBoundarySelection,
    cancelFilterBoundarySelection,
    saveFilterBoundarySelection,
  };
}
