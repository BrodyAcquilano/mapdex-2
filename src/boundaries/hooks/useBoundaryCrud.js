// src/boundaries/hooks/useBoundaryCrud.js

import { useCallback } from "react";

import * as boundarySubmitHandlers from "../utils/submitHandlers.js";

/* See src/layers/hooks/useLayerCrud.js's own comment. */
export function useBoundaryCrud({
  boundariesApi,
  setBoundaries,
  setSelectedAggregateEntityId,
}) {
  const loadBoundaries = useCallback(
    async (projectId, system) => {
      await boundarySubmitHandlers.loadBoundaries({
        projectId,
        boundariesApi,
        setBoundaries,
        system,
      });
    },
    [boundariesApi, setBoundaries],
  );

  const createBoundary = useCallback(
    async (payload, system) => {
      return boundarySubmitHandlers.createBoundary({
        payload,
        boundariesApi,
        setBoundaries,
        system,
      });
    },
    [boundariesApi, setBoundaries],
  );

  const updateBoundary = useCallback(
    async (payload, system) => {
      return boundarySubmitHandlers.updateBoundary({
        payload,
        boundariesApi,
        setBoundaries,
        system,
      });
    },
    [boundariesApi, setBoundaries],
  );

  const deleteBoundary = useCallback(
    async (_id, projectId, system) => {
      return boundarySubmitHandlers.deleteBoundary({
        _id,
        projectId,
        boundariesApi,
        setBoundaries,
        setSelectedAggregateEntityId,
        system,
      });
    },
    [boundariesApi, setBoundaries, setSelectedAggregateEntityId],
  );

  return { loadBoundaries, createBoundary, updateBoundary, deleteBoundary };
}
