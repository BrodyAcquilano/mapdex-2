// src/boundaries/BoundaryEditPanel/BoundaryEditPanel.jsx

import { useEffect, useState } from "react";

import { BOUNDARY_NAME_MAX_LENGTH, DEFAULT_BOUNDARY_COLORS } from "../utils/boundaryConstants.js";

import "./BoundaryEditPanel.css";

/*
 * Add/Edit form for a boundary - name plus its own display colors.
 * Shared by the Aggregates and Layers pages (AggregateEditPanel
 * delegates its own entityType="boundary" case straight here), since a
 * boundary belongs to neither feature.
 *
 * A boundary's geometry isn't editable through this panel - the
 * Boundaries toolbar's own Move Vertex/Move Boundary map tools do that.
 *
 * Colors are plain local form fields rather than being lifted to the
 * parent the way an aggregate's or layer's are: a boundary's color is
 * purely a map-display convenience (see boundaryConstants.js's own
 * comment), so there's no "preview it against the data" need. They do
 * still get a live map preview during the draw/import review phase,
 * via the optional onColorsPreview callback, which the page wires into
 * draftBoundaryColors for BoundaryToolLayer to paint with.
 */
function buildFields(boundary) {
  return {
    name: boundary?.name || "",
    fillColor: boundary?.fillColor || DEFAULT_BOUNDARY_COLORS.fillColor,
    borderColor: boundary?.borderColor || DEFAULT_BOUNDARY_COLORS.borderColor,
  };
}

export default function BoundaryEditPanel({
  mode,
  boundary,
  onColorsPreview,
  onSubmit,
  onDelete,
  onClose,
  isSubmitting,
}) {
  const [fields, setFields] = useState(() => buildFields(boundary));

  useEffect(() => {
    setFields(buildFields(boundary));
  }, [boundary?._id]);

  if (mode === "edit" && !boundary) {
    return (
      <div className="boundary-edit-panel" role="region" aria-label="Edit Boundary Panel">
        <div className="boundary-edit-panel-header">
          <h2>Edit Boundary</h2>
        </div>

        <p className="boundary-edit-panel-empty-message">
          Select a boundary to view its details.
        </p>
      </div>
    );
  }

  function updateField(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function updateColorField(key, value) {
    const next = { ...fields, [key]: value };

    setFields(next);
    onColorsPreview?.({ fillColor: next.fillColor, borderColor: next.borderColor });
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!fields.name.trim()) return;

    onSubmit({
      name: fields.name.trim(),
      fillColor: fields.fillColor,
      borderColor: fields.borderColor,
    });
  }

  const heading = mode === "add" ? "Add Boundary" : "Edit Boundary";

  return (
    <div className="boundary-edit-panel" role="region" aria-label={`${heading} Panel`}>
      <div className="boundary-edit-panel-header">
        <h2>{heading}</h2>

        {mode === "add" && onClose && (
          <button
            type="button"
            className="boundary-edit-panel-close-button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      <form className="boundary-edit-panel-form" onSubmit={handleSubmit}>
        <div className="boundary-edit-panel-field">
          <label htmlFor="boundary-name">Name</label>
          <input
            id="boundary-name"
            type="text"
            value={fields.name}
            maxLength={BOUNDARY_NAME_MAX_LENGTH}
            onChange={(event) => updateField("name", event.target.value)}
            required
          />
        </div>

        <div className="boundary-edit-panel-color-row">
          <label htmlFor="boundary-fill-color">Fill</label>
          <input
            id="boundary-fill-color"
            type="color"
            value={fields.fillColor}
            onChange={(event) => updateColorField("fillColor", event.target.value)}
          />

          <label htmlFor="boundary-border-color">Border</label>
          <input
            id="boundary-border-color"
            type="color"
            value={fields.borderColor}
            onChange={(event) => updateColorField("borderColor", event.target.value)}
          />
        </div>

        <div className="boundary-edit-panel-actions">
          <button
            type="submit"
            className="boundary-edit-panel-submit-button"
            disabled={isSubmitting}
          >
            {mode === "add" ? "Add Boundary" : "Save"}
          </button>

          {mode === "edit" && onDelete && (
            <button
              type="button"
              className="boundary-edit-panel-delete-button"
              onClick={onDelete}
              disabled={isSubmitting}
            >
              Delete Boundary
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
