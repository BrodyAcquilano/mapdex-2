import {
  canFinishDraftGeometry,
} from "../utils/draftGeometry.js";

import "./FinishDrawingButton.css";

export default function FinishDrawingButton({
  isDrawing,
  geometryTool,
  draftGeometry,
  onFinish,
}) {
  const isEditTool =
    geometryTool === "move" ||
    geometryTool === "moveGeometry" ||
    geometryTool === "midpoint" ||
    geometryTool === "addSubgeometry" ||
    geometryTool === "remove" ||
    geometryTool === "removeSubgeometry";

  const isFinishableDrawTool =
    geometryTool === "line" ||
    geometryTool === "polygon" ||
    geometryTool === "multipoint" ||
    geometryTool === "multiline" ||
    geometryTool === "multipolygon";

  const canShow =
    isDrawing &&
    (
      isEditTool ||
      isFinishableDrawTool
    ) &&
    canFinishDraftGeometry(
      draftGeometry,
    );

  if (!canShow) {
    return null;
  }

  return (
    <button
      type="button"
      className="finish-drawing-button"
      onClick={onFinish}
      aria-label={
        isEditTool
          ? "Save Geometry Changes"
          : "Finish Drawing"
      }
      title={
        isEditTool
          ? "Save Geometry Changes"
          : "Finish Drawing"
      }
    >
      <span aria-hidden="true">
        ✅
      </span>

      <span>Finish</span>
    </button>
  );
}