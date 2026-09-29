// src/layers/utils/populateBlankLayer.js

import { LAYER_TOOL_LIMITS } from "../../../shared/validation/validationConstants.js";

/*
 * The layer counterpart to src/forms/populateBlankForm.js - copies a
 * saved layer's own values onto a fresh clone of blankLayerTemplate, so
 * the result always carries every key the template defines even when
 * the saved document predates one of them.
 *
 * That matters for layers specifically: any layer saved before the
 * patch/corridor redesign has the old per-geometry-type color fields
 * (pointFillColor/lineColor/polygonFillColor/...) and no
 * classification/fillColor/borderColor at all. Reading those straight
 * off the document would put `undefined` into an edit payload that
 * validateUpdateLayerPayload then rejects; falling back to the
 * template's own defaults here keeps such a layer editable, and saving
 * it once migrates it onto the current shape.
 */
export function populateBlankLayer({ blankLayerTemplate, layer }) {
  if (!blankLayerTemplate) return { layerData: null };
  if (!layer) return { layerData: structuredClone(blankLayerTemplate) };

  const populated = structuredClone(blankLayerTemplate);

  populated._id = layer._id ?? null;
  populated.projectId = layer.projectId ?? populated.projectId;
  populated.name = layer.name || "";
  populated.description = layer.description || "";

  populated.classification = layer.classification ?? null;

  populated.fillColor = layer.fillColor || populated.fillColor;
  populated.borderColor = layer.borderColor || populated.borderColor;

  populated.boundaryId = layer.boundaryId ?? null;

  /*
   * A layer saved before boundaries reached this page has no
   * boundaryFilterType, and submitting undefined would fail
   * validateUpdateLayerPayload - the template's default stands in, and
   * saving once migrates the document onto the current shape.
   */
  populated.boundaryFilterType =
    LAYER_TOOL_LIMITS.boundaryFilterTypeOptions.includes(layer.boundaryFilterType)
      ? layer.boundaryFilterType
      : LAYER_TOOL_LIMITS.defaultBoundaryFilterType;

  populated.filterState =
    layer.filterState && typeof layer.filterState === "object"
      ? structuredClone(layer.filterState)
      : {};

  populated.opacity = Number.isFinite(Number(layer.opacity))
    ? Number(layer.opacity)
    : populated.opacity;

  populated.visible = layer.visible !== false;
  populated.order = layer.order ?? null;

  populated.createdAt = layer.createdAt ?? null;
  populated.updatedAt = layer.updatedAt ?? null;

  return { layerData: populated };
}
