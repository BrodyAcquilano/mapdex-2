// src/layers/LayerInfoPanel/LayerInfoPanel.jsx

import "./LayerInfoPanel.css";

/*
 * Right-hand panel for the Layers page's default view - always
 * available regardless of role, unlike LayerEditPanel (admin/owner +
 * the page's own Edit tool active - see Layers.jsx's own comment on
 * why edit access moved behind a toolbar tool rather than just being
 * permission-checked inline). Shows the same fields LayerEditPanel
 * lets an admin/owner change - name, description, classification, and
 * the one fillColor/borderColor pair - just read-only, so a
 * viewer/editor can actually see what a layer represents without being
 * able to touch it.
 */
export default function LayerInfoPanel({ layer }) {
  if (!layer) {
    return (
      <div className="layer-info-panel" role="region" aria-label="Layer Info Panel">
        <div className="layer-info-panel-header">
          <h2>Layer Info</h2>
        </div>

        <p className="layer-info-panel-empty-message">Select a layer to view its details.</p>
      </div>
    );
  }

  return (
    <div className="layer-info-panel" role="region" aria-label="Layer Info Panel">
      <div className="layer-info-panel-header">
        <h2>{layer.name}</h2>

        {/*
          * Displayed 1-based. A layer's stored `order` starts at 0
          * because the Data Layer conceptually occupies that slot in
          * the stack, which makes the first saved layer read as
          * "Order: 0" - confusing when the list shows it first. Only
          * the display is shifted; the stored value and every sort
          * that reads it are untouched.
          */}
        {Number.isFinite(Number(layer.order)) && (
          <span
            className="layer-info-panel-order-badge"
            title="Stacking order on the map - the Data Layer always sits below every saved layer, and a higher number stacks above a lower one."
          >
            Order: {Number(layer.order) + 1}
          </span>
        )}
      </div>

      {/*
        * Labelled rather than left as a bare paragraph - see
        * AggregateInfoPanel's matching comment. "Description" matches
        * LayerEditPanel's own form label for the same field.
        */}
      {layer.description && (
        <div className="layer-info-panel-description-block">
          <span className="layer-info-panel-description-label">Description</span>
          <p className="layer-info-panel-description">{layer.description}</p>
        </div>
      )}

      <div className="layer-info-panel-group">
        <div className="layer-info-panel-group-header">
          <span className="layer-info-panel-group-label">Classification</span>
          <span className="layer-info-panel-classification">{layer.classification}</span>
        </div>

        <div className="layer-info-panel-swatch-row">
          <span className="layer-info-panel-swatch" style={{ backgroundColor: layer.fillColor }} />
          <span className="layer-info-panel-swatch" style={{ backgroundColor: layer.borderColor }} />
        </div>
      </div>
    </div>
  );
}
