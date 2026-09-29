// src/boundaries/utils/submitHandlers.js

/*
 * Boundary CRUD. Lives here rather than in src/aggregates/ because
 * boundaries are shared between the Aggregates page and the Layers page
 * - both let you draw/import/move boundaries and clip their own results
 * to one, so nothing boundary-specific belongs to either feature.
 *
 * Same shape as src/forms/submitHandlers.js and the layer/aggregate
 * ones: a single options object in, the saved document out, with the
 * caller supplying its own state setters.
 */

export async function loadBoundaries({
  projectId,
  boundariesApi,
  setBoundaries,
  system,
}) {
  if (!projectId) return;

  const { data, message } = await boundariesApi.getAll(projectId);

  if (message) system?.notify?.(message);

  setBoundaries(Array.isArray(data) ? data : []);
}

export async function createBoundary({
  payload,
  boundariesApi,
  setBoundaries,
  system,
}) {
  const { data, message } = await boundariesApi.create(payload);

  system?.notify?.(message);

  if (data?._id) {
    setBoundaries((prev) => [...prev, data]);
  }

  return data;
}

export async function updateBoundary({
  payload,
  boundariesApi,
  setBoundaries,
  system,
}) {
  const { data, message } = await boundariesApi.update(payload);

  system?.notify?.(message);

  if (data?._id) {
    setBoundaries((prev) =>
      prev.map((boundary) => (boundary._id === data._id ? data : boundary)),
    );
  }

  return data;
}

export async function deleteBoundary({
  _id,
  projectId,
  boundariesApi,
  setBoundaries,
  setSelectedAggregateEntityId,
  system,
}) {
  const { data, message } = await boundariesApi.remove(_id, projectId);

  system?.notify?.(message);

  if (data?._id) {
    setBoundaries((prev) => prev.filter((boundary) => boundary._id !== data._id));
    setSelectedAggregateEntityId?.((prev) => (prev === data._id ? null : prev));
  }

  return data;
}
