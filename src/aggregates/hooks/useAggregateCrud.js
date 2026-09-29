// src/aggregates/hooks/useAggregateCrud.js

import { useCallback } from "react";

import * as aggregateSubmitHandlers from "../utils/submitHandlers.js";

/* See src/layers/hooks/useLayerCrud.js's own comment. */
export function useAggregateCrud({
  aggregatesApi,
  setAggregates,
  setSelectedAggregateEntityId,
}) {
  const loadAggregates = useCallback(
    async (projectId, system) => {
      await aggregateSubmitHandlers.loadAggregates({
        projectId,
        aggregatesApi,
        setAggregates,
        system,
      });
    },
    [aggregatesApi, setAggregates],
  );

  const createAggregate = useCallback(
    async (payload, system) => {
      return aggregateSubmitHandlers.createAggregate({
        payload,
        aggregatesApi,
        setAggregates,
        system,
      });
    },
    [aggregatesApi, setAggregates],
  );

  const updateAggregate = useCallback(
    async (payload, system) => {
      return aggregateSubmitHandlers.updateAggregate({
        payload,
        aggregatesApi,
        setAggregates,
        system,
      });
    },
    [aggregatesApi, setAggregates],
  );

  const deleteAggregate = useCallback(
    async (_id, projectId, system) => {
      return aggregateSubmitHandlers.deleteAggregate({
        _id,
        projectId,
        aggregatesApi,
        setAggregates,
        setSelectedAggregateEntityId,
        system,
      });
    },
    [aggregatesApi, setAggregates, setSelectedAggregateEntityId],
  );

  return { loadAggregates, createAggregate, updateAggregate, deleteAggregate };
}
