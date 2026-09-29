// src/layers/LayersToolMenu/LayersToolMenu.jsx

import { Hand, Square, Route, Pencil } from "lucide-react";

import "./LayersToolMenu.css";

/*
 * The Layers page's own tool menu - admin/owner only (Layers.jsx never
 * mounts this for a viewer/editor). Deliberately a plain row of
 * buttons rather than src/map/tools/GeometryToolWheel.jsx's radial
 * layout - that wheel's layout math is tuned around its own 4 fixed
 * quadrant groups and a dozen-plus tools, which doesn't fit the tools
 * here. The Hand tool is just "nothing selected" (same effect as
 * GeometryToolWheel's own center button) - it exists as its own
 * button so leaving Add/Edit is always one obvious click away rather
 * than requiring re-clicking the already-active one.
 *
 * Two separate Add tools ("add-patch"/"add-corridor"), not one - a
 * layer's classification is set once by which Add tool built it and
 * never editable afterward (Brody's own call), so the classification
 * itself has to be chosen by which button starts the workflow rather
 * than a field inside it. The only real difference between the two
 * workflows is which classification the created layer gets, plus
 * Corridor's own Point/MultiPoint exclusion from its live membership
 * (getLayerMatchingData in computeLayerMembers.js) - both otherwise
 * reuse the exact same LayerEditPanel/FilterPanel flow.
 *
 * The locked "Aggregator" placeholder that used to live here moved out
 * entirely - aggregation is now its own page (src/workflows/
 * Aggregates.jsx, src/aggregates/), not a Layers tool.
 *
 * Edit is what gates LayerEditPanel - selecting a layer from the list
 * only opens the read-only LayerInfoPanel (available to every role)
 * unless this tool is active, mirroring the same change made to the
 * new Aggregates page's own tool menu.
 */
export default function LayersToolMenu({ activeTool, onSelectTool, canAddCorridor }) {
  return (
    <div className="layers-tool-menu" role="toolbar" aria-label="Layers Tools">
      <button
        type="button"
        className={`layers-tool-menu-button ${activeTool === null ? "active" : ""}`}
        onClick={() => onSelectTool(null)}
        aria-label="Hand Tool"
        aria-pressed={activeTool === null}
        title="Hand"
      >
        <Hand size={20} />
      </button>

      <button
        type="button"
        className={`layers-tool-menu-button ${activeTool === "add-patch" ? "active" : ""}`}
        onClick={() => onSelectTool("add-patch")}
        aria-label="Add Patch Layer Tool"
        aria-pressed={activeTool === "add-patch"}
        title="Add Patch Layer"
      >
        <Square size={20} />
      </button>

      <button
        type="button"
        className={`layers-tool-menu-button ${activeTool === "add-corridor" ? "active" : ""}`}
        onClick={() => onSelectTool("add-corridor")}
        disabled={!canAddCorridor}
        aria-label="Add Corridor Layer Tool"
        aria-pressed={activeTool === "add-corridor"}
        title={
          canAddCorridor
            ? "Add Corridor Layer"
            : "This project only allows point geometry, which can't form a corridor"
        }
      >
        <Route size={20} />
      </button>

      <button
        type="button"
        className={`layers-tool-menu-button ${activeTool === "edit" ? "active" : ""}`}
        onClick={() => onSelectTool("edit")}
        aria-label="Edit Tool"
        aria-pressed={activeTool === "edit"}
        title="Edit"
      >
        <Pencil size={20} />
      </button>
    </div>
  );
}
