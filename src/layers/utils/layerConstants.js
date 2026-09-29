// src/layers/utils/layerConstants.js

import { LAYER_TOOL_LIMITS } from "../../../shared/validation/validationConstants.js";

export const LAYER_NAME_MAX_LENGTH = LAYER_TOOL_LIMITS.nameMaxLength;
export const LAYER_DESCRIPTION_MAX_LENGTH = LAYER_TOOL_LIMITS.descriptionMaxLength;
export const DEFAULT_LAYER_COLORS = LAYER_TOOL_LIMITS.defaultColors;
export const LAYER_BOUNDARY_FILTER_TYPE_OPTIONS = LAYER_TOOL_LIMITS.boundaryFilterTypeOptions;
export const DEFAULT_LAYER_BOUNDARY_FILTER_TYPE = LAYER_TOOL_LIMITS.defaultBoundaryFilterType;

/*
 * One fillColor/borderColor pair per layer, applied uniformly across
 * whatever geometry types the layer's own data items happen to be -
 * borderColor doubles as the line color for LineString/MultiLineString
 * (see LayersGeometryLayer.jsx's own comment). This is the exact set
 * src/workflows/Layers.jsx picks off a selected layer to seed the Edit
 * panel's live draft, and the set LayerEditPanel.jsx itself edits and
 * submits - classification is deliberately not included here, since
 * it's set once by which Add tool built the layer and never editable
 * afterward.
 */
export const LAYER_EDITABLE_COLOR_FIELDS = ["fillColor", "borderColor"];
