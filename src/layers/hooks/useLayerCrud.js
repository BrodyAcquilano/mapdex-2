// src/layers/hooks/useLayerCrud.js

import { useCallback } from "react";

import * as layerSubmitHandlers from "../utils/submitHandlers.js";

/*
 * Binds this engine's own state setters to the layer CRUD in
 * src/layers/utils/submitHandlers.js. The handlers themselves are plain
 * functions (no React), so this thin hook is only here to hold the
 * useCallback wrappers - both engine runtimes held identical copies of
 * them inline.
 */
export function useLayerCrud({ layersApi, setLayers, setSelectedLayerId }) {
  const loadLayers = useCallback(
    async (projectId, system) => {
      await layerSubmitHandlers.loadLayers({ projectId, layersApi, setLayers, system });
    },
    [layersApi, setLayers],
  );

  const createLayer = useCallback(
    async (payload, system) => {
      return layerSubmitHandlers.createLayer({ payload, layersApi, setLayers, system });
    },
    [layersApi, setLayers],
  );

  const updateLayer = useCallback(
    async (payload, system) => {
      return layerSubmitHandlers.updateLayer({ payload, layersApi, setLayers, system });
    },
    [layersApi, setLayers],
  );

  const deleteLayer = useCallback(
    async (_id, projectId, system) => {
      return layerSubmitHandlers.deleteLayer({
        _id,
        projectId,
        layersApi,
        setLayers,
        setSelectedLayerId,
        system,
      });
    },
    [layersApi, setLayers, setSelectedLayerId],
  );

  return { loadLayers, createLayer, updateLayer, deleteLayer };
}
