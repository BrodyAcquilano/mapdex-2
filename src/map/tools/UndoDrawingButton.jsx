import {
  canUndoDraftVertex,
  removeLastDraftVertex,
} from "../utils/draftGeometry.js";

const DRAW_UNDOABLE_TOOL_KEYS = [
  "line",
  "polygon",
  "multipoint",
  "multiline",
  "multipolygon",
];
const EDIT_UNDOABLE_TOOL_KEYS = [
  "moveGeometry",
  "midpoint",
  "addSubgeometry",
  "remove",
  "removeSubgeometry",
];

/*
 * Serves two different undo semantics behind one button:
 * - While drawing a new line/polygon, undo pops the most recently
 *   placed vertex (removeLastDraftVertex), matching how the shape was
 *   built up (always appending to the end).
 * - While using the "add midpoint"/"remove point" edit tools, undo
 *   instead pops geometryEditHistory - a stack of full draftGeometry
 *   snapshots taken before each vertex mutation (see DrawLayer.jsx in
 *   both engines) - since those tools can mutate any index, not just
 *   the end of the array, so restoring "the previous full shape" is
 *   simpler and more robust than trying to reverse a specific edit.
 */
export default function UndoDrawingButton({
  isDrawing,
  geometryTool,
  draftGeometry,
  setDraftGeometry,
  geometryEditHistory,
  setGeometryEditHistory,
}) {
  const canUndoDraw =
    isDrawing &&
    DRAW_UNDOABLE_TOOL_KEYS.includes(geometryTool) &&
    canUndoDraftVertex(draftGeometry);

  const canUndoEdit =
    isDrawing &&
    EDIT_UNDOABLE_TOOL_KEYS.includes(geometryTool) &&
    Array.isArray(geometryEditHistory) &&
    geometryEditHistory.length > 0;

  if (!canUndoDraw && !canUndoEdit) {
    return null;
  }

  function handleUndo() {
    if (canUndoEdit) {
      const previousGeometry =
        geometryEditHistory[geometryEditHistory.length - 1];

      setDraftGeometry(previousGeometry);
      setGeometryEditHistory((current) => current.slice(0, -1));

      return;
    }

    setDraftGeometry((current) => removeLastDraftVertex(current));
  }

  return (
    <button
      type="button"
      className="undo-drawing-button"
      onClick={handleUndo}
      aria-label="Undo Last Change"
      title="Undo Last Change"
    >
      <span aria-hidden="true">↩️</span>
      <span>Back</span>
    </button>
  );
}
