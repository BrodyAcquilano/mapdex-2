// src/aggregates/AggregateListPanel/AggregateListPanel.jsx

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import "./AggregateListPanel.css";

/*
 * Left-hand panel for the Aggregates page's default view - one panel,
 * two tabs (Brody's own call over splitting the panel in half), since
 * only one of aggregates/boundaries is ever selectable/editable at a
 * time anyway (the map itself only ever renders one or the other too -
 * see Aggregates.jsx's own comment). Visibility/opacity here are
 * local-only per-viewer display preferences, exactly like
 * LayerListPanel.jsx's own rows - every role gets full control over
 * them, since toggling what's shown on your own screen isn't "editing"
 * the saved aggregate/boundary. Row selection (to open
 * AggregateEditPanel/AggregateInfoPanel) works for every role -
 * AggregateEditPanel itself is only ever mounted for admin/owner with
 * the page's own Edit tool active (see Aggregates.jsx).
 */
export default function AggregateListPanel({
  aggregates,
  onToggleVisible,
  onOpacityChange,
  selectedId,
  onSelectItem,
  canExport,
  onExportVisibleAggregatesPartial,
  onExportVisibleAggregatesFull,
  hasVisibleAggregates,
  isExporting,
}) {
  const [openOpacityId, setOpenOpacityId] = useState(null);

  function toggleOpacityPopover(id) {
    setOpenOpacityId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="aggregate-list-panel" role="region" aria-label="Aggregate List Panel">
      {/*
        * Boundaries used to be a second tab here. They have their own
        * page now (src/workflows/Boundaries.jsx), so a plain header
        * sits where the tab strip was - same change the Layers list
        * panel got.
        */}
      <div className="aggregate-list-panel-header">Aggregates List</div>

      <ul className="aggregate-list">
        {(aggregates || []).map((item) => (
          <li
            key={item._id}
            className={`aggregate-list-row ${selectedId === item._id ? "selected" : ""}`}
          >
            <input
              type="checkbox"
              checked={item.visible !== false}
              onChange={() => onToggleVisible(item._id)}
              aria-label={`Toggle ${item.name} visibility`}
            />

            <span
              className="aggregate-list-swatch"
              style={{ backgroundColor: item.fillColor, borderColor: item.borderColor }}
            />

            <button
              type="button"
              className="aggregate-list-name-button"
              onClick={() => onSelectItem(item._id)}
            >
              {item.name}
            </button>

            <button
              type="button"
              className="aggregate-list-eye-button"
              onClick={() => toggleOpacityPopover(item._id)}
              aria-label={`Adjust ${item.name} opacity`}
            >
              {item.visible !== false ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>

            {openOpacityId === item._id && (
              <div className="aggregate-list-opacity-popover">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={item.opacity ?? 1}
                  onChange={(event) =>
                    onOpacityChange(item._id, Number(event.target.value))
                  }
                  className="aggregate-list-opacity-slider"
                  aria-label={`${item.name} opacity`}
                />
              </div>
            )}
          </li>
        ))}

      {(!aggregates || aggregates.length === 0) && (
        <li className="aggregate-list-empty-message">No aggregates yet.</li>
      )}
      </ul>

      {canExport && (
        <div className="aggregate-list-panel-footer">
          <button
            type="button"
            className="aggregate-list-export-button"
            onClick={onExportVisibleAggregatesPartial}
            disabled={isExporting || !hasVisibleAggregates}
          >
            Export Visible Aggregates (Aggregates Only)
          </button>
          <button
            type="button"
            className="aggregate-list-export-button"
            onClick={onExportVisibleAggregatesFull}
            disabled={isExporting || !hasVisibleAggregates}
          >
            Export Visible Aggregates (Full Snapshot)
          </button>
        </div>
      )}
    </div>
  );
}
