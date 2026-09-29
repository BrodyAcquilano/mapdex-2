// src/layers/hooks/useBlankLayerTemplate.js

import { useMemo } from "react";

import { blankLayerFromSchema } from "../utils/blankLayerFromSchema.js";

/*
 * One blank, fully-shaped layer object per project, rebuilt only when
 * the project itself changes - the layer counterpart to
 * src/forms/hooks/useBlankFormTemplate.js.
 *
 * Imported by each engine runtime that supports the Layers tool rather
 * than living in GlobalRuntime, because not every engine has layers yet.
 */
export function useBlankLayerTemplate(schema) {
  return useMemo(() => {
    if (!schema) return null;

    return blankLayerFromSchema(schema);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema?._id, schema?.configUpdatedAt]);
}
