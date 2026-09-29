// src/boundaries/BoundariesToolMenu/BoundariesToolMenu.jsx

import { Hand, PenTool, Upload, CircleDot, Move } from "lucide-react";

import "./BoundariesToolMenu.css";

/*
 * The Boundaries tab's own tool menu - a separate toolbar from
 * AggregatesToolMenu.jsx (the Aggregates tab's own), swapped in by
 * src/workflows/Aggregates.jsx whenever the list panel's own tab is
 * "boundaries" rather than one shared menu changing its own button set
 * for both tabs - Brody's own call, since the two tabs' tools have
 * nothing in common (an aggregate is never drawn/edited geometrically
 * here at all - its shape is always its boundary's own).
 *
 * "Draw Boundary"/"Move Vertex"/"Move Boundary" pass their tool key
 * straight through as one of draftGeometry.js's own existing tool key
 * strings ("multipolygon"/"move"/"moveGeometry") rather than a
 * boundary-specific name - see Aggregates.jsx's own comment on why:
 * doing so lets this page reuse the exact same DrawController/
 * DrawingActionButtons/FinishDrawingButton/UndoDrawingButton machinery
 * the places/events editor already built for those same tool keys,
 * with no translation layer in between.
 *
 * Move Vertex/Move Boundary only make sense once a boundary is actually
 * selected in the list (there's nothing to drag otherwise) - disabled,
 * not hidden, until one is, so the toolbar's own layout stays stable.
 *
 * Deliberately has no Edit tool, unlike the Aggregates/Layers toolbars.
 * Those need one to switch the right-hand panel between a read-only
 * info view and the edit form; a boundary has no info view to switch
 * away from - its name is already in the list and its color is on the
 * map, and its geometry is edited with the Move tools here rather than
 * in a panel. So the edit form simply opens whenever a boundary is
 * selected and the viewer is an owner/admin, and an Edit tool would be
 * pure friction (Brody's own call).
 */
export default function BoundariesToolMenu({ activeTool, onSelectTool, hasSelectedBoundary }) {
  return (
    <div className="aggregates-tool-menu" role="toolbar" aria-label="Boundaries Tools">
      <button
        type="button"
        className={`aggregates-tool-menu-button ${activeTool === null ? "active" : ""}`}
        onClick={() => onSelectTool(null)}
        aria-label="Hand Tool"
        aria-pressed={activeTool === null}
        title="Hand"
      >
        <Hand size={20} />
      </button>

      <button
        type="button"
        className={`aggregates-tool-menu-button ${activeTool === "multipolygon" ? "active" : ""}`}
        onClick={() => onSelectTool("multipolygon")}
        aria-label="Draw Boundary Tool"
        aria-pressed={activeTool === "multipolygon"}
        title="Draw Boundary"
      >
        <PenTool size={20} />
      </button>

      <button
        type="button"
        className={`aggregates-tool-menu-button ${activeTool === "importBoundary" ? "active" : ""}`}
        onClick={() => onSelectTool("importBoundary")}
        aria-label="Import Boundary Tool"
        aria-pressed={activeTool === "importBoundary"}
        title="Import Boundary"
      >
        <Upload size={20} />
      </button>

      <button
        type="button"
        className={`aggregates-tool-menu-button ${activeTool === "move" ? "active" : ""}`}
        onClick={() => onSelectTool("move")}
        disabled={!hasSelectedBoundary}
        aria-label="Move Vertex Tool"
        aria-pressed={activeTool === "move"}
        title={hasSelectedBoundary ? "Move Vertex" : "Select a boundary first"}
      >
        <CircleDot size={20} />
      </button>

      <button
        type="button"
        className={`aggregates-tool-menu-button ${activeTool === "moveGeometry" ? "active" : ""}`}
        onClick={() => onSelectTool("moveGeometry")}
        disabled={!hasSelectedBoundary}
        aria-label="Move Boundary Tool"
        aria-pressed={activeTool === "moveGeometry"}
        title={hasSelectedBoundary ? "Move Boundary" : "Select a boundary first"}
      >
        <Move size={20} />
      </button>

    </div>
  );
}
