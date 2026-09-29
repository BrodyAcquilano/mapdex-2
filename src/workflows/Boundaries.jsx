// src/workflows/Boundaries.jsx

import { useEffect, useState } from "react";

import PanelToggle, { PanelContainer } from "../panels/PanelToggle/PanelToggle.jsx";
import BoundaryListPanel from "../boundaries/BoundaryListPanel/BoundaryListPanel.jsx";
import BoundariesToolMenu from "../boundaries/BoundariesToolMenu/BoundariesToolMenu.jsx";
import BoundaryEditPanel from "../boundaries/BoundaryEditPanel/BoundaryEditPanel.jsx";
import BoundaryGeometryActions from "../boundaries/BoundaryGeometryActions/BoundaryGeometryActions.jsx";
import { useBoundaryWorkflow } from "../boundaries/hooks/useBoundaryWorkflow.js";

/*
 * Imported explicitly rather than relied on via BoundaryGeometryActions
 * above: the Import Boundary step below uses the same .boundary-actions-row
 * / .boundary-action-button classes that file defines, so the dependency
 * should be visible here rather than implicit.
 */
import "../boundaries/BoundaryGeometryActions/BoundaryGeometryActions.css";

/*
 * The Boundaries page.
 *
 * Boundaries used to be a *tab* inside both the Layers page and the
 * Aggregates page, which meant two parallel copies of the same draw/
 * import/move workflow, two sets of tool state, two sets of panel
 * state, and two page-prefixed sets of CSS classes. The copies drifted
 * far enough apart that drawing worked on the Aggregates page and was
 * completely dead on the Layers page (a malformed empty draft, no
 * crosshair cursor, no action buttons), and on the events engine the
 * Layers tab had no boundary map layer at all.
 *
 * Brody's call was to give boundaries their own route rather than keep
 * merging two tabs: a boundary belongs to neither feature, so it gets
 * its own page, its own toolbar and its own list panel, and the
 * tab-switching state on both other pages disappears entirely. Layers
 * and Aggregates still consume boundaries - both let you pick one from
 * the shared BoundaryPickerPanel and store its id - but neither page
 * creates or edits one any more.
 *
 * Everything under src/boundaries/ stays where it is; only this page,
 * which routes and orchestrates, lives in src/workflows/.
 */
