// src/aggregates/utils/submitHandlers.js

/*
 * Aggregate and boundary CRUD, lifted out of the engine runtimes
 * (PlacesRuntime.jsx / EventRuntime.jsx) the same way
 * src/forms/submitHandlers.js already holds the data-item ones, and
 * src/layers/utils/submitHandlers.js the layer ones. Both runtimes had
 * identical copies of these inline; they now import these and only
 * supply their own state setters.
 *
 * Boundary CRUD used to live here too, but moved to
 * src/boundaries/utils/submitHandlers.js once the Layers page started
 * using boundaries as well - a boundary belongs to neither feature.
 */

export async function loadAggregates({
  projectId,
  aggregatesApi,
  setAggregates,
  system,
}) {
  if (!projectId) return;

  const { data, message } = await aggregatesApi.getAll(projectId);

  if (message) system?.notify?.(message);

  setAggregates(Array.isArray(data) ? data : []);
}

export async function createAggregate({
  payload,
  aggregatesApi,
  setAggregates,
  system,
}) {
  const { data, message } = await aggregatesApi.create(payload);

  system?.notify?.(message);

  if (data?._id) {
    setAggregates((prev) => [...prev, data]);
  }

  return data;
}

export async function updateAggregate({
  payload,
  aggregatesApi,
  setAggregates,
  system,
}) {
  const { data, message } = await aggregatesApi.update(payload);

  system?.notify?.(message);

  if (data?._id) {
    setAggregates((prev) =>
      prev.map((aggregate) => (aggregate._id === data._id ? data : aggregate)),
    );
  }

  return data;
}

export async function deleteAggregate({
  _id,
  projectId,
  aggregatesApi,
  setAggregates,
  setSelectedAggregateEntityId,
  system,
}) {
  const { data, message } = await aggregatesApi.remove(_id, projectId);

  system?.notify?.(message);

  if (data?._id) {
    setAggregates((prev) => prev.filter((aggregate) => aggregate._id !== data._id));
    setSelectedAggregateEntityId((prev) => (prev === data._id ? null : prev));
  }

  return data;
}
