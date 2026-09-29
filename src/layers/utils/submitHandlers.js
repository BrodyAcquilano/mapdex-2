// src/layers/utils/submitHandlers.js

/*
 * Layer CRUD, lifted out of the engine runtimes (PlacesRuntime.jsx /
 * EventRuntime.jsx) the same way src/forms/submitHandlers.js already
 * holds the data-item ones. Both runtimes had identical copies of these
 * inline; they now import these and only supply their own state setters,
 * which keeps the runtime files to state + wiring.
 *
 * Each takes a single options object (the forms convention) and returns
 * the saved document, so callers can branch on success without needing
 * to know how the API helper reports it.
 */

export async function loadLayers({ projectId, layersApi, setLayers, system }) {
  if (!projectId) return;

  const { data, message } = await layersApi.getAll(projectId);

  if (message) system?.notify?.(message);

  setLayers(Array.isArray(data) ? data : []);
}

export async function createLayer({ payload, layersApi, setLayers, system }) {
  const { data, message } = await layersApi.create(payload);

  system?.notify?.(message);

  if (data?._id) {
    setLayers((prev) => [...prev, data]);
  }

  return data;
}

export async function updateLayer({ payload, layersApi, setLayers, system }) {
  const { data, message } = await layersApi.update(payload);

  system?.notify?.(message);

  if (data?._id) {
    setLayers((prev) => prev.map((layer) => (layer._id === data._id ? data : layer)));
  }

  return data;
}

export async function deleteLayer({
  _id,
  projectId,
  layersApi,
  setLayers,
  setSelectedLayerId,
  system,
}) {
  const { data, message } = await layersApi.remove(_id, projectId);

  system?.notify?.(message);

  if (data?._id) {
    setLayers((prev) => prev.filter((layer) => layer._id !== data._id));
    setSelectedLayerId((prev) => (prev === data._id ? null : prev));
  }

  return data;
}
