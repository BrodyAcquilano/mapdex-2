// src/aggregates/utils/computeAggregateResult.js

import { getLayerMatchingData } from "../../layers/utils/computeLayerMembers.js";

/*
 * An aggregate's own data membership is simply its `filterState`
 * re-filter, the same one a Layer uses (computeLayerMembers.js).
 *
 * The boundary used to be a separate spatial clip stacked before that
 * filter, back when an aggregate stored its boundary outside its
 * filterState. It now lives inside filterState.geometry like any other
 * filter, so there is one pass and one source of truth - which is why
 * this function is a thin pass-through and no longer orders two stages.
 *
 * `boundariesById` is threaded through rather than resolved here
 * because boundaries live in their own collection and are never part of
 * `data`; the geometry filter needs it to turn a stored boundaryId back
 * into a polygon. It re-runs against the current dataset on every read
 * rather than reading a frozen id list, so an aggregate never goes
 * stale.
 */
export function getAggregateMatchingData(
  aggregate,
  data,
  schema,
  filterTimeZone,
  boundariesById,
) {
  return getLayerMatchingData(aggregate, data, schema, filterTimeZone, boundariesById);
}

function getStoredInput(dataItem, sectionId, inputId) {
  return dataItem?.sectionById?.get(sectionId)?.inputById?.get(inputId);
}

function extractCheckboxValue(dataItem, sectionId, inputId) {
  return getStoredInput(dataItem, sectionId, inputId)?.value === true;
}

function extractDropdownValue(dataItem, sectionId, inputId) {
  const value = getStoredInput(dataItem, sectionId, inputId)?.value;
  return typeof value === "string" && value !== "" ? value : null;
}

function extractTagListValues(dataItem, sectionId, inputId) {
  const tags = getStoredInput(dataItem, sectionId, inputId)?.tags;
  return Array.isArray(tags) ? tags : [];
}

/*
 * A number input can be stored as a single value, a min/max range, or
 * just a min or max (see shared/validation/dataValidation.js's own
 * validateNumberLikeInput) - none of those map onto "one number" for
 * sum/average as unambiguously as a plain single value does. This
 * picks the most defensible single representative value per mode
 * (the range's own midpoint for Min-Max Range) rather than skipping
 * anything but Single Value outright - a v1 default, worth revisiting
 * if it turns out to read oddly for a real project's own data.
 */
function extractNumberValue(dataItem, sectionId, inputId) {
  const input = getStoredInput(dataItem, sectionId, inputId);
  if (!input) return null;

  const toNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  if (input.mode === "Single Value") return toNumber(input.singleValue);
  if (input.mode === "Min Only") return toNumber(input.min);
  if (input.mode === "Max Only") return toNumber(input.max);

  if (input.mode === "Min-Max Range") {
    const min = toNumber(input.min);
    const max = toNumber(input.max);
    return min != null && max != null ? (min + max) / 2 : null;
  }

  return null;
}

/*
 * Runs an aggregate's own saved `fields` (each a {sectionId, inputId,
 * type, operation}, picked in src/aggregates/AddAggregateFieldPicker/)
 * against the live matching dataset, grouped and ordered by the
 * project's own current schema sections/inputs - never by whatever
 * order `fields` happens to be stored in - so results always read in
 * the same order the schema itself presents those fields in, and a
 * field whose input was since removed from the schema is silently
 * skipped rather than shown as a dangling result.
 *
 * checkbox/dropdown/tagList are always a count - a dropdown or tagList
 * value with a zero count is left out entirely (Brody's own call: no
 * point listing 48 unused tag options alongside the 2 actually used),
 * which is also what makes this naturally pick up a brand new option/
 * tag automatically once *any* matching item starts using it, since
 * this whole function re-runs from scratch every time it's called
 * rather than reading a stored result.
 */
