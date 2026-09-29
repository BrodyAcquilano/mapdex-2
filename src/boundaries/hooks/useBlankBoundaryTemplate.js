// src/boundaries/hooks/useBlankBoundaryTemplate.js

import { useMemo } from "react";

import { blankBoundaryFromSchema } from "../utils/blankBoundaryFromSchema.js";
import { DEFAULT_BOUNDARY_COLORS } from "../utils/boundaryConstants.js";

/* See src/layers/hooks/useBlankLayerTemplate.js's own comment. */
export function useBlankBoundaryTemplate(schema) {
  return useMemo(() => {
    if (!schema) return null;

    return blankBoundaryFromSchema(schema, DEFAULT_BOUNDARY_COLORS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema?._id, schema?.configUpdatedAt]);
}
