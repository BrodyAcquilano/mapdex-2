// src/workflows/Aggregates.jsx

import { useEffect, useMemo, useRef, useState } from "react";

import FilterToggle from "../filters/FilterToggle.jsx";
import FilterPanel from "../filters/FilterPanel.jsx";
import PanelToggle, { PanelContainer } from "../panels/PanelToggle/PanelToggle.jsx";
import FilterBoundarySelection from "../boundaries/FilterBoundarySelection/FilterBoundarySelection.jsx";

import AggregateListPanel from "../aggregates/AggregateListPanel/AggregateListPanel.jsx";
import AggregateEditPanel from "../aggregates/AggregateEditPanel/AggregateEditPanel.jsx";
import AggregateInfoPanel from "../aggregates/AggregateInfoPanel/AggregateInfoPanel.jsx";
import AggregateFieldPicker from "../aggregates/AggregateFieldPicker/AggregateFieldPicker.jsx";
import AggregatesToolMenu from "../aggregates/AggregatesToolMenu/AggregatesToolMenu.jsx";
import { buildBoundariesById } from "../../shared/boundaries/filterBoundaryGeometry.js";
import {
  getAggregateMatchingData,
  computeAggregateResult,
} from "../aggregates/utils/computeAggregateResult.js";
import {
  DEFAULT_AGGREGATE_COLORS,
} from "../aggregates/utils/aggregateConstants.js";

import "./Aggregates.css";

/*
 * The Aggregates tool's own page - mirrors src/workflows/Layers.jsx's
 * own shape (the one file this feature puts in workflows/, everything
 * else under src/aggregates/), but with its own multi-phase Add
 * Aggregate workflow instead of Layers' single-step one:
 *
 *   1. Pick an existing boundary from the list (or draw/import one
 *      first - see the Boundaries tab's own toolbar below).
 *   2. Filter the project's own data (same FilterPanel every other
 *      Add workflow in this app reuses) to decide what the aggregate
 *      counts/sums/averages.
 *   3. Pick which schema fields to aggregate and what operation to
 *      run on each (AggregateFieldPicker).
 *   4. Name/describe/color it (AggregateEditPanel, mode="add").
 *
 * Only one of {boundaries, aggregates, the live-filtered Data Layer
 * preview} is ever on the map at once - see MapAdapter.jsx's own
 * useAggregatesMapData, which this page's own state entirely drives.
 *
 * Edit access (AggregateEditPanel) requires both admin/owner AND the
 * page's own Edit tool active - a viewer/editor, or an admin/owner
 * with Edit not selected, only ever gets the always-available
 * read-only AggregateInfoPanel for whatever's selected in the list.
 * Mirrors the same change made to src/workflows/Layers.jsx this
 * session (see MapAdapter.jsx / AppAdapter.jsx's own comments there).
 *
 * The Aggregates tab and the Boundaries tab each get their own toolbar
 * (AggregatesToolMenu.jsx / BoundariesToolMenu.jsx) - switching tabs
 * (handleChangeTab below) always deselects whatever tool was active,
 * per Brody's own call, since the two tabs' tools have nothing in
 * common. The Boundaries toolbar's own Draw Boundary/Move Vertex/Move
 * Boundary tools pass their draftGeometry.js tool key straight through
 * as aggregatesActiveTool itself ("multipolygon"/"move"/"moveGeometry")
 * rather than a boundary-specific name, so this page can reuse the
 * exact same DrawController/DrawingActionButtons machinery the
 * places/events editor already built for those same keys - see
 * BoundaryToolLayer.jsx (both map renderers) for the map-side half of
 * that reuse, wired in through each engine's own MapAdapter.jsx.
 */
