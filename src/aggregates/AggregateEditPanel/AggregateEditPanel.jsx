// src/aggregates/AggregateEditPanel/AggregateEditPanel.jsx

import { useEffect, useState } from "react";

import {
  AGGREGATE_NAME_MAX_LENGTH,
  AGGREGATE_DESCRIPTION_MAX_LENGTH,
} from "../utils/aggregateConstants.js";

import "./AggregateEditPanel.css";

function buildAggregateFields(entity) {
  return {
    name: entity?.name || "",
    description: entity?.description || "",
  };
}

/*
 * Right-hand panel for the Aggregates page (src/workflows/
 * Aggregates.jsx) - aggregates only. Boundaries have their own form in
 * src/boundaries/BoundaryEditPanel, used directly by both pages; this
 * file used to carry an `entityType` switch and delegate to it, which
 * is gone now that every caller picks the right panel itself.
 *
 * Only ever rendered for an admin/owner, and only while the page's own
 * Edit tool is active - see Aggregates.jsx's own comment on why edit
 * access is gated by a toolbar tool rather than permission alone.
 * (Boundaries are the exception: their panel opens on permission alone,
 * because there is no read-only boundary view to switch away from.)
 *
 * An aggregate's fill/border colors are lifted to the parent
 * (`colors`/`onColorsChange`), the same way LayerEditPanel's are, so
 * the map can preview an in-progress color change before Save.
 */
export default function AggregateEditPanel({
  mode,
  entity,
  matchingCount,
  colors,
  onColorsChange,
  onSubmit,
  onDelete,
  onClose,
  onEditFilters,
  onEditFields,
  isSubmitting,
}) {
  const [fields, setFields] = useState(() => buildAggregateFields(entity));

  useEffect(() => {
    setFields(buildAggregateFields(entity));
  }, [entity?._id]);

  if (mode === "edit" && !entity) {
    return (
      <div className="aggregate-edit-panel" role="region" aria-label="Edit Panel">
        <div className="aggregate-edit-panel-header">
          <h2>Edit Panel</h2>
        </div>

        <p className="aggregate-edit-panel-empty-message">
          Select an aggregate to view its details.
        </p>
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

  const heading = mode === "add" ? "Add Aggregate Panel" : "Edit Aggregate Panel";
  const submitLabel = mode === "add" ? "Add Aggregate" : "Save";

  return (
    <div className="aggregate-edit-panel" role="region" aria-label={heading}>
      <div className="aggregate-edit-panel-header">
        <h2>{heading}</h2>

        {mode === "edit" && entity && (
          <span className="aggregate-edit-panel-order-badge" title="Stacking order on the map.">
            Order: {entity.order}
          </span>
        )}

        {mode === "add" && (
          <button
            type="button"
            className="aggregate-edit-panel-close-button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      <p className="aggregate-edit-panel-hint">
        {mode === "add" && (
          <>
            {matchingCount} item{matchingCount === 1 ? "" : "s"} currently match your filters.
          </>
        )}
      </p>

      <form className="aggregate-edit-panel-form" onSubmit={handleSubmit}>
        <div className="aggregate-edit-panel-field">
          <label htmlFor="aggregate-entity-name">Name</label>
          <input
            id="aggregate-entity-name"
            type="text"
            value={fields.name}
            maxLength={AGGREGATE_NAME_MAX_LENGTH}
            onChange={(event) => updateField("name", event.target.value)}
            required
          />
        </div>

        <div className="aggregate-edit-panel-field">
          <label htmlFor="aggregate-entity-description">Description</label>
          <textarea
            id="aggregate-entity-description"
            value={fields.description}
            maxLength={AGGREGATE_DESCRIPTION_MAX_LENGTH}
            onChange={(event) => updateField("description", event.target.value)}
            rows={3}
          />
        </div>

        <div className="aggregate-edit-panel-color-row">
          <label htmlFor="aggregate-fill-color">Fill</label>
          <input
            id="aggregate-fill-color"
            type="color"
            value={colors.fillColor}
            onChange={(event) => updateColor("fillColor", event.target.value)}
          />

          <label htmlFor="aggregate-border-color">Border</label>
          <input
            id="aggregate-border-color"
            type="color"
            value={colors.borderColor}
            onChange={(event) => updateColor("borderColor", event.target.value)}
          />
        </div>

        {/*
          * Same two branches the Layers page's own edit panel offers -
          * editing an aggregate's filters or re-pointing its boundary
          * reopens the matching step of the Add workflow against this
          * aggregate, rather than cramming a filter UI or boundary list
          * into this panel. Neither persists on its own; each writes
          * back into the aggregate being edited and Save commits.
          */}
        {mode === "edit" && (
          <div className="aggregate-edit-panel-branch-actions">
            <button
              type="button"
              className="aggregate-edit-panel-branch-button"
              onClick={onEditFilters}
              disabled={isSubmitting}
            >
              Edit Filters
            </button>

            {/*
              * Which fields the aggregate reports on, and the operation
              * run over each. Like Edit Filters this only changes the
              * in-progress form - Save is what persists it.
              */}
            <button
              type="button"
              className="aggregate-edit-panel-branch-button"
              onClick={onEditFields}
              disabled={isSubmitting}
            >
              Edit Fields
            </button>

          </div>
        )}

        <div className="aggregate-edit-panel-actions">
          <button
            type="submit"
            className="aggregate-edit-panel-submit-button"
            disabled={isSubmitting}
          >
            {submitLabel}
          </button>

          {mode === "edit" && (
            <button
              type="button"
              className="aggregate-edit-panel-delete-button"
              onClick={onDelete}
              disabled={isSubmitting}
            >
              Delete Aggregate
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
