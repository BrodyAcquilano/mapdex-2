// src/workflows/Layers.jsx

import { useEffect, useMemo, useRef, useState } from "react";

import FilterToggle from "../filters/FilterToggle.jsx";
import FilterPanel from "../filters/FilterPanel.jsx";
import PanelToggle, { PanelContainer } from "../panels/PanelToggle/PanelToggle.jsx";
import FilterBoundarySelection from "../boundaries/FilterBoundarySelection/FilterBoundarySelection.jsx";

import LayerListPanel from "../layers/LayerListPanel/LayerListPanel.jsx";
import LayerEditPanel from "../layers/LayerEditPanel/LayerEditPanel.jsx";
import LayerInfoPanel from "../layers/LayerInfoPanel/LayerInfoPanel.jsx";
import LayersToolMenu from "../layers/LayersToolMenu/LayersToolMenu.jsx";
import { buildBoundariesById } from "../../shared/boundaries/filterBoundaryGeometry.js";
import { mergeLayersWithViewState } from "../layers/utils/layerViewState.js";
import {
  getLayerMatchingData,
  schemaSupportsCorridorLayers,
} from "../layers/utils/computeLayerMembers.js";
import {
  LAYER_EDITABLE_COLOR_FIELDS,
  DEFAULT_LAYER_COLORS,
} from "../layers/utils/layerConstants.js";

import "./Layers.css";

/*
 * The two editable color fields off a saved layer, to seed
 * draftLayerColors when it's selected for editing. classification is
 * deliberately excluded - it's set once by which Add tool built the
 * layer and never part of any editable/submitted state afterward.
 */
function pickLayerFields(layer) {
  const fields = {};

  for (const field of LAYER_EDITABLE_COLOR_FIELDS) {
    fields[field] = layer?.[field];
  }

  return fields;
}

/*
 * The Layers tool's own page - the one file this feature puts in
 * workflows/. Every other Layers component (the list/edit panels, the
 * tool menu) lives under src/layers/, imported here; this file only
 * orchestrates which of them is on screen and holds the page-local
 * state (which layer is selected, which tool is active, each layer's
 * own local visibility/opacity) that doesn't belong in the shared
 * runtime.
 *
 * Two views share this one page rather than being separate routes:
 * the default list/stack view (LayerListPanel + the non-interactive
 * stacked map from MapAdapter.jsx), and the Add-tool view, which
 * reuses FilterPanel/FilterToggle verbatim - the same components
 * Viewer/Editor's own AppAdapter renders - rather than rebuilding a
 * second filtering UI, so it looks and behaves exactly like Viewer
 * while a layer is being built up from the current filter.
 */
