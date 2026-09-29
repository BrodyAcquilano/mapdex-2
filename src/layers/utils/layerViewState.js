// src/layers/utils/layerViewState.js

/*
 * layerViewState is the Layers page's own ephemeral, per-viewer
 * display overlay - never persisted - keyed by layer._id to
 * { visible, opacity }. It has to live in the shared engine runtime
 * (PlacesRuntime.jsx/EventRuntime.jsx) rather than as page-local state
 * in src/workflows/Layers.jsx, because src/engines/<engine>/
 * MapAdapter.jsx (a sibling of the routed page, not a child of it)
 * needs to read the exact same values to know what to actually draw.
 * This is the one place that combines a saved layer's own stored
 * fields with that overlay, so LayerListPanel/LayerEditPanel (via
 * Layers.jsx) and the map content (via MapAdapter.jsx) can never
 * compute two different answers for "is this layer visible right now".
 *
 * (This file used to also export filterDataByLayerMembership, for
 * deciding which of `data` to even consider - that responsibility
 * moved into src/map/leaflet/layers/LayersGeometryLayer.jsx and its
 * Mapbox counterpart directly, once layer membership became a live
 * re-filter rather than a stored id list - see
 * computeLayerMembers.js's own comment.)
 */
export function mergeLayersWithViewState(layers, layerViewState) {
  return (layers || []).map((layer) => {
    const viewState = layerViewState?.[layer._id];

    return {
      ...layer,
      visible: viewState ? viewState.visible : layer.visible !== false,
      opacity: viewState
        ? viewState.opacity
        : Number.isFinite(Number(layer.opacity))
          ? Number(layer.opacity)
          : 1,
    };
  });
}
