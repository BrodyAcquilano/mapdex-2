import UndoDrawingButton from "./UndoDrawingButton.jsx";
import EndPartDrawingButton from "./EndPartDrawingButton.jsx";
import FinishDrawingButton from "./FinishDrawingButton.jsx";

import "./DrawingActionButtons.css";

/*
 * Shared row for the draw workflow's undo/finish buttons, so the two
 * stay centered as a pair (or centered alone, whichever is currently
 * showing) instead of each being independently centered and
 * potentially overlapping. Undo shows for line/polygon drawing and
 * for the midpoint/remove edit tools (see UndoDrawingButton.jsx);
 * Finish shows for those plus the move tool, all under one shared
 * "Save Geometry Changes" action.
 */
export default function DrawingActionButtons({
  isDrawing,
  geometryTool,
  draftGeometry,
  setDraftGeometry,
  geometryEditHistory,
  setGeometryEditHistory,
  onFinish,
}) {
  const isEditTool =
    geometryTool === "move" ||
    geometryTool === "moveGeometry" ||
    geometryTool === "midpoint" ||
    geometryTool === "addSubgeometry" ||
    geometryTool === "remove" ||
    geometryTool === "removeSubgeometry";

  return (
    <div
      className={`drawing-action-buttons ${
        isEditTool ? "edit-toolbar-open" : ""
      }`}
    >
      <UndoDrawingButton
        isDrawing={isDrawing}
        geometryTool={geometryTool}
        draftGeometry={draftGeometry}
        setDraftGeometry={setDraftGeometry}
        geometryEditHistory={geometryEditHistory}
        setGeometryEditHistory={setGeometryEditHistory}
      />

      <EndPartDrawingButton
        isDrawing={isDrawing}
        geometryTool={geometryTool}
        draftGeometry={draftGeometry}
        setDraftGeometry={setDraftGeometry}
        setGeometryEditHistory={setGeometryEditHistory}
      />

      <FinishDrawingButton
        isDrawing={isDrawing}
        geometryTool={geometryTool}
        draftGeometry={draftGeometry}
        onFinish={onFinish}
      />
    </div>
  );
}
