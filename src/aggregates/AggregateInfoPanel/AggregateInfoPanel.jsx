// src/aggregates/AggregateInfoPanel/AggregateInfoPanel.jsx

import { useMemo } from "react";

import { computeAggregateResult } from "../utils/computeAggregateResult.js";
import { buildBoundariesById } from "../../../shared/boundaries/filterBoundaryGeometry.js";

import "./AggregateInfoPanel.css";

/*
 * Zero is a result and renders as one - see computeAggregateResult's
 * own comment. The only genuinely absent value is an Average with no
 * numbers to average, which shows a dash rather than a made-up 0.
 */
function formatFieldResult(field) {
  if (field.type === "checkbox") {
    return <span className="aggregate-info-panel-result-value">{field.result}</span>;
  }

  if (field.type === "number") {
    if (field.result == null) {
      return <span className="aggregate-info-panel-result-value">—</span>;
    }

    const rounded = Math.round(field.result * 100) / 100;

    return (
      <span className="aggregate-info-panel-result-value">
        {rounded}
        <span className="aggregate-info-panel-result-operation"> (operation: {field.operation})</span>
      </span>
    );
  }

  // dropdown / tagList - a list of {option|tag, count}
  const options = Array.isArray(field.result) ? field.result : [];

  if (options.length === 0) {
    return <span className="aggregate-info-panel-result-value">No matches</span>;
  }

  return (
    <ul className="aggregate-info-panel-option-list">
      {options.map((entry) => (
        <li key={entry.option || entry.tag}>
          {entry.option || entry.tag}: {entry.count}
        </li>
      ))}
    </ul>
  );
}

/*
 * Right-hand panel for the Aggregates page (src/workflows/
 * Aggregates.jsx) - always available regardless of role (unlike
 * AggregateEditPanel, which is admin/owner + Edit-tool-only), so a
 * viewer/editor can see what an aggregate actually found. Boundaries
 * have no info of their own to show here - selecting one just reads
 * as nothing selected, per Brody's own call, since a boundary is only
 * ever a shape other aggregates reuse, not something with its own
 * findings.
 *
 * The result is recomputed here, live, every time this renders -
 * never read from a stored value - using the exact same
 * computeAggregateResult the Add workflow's own preview and both
 * export routes use, so what a viewer sees here always matches what
 * exporting right now would produce.
 */
export default function AggregateInfoPanel({ entity, schema, data, filterTimeZone, boundaries }) {
  /*
   * Gated on the entity alone. This used to also require an
   * entityType prop to equal "aggregate", but the Aggregates page only
   * ever passed its list-tab value, which was the plural
   * "aggregates" - so the check never once passed and this panel
   * always rendered its empty state even with an aggregate selected.
   * Boundaries have their own page now and never reach this panel, so
   * the prop had nothing left to distinguish and is gone.
   */
  const isAggregate = !!entity;

  /*
   * An aggregate's boundary lives inside its own filterState now, so
   * the result is computed by handing the whole boundaries list through
   * as a lookup rather than resolving one shape here. This used to pass
   * a resolved geometry and read entity.boundaryId - a field that no
   * longer exists, so the clip silently stopped being applied.
   */
  const boundariesById = useMemo(() => buildBoundariesById(boundaries), [boundaries]);

  const result = useMemo(() => {
    if (!isAggregate) return null;

    return computeAggregateResult(entity, data, schema, filterTimeZone, boundariesById);
  }, [isAggregate, entity, data, schema, filterTimeZone, boundariesById]);

  if (!isAggregate) {
    return (
      <div className="aggregate-info-panel" role="region" aria-label="Aggregate Info Panel">
        <div className="aggregate-info-panel-header">
          <h2>Aggregate Info</h2>
        </div>

        <p className="aggregate-info-panel-empty-message">Select an aggregate to view its details.</p>
      </div>
    );
  }

  return (
    <div className="aggregate-info-panel" role="region" aria-label="Aggregate Info Panel">
      <div className="aggregate-info-panel-header">
        <h2>{entity.name}</h2>
      </div>

      {/*
        * Labelled rather than left as a bare paragraph, which read as
        * stray text under the title. "Description" matches what
        * AggregateEditPanel's own form calls the field, so the same
        * value is named the same way whether you're reading it or
        * editing it.
        */}
      {entity.description && (
        <div className="aggregate-info-panel-description-block">
          <span className="aggregate-info-panel-description-label">Description</span>
          <p className="aggregate-info-panel-description">{entity.description}</p>
        </div>
      )}

      <div className="aggregate-info-panel-swatch-row">
        <span
          className="aggregate-info-panel-swatch"
          style={{ backgroundColor: entity.fillColor, borderColor: entity.borderColor }}
        />
        <span>{result.matchingCount} item{result.matchingCount === 1 ? "" : "s"} matched</span>
      </div>

      {/*
        * A section now renders as soon as it has a field picked, even
        * if every one of them reports zero - so reaching here means no
        * fields were picked at all, which is the only thing left to
        * say.
        */}
      {result.sections.length === 0 && (
        <p className="aggregate-info-panel-empty-message">
          No fields selected to aggregate.
        </p>
      )}

      {result.sections.map((section) => (
        <div key={section.sectionId} className="aggregate-info-panel-section">
          <span className="aggregate-info-panel-section-label">{section.sectionName}</span>

          {section.fields.map((field) => {
            /*
             * A checkbox count and a number Sum/Average are each a
             * single value, so they read as "Label: 12" on one line.
             * Dropdowns and tag lists already put "option: count" on
             * each of their own rows, so their label stays above the
             * list it introduces.
             */
            const isSingleValue = field.type === "checkbox" || field.type === "number";

            return (
              <div
                key={field.inputId}
                className={`aggregate-info-panel-field ${isSingleValue ? "inline" : ""}`}
              >
                {/*
                  * A checkboxGate secondary is ambiguous on its own -
                  * four Parking secondaries all read "Accessible
                  * Parking" - so the gate it hangs off is named above
                  * it. Resolved in computeAggregateResult, where the
                  * schema is already being walked.
                  */}
                {field.primaryLabel && (
                  <span className="aggregate-info-panel-field-parent-label">
                    {field.primaryLabel}
                  </span>
                )}

                <span className="aggregate-info-panel-field-label">
                  {field.label}
                  {isSingleValue ? ":" : ""}
                </span>

                {formatFieldResult(field)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
