// src/aggregates/AggregateFieldPicker/AggregateFieldPicker.jsx

import { AGGREGATE_FIELD_OPERATIONS } from "../utils/aggregateConstants.js";
import { isAggregatableInput } from "../../../shared/validation/aggregateValidation.js";

import "./AggregateFieldPicker.css";

const NO_OPERATION = "";

/*
 * Left-hand panel for phase 3 of the Add Aggregate workflow
 * (src/workflows/Aggregates.jsx) - renders the project's own schema
 * sections/inputs in order (same source of truth every other schema-
 * driven pipeline reads - src/filters/renderFiltersBySchema.jsx,
 * src/forms/renderAddEditFormPage.jsx, etc.), but only the inputs an
 * aggregate can actually run an operation over - see
 * isAggregatableInput, which covers both the allowed types and the
 * checkboxGate primary/secondary rule. Anything else is skipped
 * entirely, not just disabled, since there's nothing to pick an
 * operation for. A section whose every input is skipped renders
 * nothing at all, which is what keeps a gated section from appearing
 * just because its gate checkbox happens to be a checkbox.
 *
 * Picking "No operation" for a field removes it from
 * the aggregate's own saved `fields` array - only fields with a real
 * operation selected end up counted/summed/averaged.
 */
export default function AggregateFieldPicker({ schema, selectedFields, onChange }) {
  const sections = Array.isArray(schema?.sections) ? schema.sections : [];

  function getSelectedOperation(sectionId, inputId) {
    return (
      selectedFields.find(
        (field) => String(field.sectionId) === String(sectionId) && String(field.inputId) === String(inputId),
      )?.operation || NO_OPERATION
    );
  }

  function handleOperationChange(sectionId, inputId, type, operation) {
    const withoutThisField = selectedFields.filter(
      (field) => !(String(field.sectionId) === String(sectionId) && String(field.inputId) === String(inputId)),
    );

    if (operation === NO_OPERATION) {
      onChange(withoutThisField);
      return;
    }

    onChange([...withoutThisField, { sectionId, inputId, type, operation }]);
  }

  const hasAnyAggregatableInput = sections.some((section) =>
    (section.inputs || []).some((input) => isAggregatableInput(section, input)),
  );

  return (
    <div className="aggregate-field-picker" role="region" aria-label="Aggregate Field Picker">
      <div className="aggregate-field-picker-header">
        <h2>Fields to Aggregate</h2>
      </div>

      {!hasAnyAggregatableInput && (
        <p className="aggregate-field-picker-empty-message">
          This project's schema has no checkbox, dropdown, tag list, or number fields to
          aggregate.
        </p>
      )}

      {sections.map((section) => {
        const aggregatableInputs = (section.inputs || []).filter((input) =>
          isAggregatableInput(section, input),
        );

        if (aggregatableInputs.length === 0) return null;

        return (
          <div key={section.id} className="aggregate-field-picker-section">
            <span className="aggregate-field-picker-section-label">{section.name}</span>

            {aggregatableInputs.map((input) => {
              const operations = AGGREGATE_FIELD_OPERATIONS[input.type] || [];
              const selected = getSelectedOperation(section.id, input.id);

              /*
               * A checkboxGate secondary is ambiguous on its own - the
               * four Parking secondaries are all labelled "Accessible
               * Parking", and only the gate they hang off tells them
               * apart. The gate itself is not aggregatable, so it never
               * gets a row of its own; its label is shown above its
               * secondaries purely as context.
               *
               * Found in this section's own inputs, which are already in
               * hand - no second pass over the schema. A gate whose
               * secondaries are all skipped never appears, because
               * nothing under it renders.
               */
              const primaryLabel = input.secondaryFor
                ? (section.inputs || []).find(
                    (candidate) => candidate.inputKey === input.secondaryFor,
                  )?.label || null
                : null;

              return (
                <div key={input.id} className="aggregate-field-picker-row">
                  {primaryLabel && (
                    <span className="aggregate-field-picker-parent-label">
                      {primaryLabel}
                    </span>
                  )}

                  <label htmlFor={`aggregate-field-${input.id}`}>{input.label}</label>
                  <select
                    id={`aggregate-field-${input.id}`}
                    value={selected}
                    onChange={(event) =>
                      handleOperationChange(section.id, input.id, input.type, event.target.value)
                    }
                  >
                    <option value={NO_OPERATION}>No operation</option>
                    {operations.map((operation) => (
                      <option key={operation} value={operation}>
                        {operation}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
