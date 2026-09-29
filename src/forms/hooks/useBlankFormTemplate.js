// src/forms/hooks/useBlankFormTemplate.js

import { useMemo } from "react";

import { blankFormFromSchema } from "../blankFormFromSchema.js";

/*
 * One blank, fully-shaped form object built from the project's own
 * schema, rebuilt only when the project changes. Every engine runtime
 * held an identical copy of this useMemo inline.
 *
 * Deliberately schema-driven rather than engine-driven: blankFormFromSchema
 * already branches on schema.engineKey/geometry/time internally, so the
 * same hook serves every engine unchanged.
 */
export function useBlankFormTemplate(schema) {
  return useMemo(() => {
    if (!schema) return null;

    return blankFormFromSchema(schema);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema?._id, schema?.configUpdatedAt]);
}
