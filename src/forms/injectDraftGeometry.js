// src/forms/injectDraftGeometry.js

export function injectDraftGeometry(
  formData,
  draftGeometry,
) {
  if (
    !formData ||
    !draftGeometry?.type ||
    !draftGeometry?.coordinates
  ) {
    return formData;
  }

  formData.geometry =
    structuredClone(draftGeometry);

  return formData;
}