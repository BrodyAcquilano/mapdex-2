// src/forms/injectLayer.js

// ─────────────────────────────────────────────
// Layer Functions
// ─────────────────────────────────────────────
// Layer 1 = main project map
// Layer 2 = child/sub-map attached to a layer 1 parent

export function injectLayer(formData, layer = 1, parentDataItemId = null) {
  if (!formData || typeof formData !== "object") return;

  const normalizedLayer = Number(layer);

  if (normalizedLayer === 2) {
    formData.layer = 2;
    formData.parentDataItemId = parentDataItemId ?? null;
    return;
  }

  formData.layer = 1;
  formData.parentDataItemId = null;
}