function Aggregates({
  schema,
  data,
  filteredData,
  aggregates,
  boundaries,
  aggregateViewState,
  setAggregateViewState,
  selectedAggregateEntityId,
  setSelectedAggregateEntityId,
  aggregatesActiveTool,
  setAggregatesActiveTool,
  addAggregatePhase,
  setAddAggregatePhase,
  addAggregateFields,
  setAddAggregateFields,
  aggregateEditMode,
  setAggregateEditMode,
  draftAggregateColors,
  setDraftAggregateColors,
  createAggregate,
  updateAggregate,
  deleteAggregate,
  showFilter,
  setShowFilter,
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
  /*
   * The geometry filter's own boundary loop, shared with every other
   * page that shows the filter panel. This page only has to hide its own
   * filter panel while the loop is open and render the same component
   * the AppAdapter does - the filter panel itself is page-agnostic.
   */
  isSelectingFilterBoundary,
  showFilterBoundaryPicker,
  setShowFilterBoundaryPicker,
  filterBoundaryDraft,
  setFilterBoundaryDraft,
  openFilterBoundarySelection,
  cancelFilterBoundarySelection,
  saveFilterBoundarySelection,
  setCurrentPage,
  exports,
  system,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  /*
   * The Edit panel's own in-progress boundaryFilterType for the selected
   * aggregate. Local rather than runtime (unlike the Add workflow's
   * addAggregateBoundaryFilterType, which MapAdapter.jsx reads to clip the
   * live data preview) - in edit mode the map draws the aggregate's own
   * boundary shape, not data, so nothing outside this page needs it.
   */
  const [aggregateEditSnapshot, setAggregateEditSnapshot] = useState(null);

  /*
   * Which item was selected before the Add workflow took over, so
   * abandoning that workflow puts it back rather than dropping you on
   * an empty info panel.
   *
   * A ref rather than state: nothing renders from it, and it must not
   * trigger a re-render when it's stashed mid-tool-switch. It is only
   * ever read on the way back out of the Add tool.
   */
  const selectionBeforeAddRef = useRef(null);

  /*
   * The session's OWN filter state, parked while an edit session
   * borrows it.
   *
   * There is one filterState for the whole app, so seeding it from a
   * saved aggregate - which is what populates the filter panel when you
   * edit one - overwrites whatever you had been filtering by elsewhere.
   * It used to overwrite it permanently: the aggregate's filters followed
   * you back to the Viewer. This parks yours on the way in and puts it
   * back on the way out, so borrowing is temporary.
   *
   * A ref, not state: nothing renders from it, and stashing it must not
   * cause a re-render mid-effect.
   */
  const sessionFilterStateRef = useRef(null);


  /*
   * Panel visibility - same rule as the Layers page (see its own
   * comment): a panel opens by itself whenever a step asks you to put
   * something into it, and stays closed on the page's resting view.
   *
   * The Add Aggregate workflow is four such steps (boundary -> filters
   * -> fields -> name/color), and only ever shows one panel at a time,
   * so each step's panel opens on arrival and the previous step's is
   * unmounted rather than left sitting beside it.
   *
   * showAggregateInfo is never touched when the Edit tool takes over
   * the right side - the info panel just stops rendering, so its
   * open/closed state is still here when editing ends.
   */
  const [showAggregateList, setShowAggregateList] = useState(false);
  const [showAggregateInfo, setShowAggregateInfo] = useState(false);
  const [showAggregateEdit, setShowAggregateEdit] = useState(true);
  const [showFieldPicker, setShowFieldPicker] = useState(true);
  const [showAddAggregatePanel, setShowAddAggregatePanel] = useState(true);

  const canManage = schema?.userRole === "owner" || schema?.userRole === "admin";
  /* Anyone who can see the project can export it - see src/exports/. */
  const canExport = true;
  const isEditToolActive = canManage && aggregatesActiveTool === "edit";
  const isAddingAggregate = aggregatesActiveTool === "addAggregate";
  const selectedEntity =
    (aggregates || []).find((aggregate) => aggregate._id === selectedAggregateEntityId) || null;

  useEffect(() => {
    setCurrentPage("aggregates");
  }, [setCurrentPage]);

  useEffect(() => {
    return () => {
      /* See the Layers page's matching comment. */
      if (sessionFilterStateRef.current) {
        setFilterState(sessionFilterStateRef.current);
        sessionFilterStateRef.current = null;
      }

      setAggregatesActiveTool(null);
      setAggregateEditMode(null);
      setAddAggregatePhase(null);
      setAddAggregateFields([]);
      setDraftAggregateColors(null);
      setSelectedAggregateEntityId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema?._id]);

  /*
   * Keeps draftAggregateColors in sync with whichever saved aggregate
   * is selected while the Edit tool is active - same pattern as
   * Layers.jsx's own draftLayerColors sync effect.
   */
  useEffect(() => {
    if (aggregatesActiveTool === "addAggregate") return;

    if (!isEditToolActive || !selectedEntity) {
      setDraftAggregateColors(null);

      /* Leaving the edit session - hand the session's filters back. */
      if (sessionFilterStateRef.current) {
        setFilterState(sessionFilterStateRef.current);
        sessionFilterStateRef.current = null;
      }

      return;
    }

    setDraftAggregateColors({
      fillColor: selectedEntity.fillColor,
      borderColor: selectedEntity.borderColor,
    });

    /*
     * The edit session's own fields, seeded from the saved aggregate so
     * the Edit Fields branch opens on what it currently reports rather
     * than on whatever the last Add workflow left behind.
     */
    setAddAggregateFields(
      Array.isArray(selectedEntity.fields) ? structuredClone(selectedEntity.fields) : [],
    );

    /*
     * Only on the way IN - see the Layers page's matching comment.
     */
    if (!sessionFilterStateRef.current) {
      sessionFilterStateRef.current = structuredClone(filterState);
    }

    /*
     * The aggregate's boundary travels inside its own filterState now,
     * so seeding the filters seeds the boundary with them - there is
     * nothing separate left to keep in step.
     */
    setFilterState(
      selectedEntity.filterState && typeof selectedEntity.filterState === "object"
        ? structuredClone(selectedEntity.filterState)
        : {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregatesActiveTool, isEditToolActive, selectedEntity?._id]);

  /*
   * The Edit panel's two sub-branches - the aggregate counterpart to
   * the Layers page's own. Each reopens a step of the Add workflow
   * against the selected aggregate and snapshots what it may change so
   * Cancel can put it back; neither persists until Save.
   */
  function handleEditAggregateFilters() {
    if (!selectedEntity) return;

    setAggregateEditSnapshot({ filterState: structuredClone(filterState) });
    setAggregateEditMode("filters");
    setShowFilter(true);
  }

  /*
   * Unlike Edit Filters, this borrows nothing shared - the field picker
   * is the Aggregates page's own component and addAggregateFields is
   * its own state, so there is no session value to park and restore.
   * The snapshot exists purely so Cancel can undo the edit.
   */
  function handleEditAggregateFields() {
    if (!selectedEntity) return;

    setAggregateEditSnapshot({ fields: structuredClone(addAggregateFields) });
    setAggregateEditMode("fields");
    setShowFieldPicker(true);
  }

  function handleSaveAggregateEditBranch() {
    setAggregateEditSnapshot(null);
    setAggregateEditMode(null);
    setShowAggregateEdit(true);
  }

  function handleCancelAggregateEditBranch() {
    if (aggregateEditSnapshot?.filterState) {
      setFilterState(aggregateEditSnapshot.filterState);
    }

    if (aggregateEditSnapshot?.fields) {
      setAddAggregateFields(aggregateEditSnapshot.fields);
    }


    setAggregateEditSnapshot(null);
    setAggregateEditMode(null);
    setShowAggregateEdit(true);
  }

  function handleToggleVisible(id) {
    setAggregateViewState((prev) => ({
      ...prev,
      [id]: { ...prev[id], visible: !(prev[id]?.visible ?? true) },
    }));
  }

  function handleOpacityChange(id, opacity) {
    setAggregateViewState((prev) => ({
      ...prev,
      [id]: { ...prev[id], opacity },
    }));
  }

    function handleSelectItem(id) {
    setSelectedAggregateEntityId((prev) => (prev === id ? null : id));
  }

  function handleSelectTool(tool) {
    /*
     * Re-clicking the already-selected tool does nothing - matches the
     * Layers page's own guard, so re-picking Edit mid-session can't
     * throw the session away.
     */
    if (tool === aggregatesActiveTool) return;

    const isAddTool = tool === "addAggregate";
    const wasAddTool = isAddingAggregate;

    setAggregatesActiveTool(tool);

    /* Leaving any tool also leaves whatever Edit sub-branch was open. */
    setAggregateEditMode(null);
    setAggregateEditSnapshot(null);

    /*
     * Selection is deliberately NOT cleared when switching between the
     * hand tool and the Edit tool - both are just different views of
     * the same selected aggregate (info panel vs edit form), so
     * clearing it meant re-picking the same row every time you
     * switched, per Brody's own call. Only the Add workflow clears it,
     * because it builds an aggregate that doesn't exist yet.
     */
    if (isAddTool) {
      if (!wasAddTool) {
        selectionBeforeAddRef.current = selectedAggregateEntityId;
      }
      setSelectedAggregateEntityId(null);
    } else if (wasAddTool) {
      setSelectedAggregateEntityId(selectionBeforeAddRef.current);
      selectionBeforeAddRef.current = null;
    }

    if (tool === "edit") {
      setShowAggregateEdit(true);
    }

    if (tool === "addAggregate") {
      setAddAggregatePhase(1);
      setAddAggregateFields([]);
      /*
       * Every step of the workflow starts open - pre-set here rather
       * than on each step's own mount, so arriving at a step always
       * shows its panel already waiting rather than collapsed.
       */
      setShowFilter(true);
      setShowFieldPicker(true);
      setShowAddAggregatePanel(true);
      return;
    }

    setAddAggregatePhase(null);
    setAddAggregateFields([]);
  }

  async function handleCreateAggregate(fields) {
    if (!schema?._id) return;

    setIsSubmitting(true);

    const created = await createAggregate(
      {
        projectId: schema._id,
        filterState,
        fields: addAggregateFields,
        ...fields,
      },
      system,
    );

    setIsSubmitting(false);

    if (created?._id) {
      /*
       * The new aggregate becomes the selection, so finishing the Add
       * workflow drops you straight onto its info panel. That also
       * retires the remembered pre-Add selection - this exits the tool
       * directly rather than through handleSelectTool, so nothing else
       * would clear it.
       */
      selectionBeforeAddRef.current = null;
      setSelectedAggregateEntityId(created._id);

      setAggregatesActiveTool(null);
      setAddAggregatePhase(null);
      setAddAggregateFields([]);
      setDraftAggregateColors(null);
    }
  }

  async function handleUpdateAggregate(fields) {
    if (!schema?._id || !selectedEntity) return;

    setIsSubmitting(true);

    await updateAggregate(
      {
        projectId: schema._id,
        _id: selectedEntity._id,
        opacity: selectedEntity.opacity,
        visible: selectedEntity.visible,
        order: selectedEntity.order,
        /*
         * The whole document goes up - the Edit panel's own "Edit
         * Filters" branch feeds its results through
         * this same save, reading the live edit-session values seeded
         * when the aggregate was selected, exactly as the Layers page
         * does. `fields` (which schema fields to report on) stays
         * create-time only.
         */
        filterState,
        fields: addAggregateFields,
        ...fields,
      },
      system,
    );

    setIsSubmitting(false);
  }

  async function handleDeleteAggregate() {
    if (!schema?._id || !selectedEntity) return;

    const confirmed = await system.confirm({
      message: `Are you sure you want to delete "${selectedEntity.name}"?`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    await deleteAggregate(selectedEntity._id, schema._id, system);

    /*
     * Deleting stays in the Edit tool with nothing selected, so the
     * panel reads "select an aggregate" rather than dumping the user
     * back to the resting view - but any open sub-branch has nothing
     * left to write back to.
     */
    setAggregateEditMode(null);
    setAggregateEditSnapshot(null);
  }

  function getVisibleAggregates() {
    return (aggregates || []).filter(
      (aggregate) => (aggregateViewState[aggregate._id]?.visible ?? true) !== false,
    );
  }

  /*
   * Exports every currently-visible aggregate at once, not just
   * whichever one happens to be selected - mirrors handleExport in
   * Layers.jsx (every active layer) and handleExportVisibleBoundaries
   * below (every visible boundary), per Brody's own call: an aggregate
   * export should reflect what's actually shown on the map right now,
   * the same as every other export in this app. Each aggregate's own
   * result (and, for full exports, its own matching data item ids) is
   * computed here client-side - the same live filter-matching/
   * aggregation engine every other aggregate view in this app already
   * uses - since the server never interprets filterState/fields.
   */
  /*
   * Local now - see runtime.exports. Results and membership are still
   * computed here, because this is where the filtering engine lives;
   * only the assembling moved. They are computed for the aggregates
   * being exported and no others.
   */
  function handleExportAggregate(mode) {
    const visibleAggregates = getVisibleAggregates();

    const resultsById = new Map(
      visibleAggregates.map((aggregate) => [
        String(aggregate._id),
        computeAggregateResult(aggregate, data, schema, filterTimeZone, boundariesById),
      ]),
    );

    const dataItemIdsByAggregateId =
      mode === "full"
        ? new Map(
            visibleAggregates.map((aggregate) => [
              String(aggregate._id),
              getAggregateMatchingData(
                aggregate,
                data,
                schema,
                filterTimeZone,
                boundariesById,
              ).map((item) => item._id),
            ]),
          )
        : null;

    exports.aggregates({
      schema,
      aggregates: visibleAggregates,
      boundaries,
      data,
      resultsById,
      dataItemIdsByAggregateId,
      mode,
      system,
    });
  }

  const boundariesById = useMemo(() => buildBoundariesById(boundaries), [boundaries]);

  /*
   * The boundary is part of filterState now, so the live filtered data
   * already has it applied - this no longer has to re-clip on top.
   */
  const addAggregateMatchingCount = filteredData.length;

  /*
   * Which step is on screen - same shape as the Layers page's own. The
   * Add workflow's steps and the Edit panel's two sub-branches share
   * the same panels, so each flag covers both routes into that step
   * rather than duplicating the markup.
   */
  /*
   * Opens straight onto the filters - see the Layers page's matching
   * comment for why the boundary step is gone.
   */
  const isPickingAggregateFields =
    (isAddingAggregate && addAggregatePhase === 2) || aggregateEditMode === "fields";

  const isFilteringAggregate =
    (isAddingAggregate && addAggregatePhase >= 1) || aggregateEditMode === "filters";

  /*
   * The resting view - list plus info/edit - is everything else, so an
   * Edit sub-branch takes the screen over the same way an Add step
   * does instead of leaving the list panel sitting under it.
   */
  const isAggregateWorkflowActive = isFilteringAggregate || isPickingAggregateFields;

  return (
    <>
      {/* ───────────── Add Aggregate workflow ───────────── */}
      {isFilteringAggregate ? (
        <>
          {/* Step 2 - filtering what's inside the chosen boundary. */}
          {(addAggregatePhase === 1 || aggregateEditMode === "filters") && (
            <>
              {/*
                * Hidden, not unmounted, while the boundary loop is open -
                * see the Layers page's matching comment.
                */}
              {!isSelectingFilterBoundary && (
                <FilterToggle showFilter={showFilter} setShowFilter={setShowFilter} />
              )}

              <PanelContainer side="left" isOpen={showFilter && !isSelectingFilterBoundary}>
                <FilterPanel
                  schema={schema}
                  filterState={filterState}
                  setFilterState={setFilterState}
                  viewerTimeZone={viewerTimeZone}
                  timeFilterOverride={timeFilterOverride}
                  setTimeFilterOverride={setTimeFilterOverride}
                  filterTimezoneMode={filterTimezoneMode}
                  setFilterTimezoneMode={setFilterTimezoneMode}
                  filterTimeZone={filterTimeZone}
                  setFilterTimeZone={setFilterTimeZone}
                  TIMEZONE_OPTIONS={TIMEZONE_OPTIONS}
                  clearFilters={clearFilters}
                  filteredData={filteredData}
                  boundaries={boundaries}
                  onSelectBoundary={openFilterBoundarySelection}
                  system={system}
                  exports={exports}
                  hideExportButton
                />
              </PanelContainer>

          <FilterBoundarySelection
            isSelectingFilterBoundary={isSelectingFilterBoundary}
            showFilterBoundaryPicker={showFilterBoundaryPicker}
            setShowFilterBoundaryPicker={setShowFilterBoundaryPicker}
            filterBoundaryDraft={filterBoundaryDraft}
            setFilterBoundaryDraft={setFilterBoundaryDraft}
            onCancel={cancelFilterBoundarySelection}
            onSave={saveFilterBoundarySelection}
            boundaries={boundaries}
          />
            </>
          )}

          {/*
            * Step 3 - picking which fields to aggregate. Unmounted at
            * step 4 rather than left open on the left: its selections
            * have already been captured into the aggregate being
            * created, so the Add panel is the only thing still asking
            * for input.
            */}
          {isPickingAggregateFields && (
            <>
              <PanelToggle
                side="left"
                isOpen={showFieldPicker}
                setIsOpen={setShowFieldPicker}
                label="Toggle Select Fields Panel"
              />

              <PanelContainer side="left" isOpen={showFieldPicker}>
                <AggregateFieldPicker
                  schema={schema}
                  selectedFields={addAggregateFields}
                  onChange={setAddAggregateFields}
                />
              </PanelContainer>
            </>
          )}

          {/* See the Layers page's matching comment. */}
          {(addAggregatePhase === 1 || aggregateEditMode === "filters") &&
            !isSelectingFilterBoundary && (
            <div className="aggregates-phase-buttons-row">
              <button
                type="button"
                className="aggregates-phase-row-button secondary"
                onClick={
                  aggregateEditMode === "filters"
                    ? handleCancelAggregateEditBranch
                    : () => handleSelectTool(null)
                }
              >
                {aggregateEditMode === "filters" ? "Cancel" : "Back"}
              </button>

              <button
                type="button"
                className="aggregates-phase-row-button primary"
                onClick={
                  aggregateEditMode === "filters"
                    ? handleSaveAggregateEditBranch
                    : () => setAddAggregatePhase(2)
                }
              >
                {aggregateEditMode === "filters" ? "Save Filters" : "Select Data to Aggregate"}
              </button>
            </div>
          )}

          {isPickingAggregateFields && (
            <div className="aggregates-phase-buttons-row">
              <button
                type="button"
                className="aggregates-phase-row-button secondary"
                onClick={
                  aggregateEditMode === "fields"
                    ? handleCancelAggregateEditBranch
                    : () => setAddAggregatePhase(1)
                }
              >
                {aggregateEditMode === "fields" ? "Cancel" : "Back"}
              </button>

              <button
                type="button"
                className="aggregates-phase-row-button primary"
                onClick={
                  aggregateEditMode === "fields"
                    ? handleSaveAggregateEditBranch
                    : () => {
                        setAddAggregatePhase(3);
                        setDraftAggregateColors({ ...DEFAULT_AGGREGATE_COLORS });
                      }
                }
              >
                {aggregateEditMode === "fields" ? "Save Fields" : "Add Aggregate"}
              </button>
            </div>
          )}

          {isAddingAggregate && addAggregatePhase === 3 && (
            <>
              <PanelToggle
                side="right"
                isOpen={showAddAggregatePanel}
                setIsOpen={setShowAddAggregatePanel}
                label="Toggle Add Aggregate Panel"
              />

              <PanelContainer side="right" isOpen={showAddAggregatePanel}>
                <AggregateEditPanel
                  entityType="aggregate"
                  mode="add"
                  matchingCount={addAggregateMatchingCount}
                  colors={draftAggregateColors || DEFAULT_AGGREGATE_COLORS}
                  onColorsChange={setDraftAggregateColors}
                  onSubmit={handleCreateAggregate}
                  onClose={() => setAddAggregatePhase(2)}
                  isSubmitting={isSubmitting}
                />
              </PanelContainer>

              {/*
                * The last step needs a way back too - without one the
                * only way out of naming was submitting or leaving the
                * tool entirely.
                */}
              <div className="aggregates-phase-buttons-row">
                <button
                  type="button"
                  className="aggregates-phase-row-button secondary"
                  onClick={() => setAddAggregatePhase(2)}
                >
                  Back
                </button>
              </div>
            </>
          )}
        </>
      ) : null}

      {/* ───────────── Default view ───────────── */}
      {!isAggregateWorkflowActive && (
        <>
          <PanelToggle
            side="left"
            isOpen={showAggregateList}
            setIsOpen={setShowAggregateList}
            label="Toggle Aggregate List Panel"
          />

          <PanelContainer side="left" isOpen={showAggregateList}>
            <AggregateListPanel
              aggregates={(aggregates || []).map((aggregate) => ({
                ...aggregate,
                ...(aggregateViewState[aggregate._id] || {}),
              }))}
              onToggleVisible={handleToggleVisible}
              onOpacityChange={handleOpacityChange}
              selectedId={selectedAggregateEntityId}
              onSelectItem={handleSelectItem}
              canExport={canExport}
              onExportVisibleAggregatesPartial={() => handleExportAggregate("partial")}
              onExportVisibleAggregatesFull={() => handleExportAggregate("full")}
              hasVisibleAggregates={getVisibleAggregates().length > 0}
            />
          </PanelContainer>

          {isEditToolActive ? (
            <>
              <PanelToggle
                side="right"
                isOpen={showAggregateEdit}
                setIsOpen={setShowAggregateEdit}
                label="Toggle Edit Panel"
              />

              <PanelContainer side="right" isOpen={showAggregateEdit}>
                <AggregateEditPanel
                  mode="edit"
                  entity={selectedEntity}
                  colors={draftAggregateColors || DEFAULT_AGGREGATE_COLORS}
                  onColorsChange={setDraftAggregateColors}
                  onSubmit={handleUpdateAggregate}
                  onDelete={handleDeleteAggregate}
                  onEditFilters={handleEditAggregateFilters}
                  onEditFields={handleEditAggregateFields}
                  isSubmitting={isSubmitting}
                />
              </PanelContainer>
            </>
          ) : (
            <>
              <PanelToggle
                side="right"
                isOpen={showAggregateInfo}
                setIsOpen={setShowAggregateInfo}
                label="Toggle Aggregate Info Panel"
              />

              <PanelContainer side="right" isOpen={showAggregateInfo}>
                <AggregateInfoPanel
                  entity={selectedEntity}
                  boundaries={boundaries}
                  schema={schema}
                  data={data}
                  filterTimeZone={filterTimeZone}
                />
              </PanelContainer>
            </>
          )}
        </>
      )}

      {canManage && (
        <AggregatesToolMenu activeTool={aggregatesActiveTool} onSelectTool={handleSelectTool} />
      )}
    </>
  );
}

export default Aggregates;