export function computeAggregateResult(
  aggregate,
  data,
  schema,
  filterTimeZone,
  boundariesById,
) {
  const matchingItems = getAggregateMatchingData(
    aggregate,
    data,
    schema,
    filterTimeZone,
    boundariesById,
  );
  const fields = Array.isArray(aggregate?.fields) ? aggregate.fields : [];
  const schemaSections = Array.isArray(schema?.sections) ? schema.sections : [];

  const fieldsBySectionId = new Map();
  for (const field of fields) {
    const key = String(field.sectionId);
    if (!fieldsBySectionId.has(key)) fieldsBySectionId.set(key, []);
    fieldsBySectionId.get(key).push(field);
  }

  const resultSections = [];

  for (const section of schemaSections) {
    const sectionFields = fieldsBySectionId.get(String(section.id));
    if (!sectionFields || sectionFields.length === 0) continue;

    const schemaInputs = Array.isArray(section.inputs) ? section.inputs : [];
    const fieldByInputId = new Map(sectionFields.map((field) => [String(field.inputId), field]));

    const orderedFields = schemaInputs
      .map((schemaInput) => {
        const field = fieldByInputId.get(String(schemaInput.id));
        return field ? { field, schemaInput } : null;
      })
      .filter(Boolean);

    const fieldResults = [];

    for (const { field, schemaInput } of orderedFields) {
      const label = schemaInput.label || String(field.inputId);

      /*
       * A secondary input inside a checkboxGate section is meaningless
       * on its own - four Parking secondaries are all labelled
       * "Accessible Parking", and only the gate they hang off tells
       * them apart. So the gate's label travels with the result for the
       * panel to show above it.
       *
       * Resolved here rather than stored on the field: this loop is
       * already walking the schema section by section, so the primary
       * is one lookup in an array that is already in hand. Storing it
       * would duplicate schema into every aggregate document for no
       * gain - the stored fields are deliberately the minimum needed
       * to rebuild the aggregate, not a copy of the schema.
       */
      const primaryLabel = schemaInput.secondaryFor
        ? schemaInputs.find((candidate) => candidate.inputKey === schemaInput.secondaryFor)
            ?.label || null
        : null;

      const base = {
        inputId: field.inputId,
        label,
        primaryLabel,
        type: field.type,
        operation: field.operation,
      };

      /*
       * Every field picked for the aggregate reports, including when it
       * reports nothing. A count of 0 is a real answer - "none of the 63
       * matching places have accessible parking" is exactly what someone
       * asking for that count wants to see, and dropping the row made it
       * indistinguishable from having forgotten to pick the field at
       * all. Brody's own call.
       */
      if (field.type === "checkbox") {
        const count = matchingItems.filter((item) =>
          extractCheckboxValue(item, field.sectionId, field.inputId),
        ).length;

        fieldResults.push({ ...base, result: count });
        continue;
      }

      if (field.type === "dropdown" || field.type === "tagList") {
        const counts = new Map();

        for (const item of matchingItems) {
          const values =
            field.type === "dropdown"
              ? [extractDropdownValue(item, field.sectionId, field.inputId)].filter(Boolean)
              : extractTagListValues(item, field.sectionId, field.inputId);

          for (const value of values) {
            counts.set(value, (counts.get(value) || 0) + 1);
          }
        }

        const options = Array.from(counts.entries())
          .filter(([, count]) => count > 0)
          .map(([option, count]) => ({ option, count }));

        /* An empty list is still a result - see the comment above. */
        fieldResults.push({ ...base, result: options });
        continue;
      }

      if (field.type === "number") {
        const values = matchingItems
          .map((item) => extractNumberValue(item, field.sectionId, field.inputId))
          .filter((value) => value != null);

        /*
         * Neither Sum nor Average has an answer when there are no
         * values. Both are arithmetic over numbers that exist, not
         * tallies of how many do - and a reported 0 would be
         * indistinguishable from values that genuinely add to zero.
         * So an empty set is null, and renders as a dash.
         *
         * Counting is the exception, and it is why checkbox and
         * dropdown/tagList above still report 0 and an empty list: you
         * really did count, and the answer really is none. Brody's own
         * call, correcting an earlier version that returned 0 for an
         * empty Sum.
         */
        const result =
          values.length > 0
            ? field.operation === "Average"
              ? values.reduce((total, value) => total + value, 0) / values.length
              : values.reduce((total, value) => total + value, 0)
            : null;

        fieldResults.push({ ...base, result });
      }
    }

    resultSections.push({
      sectionId: section.id,
      sectionName: section.name || "",
      fields: fieldResults,
    });
  }

  return { matchingCount: matchingItems.length, sections: resultSections };
}
