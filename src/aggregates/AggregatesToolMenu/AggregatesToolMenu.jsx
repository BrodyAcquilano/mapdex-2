// src/aggregates/AggregatesToolMenu/AggregatesToolMenu.jsx

import { Hand, Plus, Pencil } from "lucide-react";

import "./AggregatesToolMenu.css";

/*
 * The Aggregates tab's own tool menu - admin/owner only (Aggregates.jsx
 * never mounts this for a viewer/editor). A plain button row, same
 * call as src/layers/LayersToolMenu/LayersToolMenu.jsx's own (its
 * comment explains why, over reusing src/map/tools/GeometryToolWheel.jsx's
 * radial layout).
 *
 * Kept deliberately separate from BoundariesToolMenu.jsx (the Boundaries
 * tab's own toolbar) rather than one shared menu switching its own
 * button set - see Aggregates.jsx's own comment on why each tab gets
 * its own toolbar, reset to the Hand tool whenever the tab switches.
 *
 * Edit sits to the right of Add - selecting it is what allows
 * AggregateEditPanel to open at all when a list row is picked (see
 * Aggregates.jsx's own comment); without it, selecting a row only ever
 * opens the read-only AggregateInfoPanel, available to every role.
 */
export default function AggregatesToolMenu({ activeTool, onSelectTool }) {
  return (
    <div className="aggregates-tool-menu" role="toolbar" aria-label="Aggregates Tools">
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
        className={`aggregates-tool-menu-button ${activeTool === "addAggregate" ? "active" : ""}`}
        onClick={() => onSelectTool("addAggregate")}
        aria-label="Add Aggregate Tool"
        aria-pressed={activeTool === "addAggregate"}
        title="Add Aggregate"
      >
        <Plus size={20} />
      </button>

      <button
        type="button"
        className={`aggregates-tool-menu-button ${activeTool === "edit" ? "active" : ""}`}
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
