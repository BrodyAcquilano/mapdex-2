import {
  canCommitCurrentDraftPart,
  commitCurrentDraftPart,
} from "../utils/draftGeometry.js";

const MULTI_PART_TOOL_KEYS = ["multiline", "multipolygon", "addSubgeometry"];

/*
 * Only shown while the draft itself is a MultiLineString/MultiPolygon,
 * whose own drafts are built up as several parts (see draftGeometry.js's
 * own comment on that shape) rather than one continuous shape -
 * MultiPoint has no such concept (every click is just one more point
 * in the same flat group, no "closing" a part), so it never shows this
 * button. Commits whatever's been drawn so far as its own finished
 * line/polygon and starts a fresh, empty part to keep drawing into,
 * without ending the draw session - Finish (FinishDrawingButton.jsx)
 * is still what actually saves the whole multi-geometry.
 *
 * addSubgeometry reuses this same button - its own draft is always
 * already converted to a Multi- type by the time it's selectable here
 * (see createAddSubgeometryDraft), so canCommitCurrentDraftPart/
 * commitCurrentDraftPart both already work on it exactly like the
 * plain multiline/multipolygon tools' own drafts. The one difference
 * is Undo: addSubgeometry uses the shared geometryEditHistory
 * mechanism (like every other edit tool), not draw's "pop last
 * vertex," so committing a part here has to push a snapshot first -
 * DrawController.jsx/useDrawController.js do the same for every other
 * addSubgeometry mutation.
 */
export default function EndPartDrawingButton({
  isDrawing,
  geometryTool,
  draftGeometry,
  setDraftGeometry,
  setGeometryEditHistory,
}) {
  const canShow =
    isDrawing &&
    MULTI_PART_TOOL_KEYS.includes(geometryTool) &&
    canCommitCurrentDraftPart(draftGeometry);

  if (!canShow) {
    return null;
  }

  const isAddSubgeometry = geometryTool === "addSubgeometry";

  const label =
    geometryTool === "multipolygon" ||
    (isAddSubgeometry && draftGeometry?.type === "MultiPolygon")
      ? "Close Polygon"
      : "End Line";

  function handleEndPart() {
    if (isAddSubgeometry) {
      setGeometryEditHistory?.((current) => [
        ...(current || []),
        structuredClone(draftGeometry),
      ]);
    }

    setDraftGeometry((current) => commitCurrentDraftPart(current));
  }

  return (
    <button
      type="button"
      className="undo-drawing-button"
      onClick={handleEndPart}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">✂️</span>
      <span>{label}</span>
    </button>
  );
}
