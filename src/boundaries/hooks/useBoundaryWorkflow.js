// src/boundaries/hooks/useBoundaryWorkflow.js

import { useCallback, useRef } from "react";

import { parseBoundaryImportFile } from "../utils/parseBoundaryImportFile.js";
import { createEmptyBoundaryDraft } from "../utils/boundaryDraft.js";
import { DEFAULT_BOUNDARY_COLORS } from "../utils/boundaryConstants.js";

/*
 * The Boundaries page's entire tool workflow - selecting a tool,
 * drawing or importing a shape, reviewing it in the Add Boundary panel,
 * and saving it.
 *
 * Boundaries used to be a tab on both the Layers page and the
 * Aggregates page, each carrying its own near-identical copy of every
 * handler here, differing only in which state names they happened to
 * use (layersBoundaryTool vs aggregatesActiveTool) and which page-
 * specific CSS class the import button got. They drifted, as duplicated
 * workflows do: the Layers copy seeded a malformed empty draft (see
 * createEmptyBoundaryDraft), never reached isDrawingBoundary in a
 * usable state, and got no crosshair cursor, so drawing was simply
 * broken there while the Aggregates copy worked. Brody's call was to
 * stop maintaining two of these at all, and to give boundaries their
 * own route rather than a tab on each page - one hook, one page
 * (src/workflows/Boundaries.jsx), one set of runtime state, one draft
 * layer on the map.
 *
 * Kept as a hook separate from that page rather than inlined into it,
 * so the behaviour sits beside the components it drives under
 * src/boundaries/ - the page itself only routes and composes.
 */
