// src/map/hooks/useLayerContext.js

import { useState, useCallback } from "react";

/*
 * Which data layer the map is currently scoped to - the layer-1 /
 * layer-2 parent-child data-item concept (src/forms/injectLayer.js),
 * NOT the Layers tool (src/layers/). Easy to confuse: they share the
 * word "layer" and nothing else.
 *
 * Filed under src/map/hooks because what it actually controls is which
 * data items the map draws - each engine's own MapAdapter reads
 * activeLayer/activeParentDataItemId in getLayerScopedData to decide
 * what to render. It feeds no form or draft, which is what keeps it on
 * the map side of Brody's own classification rule.
 */
export function useLayerContext() {
  const [activeLayer, setActiveLayer] = useState(1);
  const [activeParentDataItemId, setActiveParentDataItemId] = useState(null);

  const resetLayerContext = useCallback(() => {
    setActiveLayer(1);
    setActiveParentDataItemId(null);
  }, []);

  return {
    activeLayer,
    setActiveLayer,
    activeParentDataItemId,
    setActiveParentDataItemId,
    resetLayerContext,
  };
}
