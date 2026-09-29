// src/layers/LayerEditPanel/LayerEditPanel.jsx

import { useEffect, useState } from "react";

import { LAYER_NAME_MAX_LENGTH, LAYER_DESCRIPTION_MAX_LENGTH } from "../utils/layerConstants.js";

import "./LayerEditPanel.css";

function buildFieldsFromLayer(layer) {
  return {
    name: layer?.name || "",
    description: layer?.description || "",
  };
}

/*
 * Right-hand panel for the Layers page (src/workflows/Layers.jsx) -
 * doubles as the "Add Layer" panel while one of the page's two Add
 * tools is active (mode="add", built from whatever the FilterPanel/map
 * currently has filtered) and the ordinary edit panel for a selected
 * saved layer (mode="edit"). Only ever rendered for an admin/owner -
 * Layers.jsx itself decides whether to mount this at all for a
 * viewer/editor.
 *
 * One fillColor/borderColor pair applies to the whole layer, uniformly
 * across whatever geometry types its own data items happen to be
 * (borderColor doubles as the line color - see LayersGeometryLayer.jsx's
 * own comment). `classification` ("Patch"/"Corridor") is always shown
 * read-only, never an editable control here - it's set once by which
 * Add tool built the layer (Add Patch Layer vs. Add Corridor Layer -
 * LayersToolMenu.jsx) and never editable afterward, so this panel only
 * ever displays it, whether adding or editing.
 *
 * `colors` (`{fillColor, borderColor}`) is controlled from the parent
 * rather than local state like the rest of the form - Layers.jsx keeps
 * it in the shared engine runtime as `draftLayerColors` so the map (a
 * sibling of this panel, not a child) can preview the in-progress
 * colors live as they're changed here, before Save/Add Layer is ever
 * clicked. Name/description have no map-visible effect, so they stay
 * this component's own local state.
 */
export default function LayerEditPanel({
  mode,
  layer,
  classification,
  dataItemCount,
  colors,
  onColorsChange,
  onSubmit,
  onDelete,
  onClose,
  onEditFilters,
  isSubmitting,
}) {
  const [fields, setFields] = useState(() => buildFieldsFromLayer(layer));

  useEffect(() => {
    setFields(buildFieldsFromLayer(layer));
  }, [layer?._id]);

  if (mode === "edit" && !layer) {
    return (
      <div className="layer-edit-panel" role="region" aria-label="Edit Layer Panel">
        <div className="layer-edit-panel-header">
          <h2>Edit Layer Panel</h2>
        </div>

        <p className="layer-edit-panel-empty-message">Select a layer to view its details.</p>
      </div>
    );
  }

  function updateField(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function updateColor(key, value) {
    onColorsChange({ ...colors, [key]: value });
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!fields.name.trim()) return;

    onSubmit({
      name: fields.name.trim(),
      description: fields.description.trim(),
      ...colors,
    });
  }

  const heading =
    mode === "add" ? `Add ${classification} Layer Panel` : "Edit Layer Panel";
  const submitLabel = mode === "add" ? `Add ${classification} Layer` : "Save Layer";

  return (
    <div className="layer-edit-panel" role="region" aria-label={heading}>
      <div className="layer-edit-panel-header">
        <h2>{heading}</h2>

        {mode === "edit" && layer && (
          <span
            className="layer-edit-panel-order-badge"
            title="Stacking order on the map - the Data Layer always sits below every saved layer, and a higher number stacks above a lower one. Assigned automatically for now; editing this comes later."
          >
            {/* 1-based for display only - see LayerInfoPanel's own comment. */}
            Order: {Number(layer.order) + 1}
          </span>
        )}

        {mode === "add" && (
          <button
            type="button"
            className="layer-edit-panel-close-button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      {mode === "add" && (
        <p className="layer-edit-panel-hint">
          {dataItemCount} item{dataItemCount === 1 ? "" : "s"} currently match your filters and
          will make up this layer.
          {classification === "Corridor" && " Points can't be part of a corridor, so any that match are skipped."}
        </p>
      )}

      <form className="layer-edit-panel-form" onSubmit={handleSubmit}>
        <div className="layer-edit-panel-field">
          <label htmlFor="layer-name">Name</label>
          <input
            id="layer-name"
            type="text"
            value={fields.name}
            maxLength={LAYER_NAME_MAX_LENGTH}
            onChange={(event) => updateField("name", event.target.value)}
            required
          />
        </div>

        <div className="layer-edit-panel-field">
          <label htmlFor="layer-description">Description</label>
          <textarea
            id="layer-description"
            value={fields.description}
            maxLength={LAYER_DESCRIPTION_MAX_LENGTH}
            onChange={(event) => updateField("description", event.target.value)}
            rows={3}
          />
        </div>

        <div className="layer-edit-panel-field">
          <span className="layer-edit-panel-field-label">Classification</span>
          <span className="layer-edit-panel-fixed-classification">{classification}</span>
        </div>

        <div className="layer-edit-panel-color-group">
          <div className="layer-edit-panel-color-row">
            <label htmlFor="layer-fill-color">Fill</label>
            <input
              id="layer-fill-color"
              type="color"
              value={colors.fillColor}
              onChange={(event) => updateColor("fillColor", event.target.value)}
            />

            <label htmlFor="layer-border-color">Border</label>
            <input
              id="layer-border-color"
              type="color"
              value={colors.borderColor}
              onChange={(event) => updateColor("borderColor", event.target.value)}
            />
          </div>
        </div>

        {/*
          * Editing a saved layer's filters or boundary reopens the
          * matching step of the Add workflow against this layer, rather
          * than trying to cram a filter UI or a boundary list into this
          * panel. Neither persists on its own - each writes back into
          * the layer being edited, and Save Layer below commits the lot.
          */}
        {mode === "edit" && (
          <div className="layer-edit-panel-branch-actions">
            <button
              type="button"
              className="layer-edit-panel-branch-button"
              onClick={onEditFilters}
              disabled={isSubmitting}
            >
              Edit Filters
            </button>

          </div>
        )}

        <div className="layer-edit-panel-actions">
          <button type="submit" className="layer-edit-panel-submit-button" disabled={isSubmitting}>
            {submitLabel}
          </button>

          {mode === "edit" && (
            <button
              type="button"
              className="layer-edit-panel-delete-button"
              onClick={onDelete}
              disabled={isSubmitting}
            >
              Delete Layer
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