function Layers({
  schema,
  data,
  filteredData,
  layers,
  createLayer,
  updateLayer,
  deleteLayer,
  isAddLayerToolActive,
  setIsAddLayerToolActive,
  addLayerClassification,
  setAddLayerClassification,
  /*
   * Superseded by addLayerPhase for deciding what's on screen; the
   * setter is still called so the runtime flag stays consistent for
   * anything else reading it.
   */
  setIsAddLayerPanelOpen,
  addLayerPhase,
  setAddLayerPhase,
  layerEditMode,
  setLayerEditMode,
  isLayerEditToolActive,
  setIsLayerEditToolActive,
  boundaries,
  selectedLayerId,
  setSelectedLayerId,
  layerViewState,
  setLayerViewState,
  showDataLayer,
  setShowDataLayer,
  dataLayerOpacity,
  setDataLayerOpacity,
  draftLayerColors,
  setDraftLayerColors,
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
  const [isSubmittingLayer, setIsSubmittingLayer] = useState(false);

  /*
   * Panel visibility. Every panel on this page is toggleable so a phone
   * can always get back to the map, and the defaults follow one rule
   * (Brody's own): a panel opens by itself whenever a tool *asks* you to
   * put something into it, and stays closed on the page's own resting
   * view where nothing is being asked of you.
   *
   * So: the list/info panels start closed on page load, while each step
   * of an Add workflow - and the Edit panel - opens on arrival.
   *
   * showLayerInfo is deliberately never touched when the Edit tool takes
   * over the right side: the info panel simply stops rendering while
   * editing, so whatever open/closed state it had is still sitting here
   * when editing ends. That's the "restore its previous state" behavior,
   * with no saved-previous-value bookkeeping to get out of sync.
   */
  const [showLayerList, setShowLayerList] = useState(false);
  const [showLayerInfo, setShowLayerInfo] = useState(false);
  const [showLayerEdit, setShowLayerEdit] = useState(true);
  const [showAddLayerPanel, setShowAddLayerPanel] = useState(true);

  /*
   * Selecting a layer for editing loads its own filters into the live
   * runtime filterState and leaves them there for the whole session -
   * so the map's draft layer, the filter panel, and the payload that
   * eventually gets saved are all reading one value that can't drift
   * apart. An earlier version kept a separate draft copy and the map
   * went on rendering the *saved* filters after the filter branch was
   * left, which is exactly the bug this avoids.
   *
   * The one thing that needs remembering is what the filters looked
   * like when the Edit Filters branch was entered, so Cancel can put
   * them back.
   */
  const [filterSnapshot, setFilterSnapshot] = useState(null);

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
   * saved layer - which is what populates the filter panel when you
   * edit one - overwrites whatever you had been filtering by elsewhere.
   * It used to overwrite it permanently: the layer's filters followed
   * you back to the Viewer. This parks yours on the way in and puts it
   * back on the way out, so borrowing is temporary.
   *
   * A ref, not state: nothing renders from it, and stashing it must not
   * cause a re-render mid-effect.
   */
  const sessionFilterStateRef = useRef(null);


  const canManage = schema?.userRole === "owner" || schema?.userRole === "admin";
  /* Anyone who can see the project can export it - see src/exports/. */
  const canExport = true;
  const canAddCorridor = schemaSupportsCorridorLayers(schema);

  const selectedLayer = (layers || []).find((layer) => layer._id === selectedLayerId) || null;

  useEffect(() => {
    setCurrentPage("layers");
  }, [setCurrentPage]);

  useEffect(() => {
    return () => {
      /*
       * Leaving the page mid-edit counts as leaving the edit session -
       * without this the layer's filters would follow you off the page.
       */
      if (sessionFilterStateRef.current) {
        setFilterState(sessionFilterStateRef.current);
        sessionFilterStateRef.current = null;
      }

      setIsAddLayerToolActive(false);
      setAddLayerClassification(null);
      setAddLayerPhase(null);
      setLayerEditMode(null);
      setIsLayerEditToolActive(false);
      setSelectedLayerId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema?._id]);

  /*
   * Merges freshly-loaded/updated layers into layerViewState without
   * clobbering a viewer's own in-session visibility/opacity choices -
   * these are local-only display preferences (see LayerListPanel's own
   * comment), never persisted, so a layer's saved `visible`/`opacity`
   * only ever seed a *new* row here, never overwrite an existing one.
   */
  useEffect(() => {
    setLayerViewState((prev) => {
      const next = {};

      for (const layer of layers || []) {
        next[layer._id] = prev[layer._id] || {
          visible: layer.visible !== false,
          opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1,
        };
      }

      return next;
    });
  }, [layers, setLayerViewState]);

  const layersForListPanel = useMemo(
    () => mergeLayersWithViewState(layers, layerViewState),
    [layers, layerViewState],
  );

  /*
   * A layer's boundary lives inside its own filterState.geometry now,
   * so nothing here resolves one directly - the filters do, and they
   * only need to be able to look an id up.
   */
  const boundariesById = useMemo(() => buildBoundariesById(boundaries), [boundaries]);

  /*
   * The Add panel's own "N items currently match your filters" count -
   * re-derived through getLayerMatchingData (the same function that
   * ultimately builds the layer) rather than just filteredData.length,
   * so a Corridor add's own Point/MultiPoint exclusion and the boundary
   * clip are both reflected here too, not just in the eventual saved
   * layer.
   */
  const addLayerMatchingCount = useMemo(() => {
    if (!isAddLayerToolActive) return 0;

    return getLayerMatchingData(
      {
        classification: addLayerClassification,
        filterState,
      },
      data,
      schema,
      filterTimeZone,
      boundariesById,
    ).length;
  }, [
    isAddLayerToolActive,
    addLayerClassification,
    boundariesById,
    filterState,
    data,
    schema,
    filterTimeZone,
  ]);

  /*
   * Loads a layer into the edit session. This is the *only* thing that
   * resets in-progress edits, and it keys on which layer is selected
   * rather than on any render - so re-clicking the Edit tool, toggling
   * a panel, or coming back from the Edit Filters
   * branches all leave the work in place. Progress is only lost by
   * explicitly choosing to lose it: picking a different layer, leaving
   * the tool, saving, or deleting.
   *
   * Everything the map needs to draw the in-progress layer is seeded
   * here (colors, boundary, clip mode) plus the layer's own filters
   * into the live filterState - see filterSnapshot's own comment.
   */
  useEffect(() => {
    if (isAddLayerToolActive) return;

    if (!isLayerEditToolActive || !selectedLayer) {
      setDraftLayerColors(null);

      /* Leaving the edit session - hand the session's filters back. */
      if (sessionFilterStateRef.current) {
        setFilterState(sessionFilterStateRef.current);
        sessionFilterStateRef.current = null;
      }

      return;
    }

    /*
     * Only on the way IN. Switching from one layer to another mid-session
     * must keep the ORIGINAL session filters parked, not overwrite them
     * with the first layer's.
     */
    if (!sessionFilterStateRef.current) {
      sessionFilterStateRef.current = structuredClone(filterState);
    }

    setDraftLayerColors(pickLayerFields(selectedLayer));
    setAddLayerClassification(selectedLayer.classification ?? null);

    setFilterState(
      selectedLayer.filterState && typeof selectedLayer.filterState === "object"
        ? structuredClone(selectedLayer.filterState)
        : {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddLayerToolActive, isLayerEditToolActive, selectedLayer?._id]);

  function handleToggleVisible(layerId) {
    setLayerViewState((prev) => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        visible: !prev[layerId]?.visible,
      },
    }));
  }

  function handleOpacityChange(layerId, opacity) {
    setLayerViewState((prev) => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        opacity,
      },
    }));
  }

  function handleSelectTool(tool) {
    /*
     * Re-clicking the already-selected tool does nothing. Without this,
     * clicking Edit while already editing restarted the session and
     * threw away in-progress changes - the same would go for re-picking
     * an Add tool mid-workflow. Leaving a tool is always deliberate:
     * pick a different tool, or the hand tool to abandon.
     */
    if (tool === activeTool) return;

    const isAddTool = tool === "add-patch" || tool === "add-corridor";
    const wasAddTool = isAddLayerToolActive;

    /*
     * Selection is deliberately NOT cleared when switching between the
     * hand tool and the Edit tool - both are just different views of
     * the same selected layer (info panel vs edit form), so clearing it
     * meant re-picking the same row every time you switched, per
     * Brody's own call. Only the Add workflow clears it, because it
     * builds a layer that doesn't exist yet and the map/panels have to
     * show that draft instead.
     */
    if (isAddTool && !wasAddTool) {
      selectionBeforeAddRef.current = selectedLayerId;
    }

    if (!isAddTool && wasAddTool) {
      setSelectedLayerId(selectionBeforeAddRef.current);
      selectionBeforeAddRef.current = null;
    }

    setIsAddLayerToolActive(isAddTool);
    setAddLayerClassification(tool === "add-patch" ? "Patch" : tool === "add-corridor" ? "Corridor" : null);
    setIsLayerEditToolActive(tool === "edit");
    setIsAddLayerPanelOpen(false);

    /* Leaving any tool also leaves whatever Edit sub-branch was open. */
    setLayerEditMode(null);

    if (isAddTool) {
      setSelectedLayerId(null);
      /*
       * The workflow starts on its boundary step. Every step's panel is
       * pre-opened here rather than on its own mount, so arriving at a
       * step always shows it waiting rather than collapsed.
       */
      setAddLayerPhase(1);
      setShowFilter(true);
      setShowAddLayerPanel(true);
    } else {
      setAddLayerPhase(null);
    }

    if (tool === "edit") {
      setShowLayerEdit(true);
    }
  }

  /*
   * The Edit panel's own two sub-branches. Both reopen a step of the
   * Add workflow against the *selected* layer rather than a new one, by
   * seeding the same runtime state that workflow uses - which is what
   * makes the map preview and the panels behave identically in both.
   *
   * Leaving a branch via "Save …" only writes back into the in-progress
   * layer form; nothing is persisted until Save Layer is pressed in the
   * Edit panel, so backing out of a branch can't half-commit a change.
   */
  /*
   * The Edit panel's two sub-branches. The edit session's state is
   * already seeded (see the effect above), so these only open the
   * branch and snapshot what it's allowed to change, so Cancel can put
   * it back. Saving a branch just closes it - the values it edited are
   * already live, which is what keeps the map in step.
   */
  function handleEditLayerFilters() {
    if (!selectedLayer) return;

    setFilterSnapshot({ filterState: structuredClone(filterState) });
    setLayerEditMode("filters");
    setShowFilter(true);
  }

  function handleSaveLayerEditBranch() {
    setFilterSnapshot(null);
    setLayerEditMode(null);
    setShowLayerEdit(true);
  }

  function handleCancelLayerEditBranch() {
    if (filterSnapshot?.filterState) {
      setFilterState(filterSnapshot.filterState);
    }


    setFilterSnapshot(null);
    setLayerEditMode(null);
    setShowLayerEdit(true);
  }

  async function handleCreateLayer(fields) {
    if (!schema?._id) return;

    setIsSubmittingLayer(true);

    const created = await createLayer(
      {
        projectId: schema._id,
        filterState,
        classification: addLayerClassification,
        ...fields,
      },
      system,
    );

    setIsSubmittingLayer(false);

    if (created?._id) {
      /*
       * The new layer becomes the selection, so finishing the Add
       * workflow drops you straight onto its info panel. That also
       * retires the remembered pre-Add selection - this exits the tool
       * directly rather than through handleSelectTool, so nothing else
       * would clear it.
       */
      selectionBeforeAddRef.current = null;
      setSelectedLayerId(created._id);

      setIsAddLayerPanelOpen(false);
      setIsAddLayerToolActive(false);
      setAddLayerPhase(null);
      setAddLayerClassification(null);
      setDraftLayerColors(null);
    }
  }

  async function handleUpdateLayer(fields) {
    if (!schema?._id || !selectedLayer) return;

    setIsSubmittingLayer(true);

    await updateLayer(
      {
        projectId: schema._id,
        _id: selectedLayer._id,
        opacity: selectedLayer.opacity,
        visible: selectedLayer.visible,
        order: selectedLayer.order,
        /*
         * The whole document goes up, not just display metadata - the
         * Edit panel's own "Edit Filters" branch feeds
         * their results through this same save. These read the live
         * edit-session values (seeded from the layer when it was
         * selected), which are the same ones the map has been drawing,
         * so what's saved is exactly what was on screen.
         */
        filterState,
        ...fields,
      },
      system,
    );

    setIsSubmittingLayer(false);
  }

    async function handleDeleteLayer() {
    if (!schema?._id || !selectedLayer) return;

    const confirmed = await system.confirm({
      message: `Are you sure you want to delete "${selectedLayer.name}"?`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    await deleteLayer(selectedLayer._id, schema._id, system);

    /*
     * Deleting clears the edit session but stays in the Edit tool with
     * nothing selected, so the panel reads "select a layer" rather than
     * dumping the user back to the resting view. deleteLayer already
     * clears selectedLayerId for us.
     */
    setLayerEditMode(null);
    setFilterSnapshot(null);
    setDraftLayerColors(null);
  }

  /*
   * Exports every currently-visible layer at once, in one of two
   * shapes - mirrors handleExportAggregate in Aggregates.jsx. "partial"
   * is the layer definitions plus the boundaries they clip to;
   * "full" adds the project schema and a snapshot of every matching
   * data item.
   *
   * A layer's membership is a live re-filter of the current dataset
   * (see computeLayerMembers.js's own comment), so a full export
   * re-derives each visible layer's own currently-matching ids right
   * here, client-side, rather than asking the server to interpret a
   * stored filterState it was never meant to understand - the server
   * only ever sees the resulting ids, and independently re-fetches
   * each layer's own doc by _id for authoritative name/color/
   * classification metadata (server/routes/layers.js). A partial
   * export carries no data items at all, so it skips that work
   * entirely and sends nothing but ids.
   */
  /*
   * Local now - see runtime.exports. A layer's membership is a live
   * re-filter rather than a stored id list, so the full snapshot still
   * re-derives each visible layer's current matching ids here; only the
   * assembling moved.
   */
  function handleExport(mode) {
    const visibleLayers = (layers || []).filter(
      (layer) => layerViewState[layer._id]?.visible !== false,
    );

    const dataItemIdsByLayerId =
      mode === "full"
        ? new Map(
            visibleLayers.map((layer) => [
              String(layer._id),
              getLayerMatchingData(layer, data, schema, filterTimeZone, boundariesById).map(
                (dataItem) => dataItem._id,
              ),
            ]),
          )
        : null;

    exports.layers({
      schema,
      layers: visibleLayers,
      boundaries,
      data,
      dataItemIdsByLayerId,
      mode,
      system,
    });
  }

  const activeTool = isAddLayerToolActive
    ? addLayerClassification === "Corridor"
      ? "add-corridor"
      : "add-patch"
    : isLayerEditToolActive
      ? "edit"
      : null;

  /*
   * Which step is on screen. The Add workflow's own steps and the Edit
   * panel's two sub-branches share the same panels, so each flag covers
   * both routes into that step rather than duplicating the markup.
   */
  /*
   * The Add workflow opens straight onto the filters now. It used to
   * start with its own boundary step, but the boundary is part of the
   * filter state like any other filter, so the filter panel's own
   * Select Boundary loop covers it - and whatever boundary was already
   * filtered on carries in as the starting point (Brody's own call).
   */
  const isFilteringLayer =
    (isAddLayerToolActive && addLayerPhase === 1) || layerEditMode === "filters";

  const isNamingLayer = isAddLayerToolActive && addLayerPhase === 2;

  /* The resting view - list plus info/edit - is everything else. */
  const isLayerWorkflowActive = isFilteringLayer || isNamingLayer;

  return (
    <>
      {isFilteringLayer ? (
        <>
          {/*
            * Hidden, not unmounted, while the boundary loop is open - the
            * filter state behind it must not change while you are away.
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

          {/*
            * The boundary loop shows its own Back/Select Boundary row in
            * this same spot, so the step buttons stand down while it is
            * open rather than overlapping it.
            */}
          {!isSelectingFilterBoundary && (
          <div className="layers-phase-buttons-row">
            <button
              type="button"
              className="layers-phase-row-button secondary"
              onClick={
                layerEditMode === "filters"
                  ? handleCancelLayerEditBranch
                  : () => handleSelectTool(null)
              }
            >
              {layerEditMode === "filters" ? "Cancel" : "Back"}
            </button>

            <button
              type="button"
              className="layers-phase-row-button primary"
              onClick={() => {
                if (layerEditMode === "filters") {
                  handleSaveLayerEditBranch();
                  return;
                }

                setAddLayerPhase(2);
                setIsAddLayerPanelOpen(true);
                setShowAddLayerPanel(true);
                setDraftLayerColors(DEFAULT_LAYER_COLORS);
              }}
            >
              {layerEditMode === "filters"
                ? "Save Filters"
                : `Add ${addLayerClassification} Layer`}
            </button>
          </div>
          )}
        </>
      ) : null}

      {/*
        * Step 2 of an Add workflow - naming/coloring the layer. The
        * filter panel is gone by this point rather than sitting open
        * beside this one: the filters have already been captured into
        * the layer being created, so there's one panel and one set of
        * choices on screen at a time (Brody's own call - it keeps the
        * workflow linear, and keeps a phone from having two panels
        * stacked over the map). filterState itself is untouched, so the
        * map keeps previewing exactly what it did a moment ago.
        */}
      {isNamingLayer && (
        <>
          <PanelToggle
            side="right"
            isOpen={showAddLayerPanel}
            setIsOpen={setShowAddLayerPanel}
            label="Toggle Add Layer Panel"
          />

          <PanelContainer side="right" isOpen={showAddLayerPanel}>
            <LayerEditPanel
              mode="add"
              classification={addLayerClassification}
              dataItemCount={addLayerMatchingCount}
              colors={draftLayerColors || DEFAULT_LAYER_COLORS}
              onColorsChange={setDraftLayerColors}
              onSubmit={handleCreateLayer}
              onClose={() => {
                setIsAddLayerPanelOpen(false);
                setDraftLayerColors(null);
              }}
              isSubmitting={isSubmittingLayer}
            />
          </PanelContainer>

          {/*
            * The last step needs a way back too - without one the only
            * way out of naming was submitting or leaving the tool
            * entirely.
            */}
          <div className="layers-phase-buttons-row">
            <button
              type="button"
              className="layers-phase-row-button secondary"
              onClick={() => setAddLayerPhase(1)}
            >
              Back
            </button>
          </div>
        </>
      )}

      {!isLayerWorkflowActive && (
        <>
          <PanelToggle
            side="left"
            isOpen={showLayerList}
            setIsOpen={setShowLayerList}
            label="Toggle Layer List Panel"
          />

          <PanelContainer side="left" isOpen={showLayerList}>
            <LayerListPanel
              layers={layersForListPanel}
              onToggleVisible={handleToggleVisible}
              onOpacityChange={handleOpacityChange}
              showDataLayer={showDataLayer}
              dataLayerOpacity={dataLayerOpacity}
              onToggleDataLayer={() => setShowDataLayer((prev) => !prev)}
              onDataLayerOpacityChange={setDataLayerOpacity}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              canExport={canExport}
              onExportPartial={() => handleExport("partial")}
              onExportFull={() => handleExport("full")}
            />
          </PanelContainer>

          {isLayerEditToolActive && canManage ? (
            <>
              <PanelToggle
                side="right"
                isOpen={showLayerEdit}
                setIsOpen={setShowLayerEdit}
                label="Toggle Edit Layer Panel"
              />

              <PanelContainer side="right" isOpen={showLayerEdit}>
                <LayerEditPanel
                  mode="edit"
                  layer={selectedLayer}
                  classification={selectedLayer?.classification}
                  colors={draftLayerColors || DEFAULT_LAYER_COLORS}
                  onColorsChange={setDraftLayerColors}
                  onSubmit={handleUpdateLayer}
                  onDelete={handleDeleteLayer}
                  onEditFilters={handleEditLayerFilters}
                  isSubmitting={isSubmittingLayer}
                />
              </PanelContainer>
            </>
          ) : (
            <>
              <PanelToggle
                side="right"
                isOpen={showLayerInfo}
                setIsOpen={setShowLayerInfo}
                label="Toggle Layer Info Panel"
              />

              <PanelContainer side="right" isOpen={showLayerInfo}>
                <LayerInfoPanel layer={selectedLayer} />
              </PanelContainer>
            </>
          )}
        </>
      )}

      {canManage && (
        <LayersToolMenu
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          canAddCorridor={canAddCorridor}
        />
      )}
    </>
  );
}

export default Layers;