export function useBoundaryWorkflow({
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
  clearSelectedBoundary,
  createBoundary,
  updateBoundary,
  finishDrawingBoundary,
  finishBoundaryGeometryEdit,
  setIsSubmitting,
}) {
  const fileInputRef = useRef(null);

  /*
   * Clears every trace of an in-progress boundary - the draft, its
   * colors, the drawing session and the Add panel - without touching
   * which tool is selected. Both "pick a different tool" and "leave the
   * tab entirely" need exactly this much, so neither has to remember
   * the full list.
   */
  const clearBoundaryDraft = useCallback(() => {
    setIsDrawingBoundary(false);
    setBoundaryDraftGeometry(null);
    setDraftBoundaryColors(null);
    setIsBoundaryAddPanelOpen(false);
  }, [
    setIsDrawingBoundary,
    setBoundaryDraftGeometry,
    setDraftBoundaryColors,
    setIsBoundaryAddPanelOpen,
  ]);

  /*
   * Back to the Hand tool with nothing in progress. This is what the
   * draw tool's own Back button falls through to once there's no vertex
   * left to undo - the Layers page had that behaviour and the
   * Aggregates page didn't, and Brody's call was to keep it: hitting
   * Back from the very first state should leave the tool entirely
   * rather than stranding you in a draw mode with no way out but the
   * toolbar.
   */
  const exitBoundaryTool = useCallback(() => {
    clearBoundaryDraft();
    setBoundaryTool(null);
  }, [clearBoundaryDraft, setBoundaryTool]);

  const selectBoundaryTool = useCallback(
    (tool) => {
      setBoundaryTool(tool);
      setIsBoundaryAddPanelOpen(false);
      setShowBoundaryAddPanel(true);

      /*
       * Move Vertex/Move Boundary act on whichever boundary is already
       * selected in the list, so they're the one pair that must not
       * clear the selection out from under themselves.
       */
      const preservesSelection = tool === "move" || tool === "moveGeometry";

      if (!preservesSelection) {
        clearSelectedBoundary?.();
      }

      if (tool === "multipolygon") {
        /*
         * Seeded here rather than left for the map's own click handler
         * to create, so the tool starts from a clean, well-formed draft
         * the instant it's picked and the first click already has a
         * part to append into. draftBoundaryColors is seeded alongside
         * it (never merged into the geometry - see
         * createEmptyBoundaryDraft) so the map preview paints a real
         * color from that same first click.
         */
        setBoundaryDraftGeometry(createEmptyBoundaryDraft());
        setDraftBoundaryColors({ ...DEFAULT_BOUNDARY_COLORS });
        setIsDrawingBoundary(true);
        return;
      }

      setIsDrawingBoundary(false);

      if (!preservesSelection) {
        setBoundaryDraftGeometry(null);
        setDraftBoundaryColors(null);
      }
    },
    [
      setBoundaryTool,
      setIsBoundaryAddPanelOpen,
      setShowBoundaryAddPanel,
      clearSelectedBoundary,
      setBoundaryDraftGeometry,
      setDraftBoundaryColors,
      setIsDrawingBoundary,
    ],
  );

  const handleImportButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) return;

      const { geometry, error } = await parseBoundaryImportFile(file);

      if (error || !geometry) {
        system?.notify?.(error || "Could not read that file.");
        return;
      }

      /*
       * An import has no click-to-draw session of its own - the shape
       * arrives complete, so this goes straight to the same "review
       * before saving" phase the draw tool reaches after Finish.
       */
      setBoundaryDraftGeometry(geometry);
      setDraftBoundaryColors({ ...DEFAULT_BOUNDARY_COLORS });
      setIsBoundaryAddPanelOpen(true);
      setShowBoundaryAddPanel(true);
    },
    [
      system,
      setBoundaryDraftGeometry,
      setDraftBoundaryColors,
      setIsBoundaryAddPanelOpen,
      setShowBoundaryAddPanel,
    ],
  );

  const handleFinishDrawBoundary = useCallback(() => {
    const finished = finishDrawingBoundary(system);
    if (finished) setIsBoundaryAddPanelOpen(true);
  }, [finishDrawingBoundary, system, setIsBoundaryAddPanelOpen]);

  const handleFinishBoundaryGeometryEdit = useCallback(async () => {
    await finishBoundaryGeometryEdit(selectedBoundary, system);
  }, [finishBoundaryGeometryEdit, selectedBoundary, system]);

  /*
   * Live map preview for the Add/Edit Boundary panel's own color
   * pickers - written to draftBoundaryColors, which both the draw and
   * import review phases paint from.
   */
  const handleBoundaryColorsPreview = useCallback(
    (colors) => {
      setDraftBoundaryColors(colors);
    },
    [setDraftBoundaryColors],
  );

  /*
   * Add and Edit share one submit, chosen by whether the Add panel is
   * what's open. The create payload is built explicitly from `fields`
   * plus the draft geometry - never by spreading anything else in,
   * since validateCreateBoundaryPayload rejects both missing and extra
   * keys.
   */
  const handleSubmitBoundary = useCallback(
    async (fields) => {
      setIsSubmitting(true);

      if (isBoundaryAddPanelOpen) {
        const created = await createBoundary(
          {
            projectId: schema._id,
            name: fields.name,
            fillColor: fields.fillColor,
            borderColor: fields.borderColor,
            geometry: boundaryDraftGeometry,
          },
          system,
        );

        setIsSubmitting(false);

        if (created?._id) {
          exitBoundaryTool();
        }

        return;
      }

      if (!selectedBoundary?._id) {
        setIsSubmitting(false);
        return;
      }

      await updateBoundary(
        { projectId: schema._id, _id: selectedBoundary._id, ...fields },
        system,
      );

      setIsSubmitting(false);
    },
    [
      setIsSubmitting,
      isBoundaryAddPanelOpen,
      createBoundary,
      schema?._id,
      boundaryDraftGeometry,
      system,
      exitBoundaryTool,
      selectedBoundary?._id,
      updateBoundary,
    ],
  );

  return {
    fileInputRef,
    selectBoundaryTool,
    exitBoundaryTool,
    handleImportButtonClick,
    handleImportFileChange,
    handleFinishDrawBoundary,
    handleFinishBoundaryGeometryEdit,
    handleBoundaryColorsPreview,
    handleSubmitBoundary,
  };
}
