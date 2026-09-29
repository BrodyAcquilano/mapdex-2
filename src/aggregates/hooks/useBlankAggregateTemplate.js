// src/aggregates/hooks/useBlankAggregateTemplate.js

import { useMemo } from "react";

import { blankAggregateFromSchema } from "../utils/blankAggregateFromSchema.js";

/* See src/layers/hooks/useBlankLayerTemplate.js's own comment. */
export function useBlankAggregateTemplate(schema) {
  return useMemo(() => {
    if (!schema) return null;

    return blankAggregateFromSchema(schema);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema?._id, schema?.configUpdatedAt]);
}
