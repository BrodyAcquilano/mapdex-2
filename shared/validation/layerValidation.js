// shared/validation/layerValidation.js

import { exceedsMaxLength } from "./formValueHelpers.js";
import { LAYER_TOOL_LIMITS } from "./validationConstants.js";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  if (!isPlainObject(value)) return false;

  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isValidObjectIdString(value) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  return /^[a-f\d]{24}$/i.test(trimmed);
}

function isValidName(value) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  return !exceedsMaxLength(trimmed, LAYER_TOOL_LIMITS.nameMaxLength);
}

function isValidDescription(value) {
  if (value === null || value === "") return true;
  if (typeof value !== "string") return false;

  return !exceedsMaxLength(value, LAYER_TOOL_LIMITS.descriptionMaxLength);
}

function isValidClassification(value) {
  return LAYER_TOOL_LIMITS.classificationOptions.includes(value);
}



function isValidColor(value) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value);
}

function isValidOpacity(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1;
}

/*
 * A layer stores the *filter* that defines its membership, not a
 * frozen list of ids - re-applied against the live dataset every time
 * the layer is loaded (see src/layers/utils/computeLayerMembers.js),
 * so a new data item that happens to match keeps showing up in the
 * layer automatically, and the layer never goes stale. filterState's
 * own shape is entirely schema-dependent (it mirrors whatever fields
 * a given project defines - see src/filters/initializeFilters.js), so
 * this only checks it's a plain, reasonably-sized object rather than
 * deep-validating every possible per-field shape - the filter-matching
 * itself only ever runs client-side (src/filters/matchesFilters.js),
 * never trusted or re-interpreted by the server, so a malformed
 * filterState can only ever make a user's own layer match oddly for
 * them, never corrupt anyone else's data or bypass a permission check.
 */
function isValidFilterState(value) {
  if (!isPlainObject(value)) return false;

  try {
    return JSON.stringify(value).length <= LAYER_TOOL_LIMITS.maxFilterStateBytes;
  } catch {
    return false;
  }
}

/*
 * classification is set once at create time (by which Add tool built
 * the layer - Add Patch Layer vs. Add Corridor Layer) and never part
 * of the update payload at all - hasOnlyKeys below rejects a payload
 * that tries to include it, which is what actually enforces "immutable
 * after creation" server-side, not just the client's own UI hiding it.
 */
export function validateCreateLayerPayload(payload) {
  if (
    !hasOnlyKeys(payload, [
      "projectId",
      "name",
      "description",
      "classification",
      "fillColor",
      "borderColor",
      "filterState",
    ])
  ) {
    return false;
  }

  if (!isValidObjectIdString(payload.projectId)) return false;
  if (!isValidName(payload.name)) return false;
  if (!isValidDescription(payload.description)) return false;
  if (!isValidClassification(payload.classification)) return false;
  if (!isValidColor(payload.fillColor)) return false;
  if (!isValidColor(payload.borderColor)) return false;
  if (!isValidFilterState(payload.filterState)) return false;

  return true;
}

/*
 * Takes the whole layer document, not just its display metadata -
 * Brody's own call, so the Edit panel's own "Edit Filters" and "Edit
 * Boundary" branches can commit a changed filterState/boundary through
 * the same save the rest of the panel uses, rather than needing their
 * own routes. classification is the one field still excluded: it's set
 * by which Add tool built the layer and is immutable afterward, and
 * leaving it out of this list is what enforces that server-side.
 */
export function validateUpdateLayerPayload(payload) {
  if (
    !hasOnlyKeys(payload, [
      "projectId",
      "_id",
      "name",
      "description",
      "fillColor",
      "borderColor",
      "opacity",
      "visible",
      "order",
      "filterState",
    ])
  ) {
    return false;
  }

  if (!isValidObjectIdString(payload.projectId)) return false;
  if (!isValidObjectIdString(payload._id)) return false;
  if (!isValidName(payload.name)) return false;
  if (!isValidDescription(payload.description)) return false;
  if (!isValidColor(payload.fillColor)) return false;
  if (!isValidColor(payload.borderColor)) return false;
  if (!isValidOpacity(payload.opacity)) return false;
  if (typeof payload.visible !== "boolean") return false;
  if (!Number.isFinite(Number(payload.order))) return false;
  if (!isValidFilterState(payload.filterState)) return false;

  return true;
}
