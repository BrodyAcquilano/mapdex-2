// src/layers/LayerListPanel/LayerListPanel.jsx

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import "./LayerListPanel.css";

const DATA_LAYER_ID = "__data__";

/*
 * Left-hand panel for the Layers page (src/workflows/Layers.jsx) -
 * lists the project's own "Data Layer" (every data item, unclassified,
 * always available) above whatever saved layers exist, each with a
 * visibility checkbox and an eye icon that opens a small vertical
 * opacity slider. Visibility/opacity here are local-only per-viewer
 * display preferences (see Layers.jsx's own layerViewState) - every
 * role (viewer/editor/admin/owner) gets full control over them, since
 * toggling what's shown on your own screen isn't "editing" the saved
 * layer. Row selection works for every role - it opens LayerInfoPanel
 * (read-only, always available) or LayerEditPanel (admin/owner with
 * the page's own Edit tool active) depending entirely on what
 * Layers.jsx itself decides to render there, not on anything this
 * list gates.
 */
export default function LayerListPanel({
  layers,
  onToggleVisible,
  onOpacityChange,
  showDataLayer,
  dataLayerOpacity,
  onToggleDataLayer,
  onDataLayerOpacityChange,
  selectedLayerId,
  onSelectLayer,
  canExport,
  onExportPartial,
  onExportFull,
  isExporting,
}) {
  const [openOpacityId, setOpenOpacityId] = useState(null);

  function toggleOpacityPopover(id) {
    setOpenOpacityId((prev) => (prev === id ? null : id));
  }

  /*
   * Boundaries used to be a second tab in this panel. They have their
   * own page now (src/workflows/Boundaries.jsx), so the tab strip is
   * gone and a plain header sits in its place - same change the
   * Aggregates list panel got.
   */
  return (
    <div className="layer-list-panel" role="region" aria-label="Layer List Panel">
      <div className="layer-list-panel-header">Layers List</div>

      <ul className="layer-list">
        <li className="layer-list-row layer-list-row-data-layer">
          <input
            type="checkbox"
            checked={showDataLayer}
            onChange={onToggleDataLayer}
            aria-label="Toggle Data Layer visibility"
          />

          <span className="layer-list-swatch layer-list-swatch-data-layer" />

          <span className="layer-list-name">Data Layer</span>

          <button
            type="button"
            className="layer-list-eye-button"
            onClick={() => toggleOpacityPopover(DATA_LAYER_ID)}
            aria-label="Adjust Data Layer opacity"
          >
            {showDataLayer ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>

          {openOpacityId === DATA_LAYER_ID && (
            <div className="layer-list-opacity-popover">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={dataLayerOpacity}
                onChange={(event) =>
                  onDataLayerOpacityChange(Number(event.target.value))
                }
                className="layer-list-opacity-slider"
                aria-label="Data Layer opacity"
              />
            </div>
          )}
        </li>

        {(layers || []).map((layer) => {
          const isSelected = selectedLayerId === layer._id;

          return (
            <li
              key={layer._id}
              className={`layer-list-row layer-list-row-selectable ${
                isSelected ? "layer-list-row-selected" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={() => onToggleVisible(layer._id)}
                aria-label={`Toggle ${layer.name} visibility`}
              />

              <span
                className="layer-list-swatch"
                style={{ backgroundColor: layer.fillColor, borderColor: layer.borderColor }}
                title={`${layer.classification}: fill ${layer.fillColor || "n/a"}, border ${
                  layer.borderColor || "n/a"
                }`}
              />

              <button
                type="button"
                className="layer-list-name-button"
                onClick={() => onSelectLayer(layer._id)}
              >
                {layer.name}
              </button>

              <button
                type="button"
                className="layer-list-eye-button"
                onClick={() => toggleOpacityPopover(layer._id)}
                aria-label={`Adjust ${layer.name} opacity`}
              >
                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>

              {openOpacityId === layer._id && (
                <div className="layer-list-opacity-popover">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={layer.opacity}
                    onChange={(event) =>
                      onOpacityChange(layer._id, Number(event.target.value))
                    }
                    className="layer-list-opacity-slider"
                    aria-label={`${layer.name} opacity`}
                  />
                </div>
              )}
            </li>
          );
        })}

        {(!layers || layers.length === 0) && (
          <li className="layer-list-empty-message">No saved layers yet.</li>
        )}
      </ul>

      {canExport && (
        <div className="layer-list-panel-footer">
          <button
            type="button"
            className="layer-list-export-button"
            onClick={onExportPartial}
            disabled={isExporting}
          >
            Export Active Layers (Layers Only)
          </button>
          <button
            type="button"
            className="layer-list-export-button"
            onClick={onExportFull}
            disabled={isExporting}
          >
            Export Active Layers (Full Snapshot)
          </button>
        </div>
      )}
    </div>
  );
}