function Boundaries({
  schema,
  boundaries,
  boundaryViewState,
  setBoundaryViewState,
  selectedBoundaryId,
  setSelectedBoundaryId,
  boundaryTool,
  setBoundaryTool,
  isBoundaryAddPanelOpen,
  setIsBoundaryAddPanelOpen,
  showBoundaryAddPanel,
  setShowBoundaryAddPanel,
  isDrawingBoundary,
  setIsDrawingBoundary,
  boundaryDraftGeometry,
  setBoundaryDraftGeometry,
  setDraftBoundaryColors,
  createBoundary,
  updateBoundary,
  deleteBoundary,
  finishDrawingBoundary,
  finishBoundaryGeometryEdit,
  setCurrentPage,
  exports,
  system,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  /*
   * Panel visibility - same rule as the Layers and Aggregates pages: a
   * panel opens by itself whenever something asks you to put input into
   * it, and the resting view starts with the list closed.
   */
  const [showBoundaryList, setShowBoundaryList] = useState(false);
  const [showBoundaryEdit, setShowBoundaryEdit] = useState(true);

  const canManage = schema?.userRole === "owner" || schema?.userRole === "admin";
  /* Anyone who can see the project can export it - see src/exports/. */
  const canExport = true;

  const selectedBoundary =
    (boundaries || []).find((boundary) => boundary._id === selectedBoundaryId) || null;

  const {
    fileInputRef,
    selectBoundaryTool,
    exitBoundaryTool,
    handleImportButtonClick,
    handleImportFileChange,
    handleFinishDrawBoundary,
    handleFinishBoundaryGeometryEdit,
    handleBoundaryColorsPreview,
    handleSubmitBoundary,
  } = useBoundaryWorkflow({
    schema,
    system,
    setBoundaryTool,
    setIsDrawingBoundary,
    boundaryDraftGeometry,
    setBoundaryDraftGeometry,
    setDraftBoundaryColors,
    isBoundaryAddPanelOpen,
    setIsBoundaryAddPanelOpen,
    setShowBoundaryAddPanel,
    selectedBoundary,
    clearSelectedBoundary: () => setSelectedBoundaryId(null),
    createBoundary,
    updateBoundary,
    finishDrawingBoundary,
    finishBoundaryGeometryEdit,
    setIsSubmitting,
  });

  useEffect(() => {
    setCurrentPage("boundaries");
  }, [setCurrentPage]);

  /*
   * Leaving the project (or the app) abandons anything in progress -
   * the draft, its colors, the drawing session, the selected tool and
   * the selection. Mirrors the equivalent cleanup on the Layers and
   * Aggregates pages.
   */
  useEffect(() => {
    return () => {
      setBoundaryTool(null);
      setIsDrawingBoundary(false);
      setBoundaryDraftGeometry(null);
      setDraftBoundaryColors(null);
      setIsBoundaryAddPanelOpen(false);
      setSelectedBoundaryId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema?._id]);

  /*
   * Seeds the draft from whichever boundary is selected while Move
   * Vertex/Move Boundary is active. selectBoundaryTool deliberately
   * preserves the selection for those two tools (unlike every other
   * tool, which clears it), so picking a different boundary while one
   * stays active re-seeds the draft for the newly picked one rather
   * than doing nothing. Colors are handled by their own effect below,
   * which covers selection generally rather than just these two tools.
   */
  useEffect(() => {
    if (boundaryTool !== "move" && boundaryTool !== "moveGeometry") return;

    if (!selectedBoundary) {
      setBoundaryDraftGeometry(null);
      return;
    }

    setBoundaryDraftGeometry(structuredClone(selectedBoundary.geometry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryTool, selectedBoundary?._id]);

  /*
   * The live color preview for the Edit panel.
   *
   * Selecting a boundary opens it in the Edit panel, so selection alone
   * is what makes it editable - there is no separate edit tool to enter
   * any more. That means the map has to show the boundary in its DRAFT
   * colors from the moment it is selected: seeded from the saved ones
   * here, then overwritten live by the panel's own color pickers
   * (onColorsPreview), and read back by MapAdapter, which paints the
   * selected boundary with them instead of its stored colors.
   *
   * Only Add used to do this, which is why editing a boundary's color
   * showed nothing until it was saved.
   *
   * The Add workflow owns draftBoundaryColors while its own panel is
   * open, so this stands down then rather than fighting it for the same
   * slot. Deselecting clears the draft and the saved colors come back.
   */
  useEffect(() => {
    if (isBoundaryAddPanelOpen) return;

    if (!selectedBoundary) {
      setDraftBoundaryColors(null);
      return;
    }

    setDraftBoundaryColors({
      fillColor: selectedBoundary.fillColor,
      borderColor: selectedBoundary.borderColor,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBoundary?._id, isBoundaryAddPanelOpen]);

  function handleToggleBoundaryVisible(boundaryId) {
    setBoundaryViewState((prev) => ({
      ...prev,
      [boundaryId]: {
        ...prev[boundaryId],
        visible: !(prev[boundaryId]?.visible ?? true),
      },
    }));
  }

  function handleBoundaryOpacityChange(boundaryId, opacity) {
    setBoundaryViewState((prev) => ({
      ...prev,
      [boundaryId]: { ...prev[boundaryId], opacity },
    }));
  }

  function handleSelectBoundary(boundaryId) {
    setSelectedBoundaryId((prev) => (prev === boundaryId ? null : boundaryId));
  }

  async function handleDeleteBoundary() {
    if (!schema?._id || !selectedBoundary) return;

    const confirmed = await system.confirm({
      message: `Are you sure you want to delete "${selectedBoundary.name}"? Layers and aggregates using it will fall back to the whole dataset.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    await deleteBoundary(selectedBoundary._id, schema._id, system);
  }

  /*
   * Local now - no request, no blob round trip. See runtime.exports.
   */
  function handleExportVisibleBoundaries() {
    exports.boundaries({
      schema,
      boundaries: (boundaries || []).filter(
        (boundary) => (boundaryViewState[boundary._id]?.visible ?? true) !== false,
      ),
      system,
    });
  }

  const isDrawTool = boundaryTool === "multipolygon";
  const isMoveTool = boundaryTool === "move" || boundaryTool === "moveGeometry";
  const isImportTool = boundaryTool === "importBoundary";

  /*
   * The Add Boundary panel and the Edit Boundary panel both live on the
   * right, so only one is ever mounted - the review-before-saving phase
   * takes precedence over whatever happened to be selected.
   */
  const showEditPanel = canManage && !isBoundaryAddPanelOpen && !!selectedBoundary;

  return (
    <>
      <PanelToggle
        side="left"
        isOpen={showBoundaryList}
        setIsOpen={setShowBoundaryList}
        label="Toggle Boundary List Panel"
      />

      <PanelContainer side="left" isOpen={showBoundaryList}>
        <BoundaryListPanel
          boundaries={(boundaries || []).map((boundary) => ({
            ...boundary,
            ...(boundaryViewState[boundary._id] || {}),
          }))}
          selectedBoundaryId={selectedBoundaryId}
          onSelectBoundary={handleSelectBoundary}
          onToggleVisible={handleToggleBoundaryVisible}
          onOpacityChange={handleBoundaryOpacityChange}
          canExport={canExport}
          onExport={handleExportVisibleBoundaries}
        />
      </PanelContainer>

      {/*
        * A boundary has no read-only info view to switch away from - its
        * name is in the list and its color is on the map - so the edit
        * form opens on permission alone rather than behind an Edit tool.
        */}
      {showEditPanel && (
        <>
          <PanelToggle
            side="right"
            isOpen={showBoundaryEdit}
            setIsOpen={setShowBoundaryEdit}
            label="Toggle Edit Boundary Panel"
          />

          <PanelContainer side="right" isOpen={showBoundaryEdit}>
            <BoundaryEditPanel
              mode="edit"
              boundary={selectedBoundary}
              onColorsPreview={handleBoundaryColorsPreview}
              onSubmit={handleSubmitBoundary}
              onDelete={handleDeleteBoundary}
              isSubmitting={isSubmitting}
            />
          </PanelContainer>
        </>
      )}

      {/* ───────────── Draw Boundary ───────────── */}
      {isDrawTool && !isBoundaryAddPanelOpen && (
        <BoundaryGeometryActions
          geometryTool="multipolygon"
          isDrawing={isDrawingBoundary}
          draftGeometry={boundaryDraftGeometry}
          setDraftGeometry={setBoundaryDraftGeometry}
          onFinish={handleFinishDrawBoundary}
          onExitTool={exitBoundaryTool}
          isSubmitting={isSubmitting}
        />
      )}

      {/* ───────────── Move Vertex / Move Boundary ───────────── */}
      {isMoveTool && (
        <BoundaryGeometryActions
          geometryTool={boundaryTool}
          isDrawing
          draftGeometry={boundaryDraftGeometry}
          setDraftGeometry={setBoundaryDraftGeometry}
          onFinish={handleFinishBoundaryGeometryEdit}
          onExitTool={exitBoundaryTool}
          isSubmitting={isSubmitting}
        />
      )}

      {/* ───────────── Import Boundary ───────────── */}
      {isImportTool && !isBoundaryAddPanelOpen && (
        <div className="boundary-actions-row">
          <button
            type="button"
            className="boundary-action-button secondary"
            onClick={exitBoundaryTool}
          >
            Back
          </button>

          <button
            type="button"
            className="boundary-action-button primary"
            onClick={handleImportButtonClick}
          >
            Choose GeoJSON File
          </button>
        </div>
      )}

      {/*
        * The review-before-saving phase, reached identically from Finish
        * (draw) and from a parsed file (import).
        */}
      {isBoundaryAddPanelOpen && (
        <>
          <PanelToggle
            side="right"
            isOpen={showBoundaryAddPanel}
            setIsOpen={setShowBoundaryAddPanel}
            label="Toggle Add Boundary Panel"
          />

          <PanelContainer side="right" isOpen={showBoundaryAddPanel}>
            <BoundaryEditPanel
              mode="add"
              onColorsPreview={handleBoundaryColorsPreview}
              onSubmit={handleSubmitBoundary}
              onClose={exitBoundaryTool}
              isSubmitting={isSubmitting}
            />
          </PanelContainer>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.geojson,application/json,application/geo+json"
        style={{ display: "none" }}
        onChange={handleImportFileChange}
      />

      {canManage && (
        <BoundariesToolMenu
          activeTool={boundaryTool}
          onSelectTool={selectBoundaryTool}
          hasSelectedBoundary={!!selectedBoundary}
        />
      )}
    </>
  );
}

export default Boundaries;
