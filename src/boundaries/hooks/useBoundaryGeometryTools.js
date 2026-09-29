// src/boundaries/hooks/useBoundaryGeometryTools.js

import { useCallback } from "react";

import {
  canFinishDraftGeometry,
  completeDraftGeometry,
} from "../../map/utils/draftGeometry.js";
import { sanitizeBoundaryGeometry } from "../../../shared/validation/aggregateValidation.js";
import { updateDataItemInList } from "../../dataUtils/dataUtils.js";

/*
 * The Draw Boundary / Move Vertex / Move Boundary tools' own finish
 * handlers. These are hooks rather than plain helpers because they
 * close over the in-progress draft the map is actively mutating as the
 * user clicks and drags - the same reason the item draw/edit tools are
 * (see src/forms/hooks/).
 *
 * Filed under src/boundaries/ rather than src/map/ by what they
 * ultimately produce, not what they touch: these exist to build a
 * boundary. Map hooks are the ones that only move the camera or
 * marshal map controls without feeding any draft (see src/map/hooks/).
 *
 * Both engine runtimes (Places/Events) held identical copies of these
 * inline; they now call this and supply only their own state.
 */
export function useBoundaryGeometryTools({
  schema,
  boundaryDraftGeometry,
  setBoundaryDraftGeometry,
  setIsDrawingBoundary,
  setBoundaries,
  boundariesApi,
}) {
  /*
   * Recomputes a boundary geometry's bbox/centroid the same way
   * completeDraftGeometry already does for every place/event draw/edit
   * tool - ring-closing, self-intersection-safe closing gesture, a
   * 1-part MultiPolygon collapsing down to a plain Polygon - then
   * strips the border/fill color completeDraftGeometry's own
   * sanitizePolygonGeometry/sanitizeMultiPolygonGeometry calls always
   * add, since a boundary has none of its own. Mirrors
   * aggregateValidation.js's own sanitizeBoundaryGeometry (which strips
   * the exact same two keys from an already-well-formed import file),
   * just applied after completeDraftGeometry's own ring-closing/finish
   * logic instead of before it, since this runs on an in-progress
   * draw/edit draft rather than a fully-formed file.
   */
  const completeBoundaryGeometry = useCallback((geometry) => {
    const completed = completeDraftGeometry(geometry, true);
    if (!completed) return null;

    const { borderColor: _borderColor, fillColor: _fillColor, ...boundaryGeometry } = completed;
    return boundaryGeometry;
  }, []);

  /*
   * The Draw Boundary tool's own "finish" - the counterpart to the
   * item draw workflow's own drawDraft, but far simpler: a boundary has
   * no schema-driven add form to populate (see BoundaryEditPanel.jsx -
   * just a name and colors), so this only ever validates/completes the
   * geometry itself and hands it back to the page to open its own Add
   * Boundary panel with, never touching isAddPanelOpen/blankFormTemplate
   * the way the item draw workflow does.
   */
  const drawBoundaryDraft = useCallback(
    (geometry, system) => {
      const completedGeometry = completeBoundaryGeometry(geometry);

      if (!completedGeometry) {
        system?.notify?.("Finish drawing the boundary before continuing.");
        return false;
      }

      setBoundaryDraftGeometry(completedGeometry);
      setIsDrawingBoundary(false);

      return true;
    },
    [completeBoundaryGeometry, setBoundaryDraftGeometry, setIsDrawingBoundary],
  );

  const finishDrawingBoundary = useCallback(
    (system) => {
      if (!canFinishDraftGeometry(boundaryDraftGeometry, true)) return false;

      return drawBoundaryDraft(boundaryDraftGeometry, system);
    },
    [boundaryDraftGeometry, drawBoundaryDraft],
  );

  /*
   * The Move Vertex/Move Boundary tools' own "finish" - the boundary
   * counterpart to finishGeometryEdit. Unlike that function, a boundary
   * has no updatedAt-based conflict check (its own update-geometry route
   * doesn't ask for one - Brody's own call to keep validation light here
   * for now), and re-seeds the draft from the server's own confirmed
   * response afterward so further edits (moving more vertices, then
   * Finish again) keep working without reselecting the tool.
   */
  const finishBoundaryGeometryEdit = useCallback(
    async (boundary, system) => {
      if (!boundary?._id) {
        system?.notify?.("Select a boundary to edit.");
        return null;
      }

      /*
       * sanitizeBoundaryGeometry, not completeBoundaryGeometry above.
       * Both recompute bbox/centroid through the same underlying
       * sanitizers, but completeDraftGeometry short-circuits on
       * canFinishDraftGeometry first - the draw-time self-intersection
       * guard that most real imported boundaries fail (see
       * canSaveBoundaryDraft in ../utils/boundaryDraft.js). Routing a
       * move through it returned null and reported "The geometry is not
       * valid." for shapes that were always perfectly storable.
       *
       * Using the shared helper also keeps the bbox/centroid this sends
       * byte-identical to what the server recomputes when
       * validateUpdateBoundaryGeometryPayload checks them, which that
       * route requires.
       */
      const completedGeometry = sanitizeBoundaryGeometry(boundaryDraftGeometry);

      if (!completedGeometry) {
        system?.notify?.("The geometry is not valid.");
        return null;
      }

      const { data, message } = await boundariesApi.updateGeometry({
        projectId: schema._id,
        _id: boundary._id,
        geometry: completedGeometry,
      });

      system?.notify?.(message);

      if (!data?._id) return null;

      /*
       * The shared list helper rather than a hand-rolled map, so the
       * boundaries array is updated the same way every other collection
       * in the app is - which is also what repaints the moved shape on
       * the map, since the map reads straight off this array.
       */
      updateDataItemInList(setBoundaries, data);
      setBoundaryDraftGeometry(structuredClone(data.geometry));

      return data;
    },
    [
      schema?._id,
      boundaryDraftGeometry,
      boundariesApi,
      setBoundaries,
      setBoundaryDraftGeometry,
    ],
  );

  return {
    completeBoundaryGeometry,
    drawBoundaryDraft,
    finishDrawingBoundary,
    finishBoundaryGeometryEdit,
  };
}
