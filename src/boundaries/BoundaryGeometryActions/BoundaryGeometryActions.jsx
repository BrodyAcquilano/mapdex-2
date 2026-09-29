// src/boundaries/BoundaryGeometryActions/BoundaryGeometryActions.jsx

import { Check, CornerUpLeft, Scissors } from "lucide-react";

import {
  canFinishDraftGeometry,
  canUndoDraftVertex,
  removeLastDraftVertex,
  canCommitCurrentDraftPart,
  commitCurrentDraftPart,
} from "../../map/utils/draftGeometry.js";
import { canSaveBoundaryDraft } from "../utils/boundaryDraft.js";

import "./BoundaryGeometryActions.css";

/*
 * The action row for the Boundaries page's own map tools.
 *
 * Deliberately separate from src/map/tools/DrawingActionButtons.jsx,
 * which belongs to the Editor page's data-item draw/edit workflow -
 * that one is left alone entirely. The two look similar but differ in
 * what they commit to and which buttons apply:
 *
 *  - Draw Boundary ("multipolygon") builds a new ring click by click,
 *    so it gets Back (pop last vertex), End Part (commit this ring and
 *    start another) and Finish.
 *  - Move Vertex / Move Boundary edit a shape that already exists, so
 *    only Back and Finish apply - there's no vertex being appended to
 *    undo, and no part to end. Finish here commits straight to the
 *    boundary's own /update-geometry route rather than through any form
 *    or panel.
 *
 * Back is always present, and falls through to onExitTool once there's
 * nothing left to undo - hitting Back from the very first state leaves
 * the tool entirely and returns you to the Hand tool. That behaviour
 * existed on the old Layers tab and not on the Aggregates one; Brody's
 * call was to keep it, since a draw mode you can only escape via the
 * toolbar is a dead end. It also means this component never renders
 * nothing: the old version bailed out early when no button applied,
 * which is how a malformed empty draft on the Layers page could make
 * the whole row silently vanish instead of showing an obvious way out.
 *
 * `allowSingleCollapse` is true throughout because a boundary is always
 * a Polygon or MultiPolygon, and a 1-part MultiPolygon collapsing down
 * to a plain Polygon is valid - matching useBoundaryGeometryTools.
 */
export default function BoundaryGeometryActions({
  geometryTool,
  isDrawing,
  draftGeometry,
  setDraftGeometry,
  onFinish,
  onExitTool,
  isSubmitting,
}) {
  const isDrawTool = geometryTool === "multipolygon";
  const isMoveTool = geometryTool === "move" || geometryTool === "moveGeometry";

  if (!isDrawTool && !isMoveTool) return null;

  /*
   * A move tool's draft is seeded from the saved boundary the moment
   * the tool is picked, so Finish is available immediately - the shape
   * is already valid, and "finish" here means "save what's on screen".
   *
   * The two tools ask different questions, so they use different
   * checks. Drawing asks "is this a shape I'd let you create?" and
   * keeps draftGeometry.js's own self-intersection guard. Moving asks
   * "is this still structurally a polygon?" - see canSaveBoundaryDraft
   * for why applying the draw-time guard here hid Finish on most real
   * imported boundaries.
   */
  const canFinish = isMoveTool
    ? canSaveBoundaryDraft(draftGeometry)
    : isDrawing && canFinishDraftGeometry(draftGeometry, true);

  const canUndo = isDrawTool && isDrawing && canUndoDraftVertex(draftGeometry);

  const canEndPart =
    isDrawTool && isDrawing && canCommitCurrentDraftPart(draftGeometry);

  function handleBack() {
    if (canUndo) {
      setDraftGeometry((current) => removeLastDraftVertex(current));
      return;
    }

    onExitTool?.();
  }

  return (
    <div className="boundary-actions-row">
      <button
        type="button"
        className="boundary-action-button secondary"
        onClick={handleBack}
        aria-label={canUndo ? "Undo Last Point" : "Leave This Tool"}
        title={canUndo ? "Undo the last point" : "Leave this tool"}
      >
        <CornerUpLeft size={16} />
        Back
      </button>

      {canEndPart && (
        <button
          type="button"
          className="boundary-action-button secondary"
          onClick={() => setDraftGeometry((current) => commitCurrentDraftPart(current))}
          aria-label="End This Ring"
          title="End this ring and start another"
        >
          <Scissors size={16} />
          End Part
        </button>
      )}

      {canFinish && (
        <button
          type="button"
          className="boundary-action-button primary"
          onClick={onFinish}
          disabled={isSubmitting}
          aria-label={isMoveTool ? "Save Boundary" : "Finish Boundary"}
        >
          <Check size={16} />
          {/*
           * The move tools genuinely save - Finish here commits straight
           * to the boundary's own /update-geometry route. Everywhere else
           * a boundary is chosen rather than written says "Select
           * Boundary" instead.
           */}
          {isMoveTool ? "Save Boundary" : "Finish Boundary"}
        </button>
      )}
    </div>
  );
}
