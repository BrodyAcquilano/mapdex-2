// src/map/mapbox/content/SpatialToolsMapContent.jsx

import { useMemo } from "react";

import MapboxAggregatesMapContent from "./AggregatesMapContent.jsx";
import MapboxBoundaryToolMapContent from "./BoundaryToolMapContent.jsx";
import MapboxLayersMapContent from "./LayersMapContent.jsx";

import { mergeLayersWithViewState } from "../../../layers/utils/layerViewState.js";
import { DEFAULT_LAYER_COLORS } from "../../../layers/utils/layerConstants.js";
import { DEFAULT_AGGREGATE_COLORS } from "../../../aggregates/utils/aggregateConstants.js";
import { DEFAULT_BOUNDARY_DISPLAY_COLORS } from "../../../boundaries/utils/boundaryConstants.js";
import {
  resolveFilterBoundaryShape,
  buildBoundariesById,
} from "../../../../shared/boundaries/filterBoundaryGeometry.js";

/*
 * What the map draws on the Boundaries, Layers and Aggregates pages -
 * for every engine.
 *
 * These four hooks and the branch below were written for places, copied
 * verbatim into events, and are engine-agnostic throughout: each one
 * reads runtime.currentPage and the spatial state that now lives in
 * GlobalRuntime, and none of them ever asks what kind of data items the
 * project holds. Adding the other three engines would have meant five
 * copies, so an engine own MapAdapter calls useSpatialToolsMapContent
 * instead and renders whatever comes back, falling through to its own
 * content when it returns null.
 *
 * Returning null is the contract throughout: "not this page concern".
 */

/*
 * The Boundaries page's own resting view: every visible boundary drawn
 * in its own saved colors, and NO data items at all. A boundary is the
 * only thing that page is about, so the project's places/events would
 * just be noise behind the shape you're drawing or moving - Brody's own
 * call. Returning a boundaryItems payload here is what suppresses the
 * ordinary GeometryMapContent fall-through at the bottom of
 * MapboxMapContent.
 *
 * Only the resting view: once a draw/move/import tool is active,
 * useBoundaryToolMapData below takes precedence and renders the live
 * draft instead.
 */
function useBoundariesPageMapData(runtime) {
  return useMemo(() => {
    if (runtime.currentPage !== "boundaries") return null;

    return {
      boundaryItems: (runtime.boundaries || [])
        .filter(
          (boundary) =>
            runtime.boundaryViewState?.[boundary._id]?.visible !== false,
        )
        .map((boundary) => {
          /*
           * The selected boundary is painted in its DRAFT colors, not
           * its stored ones, so the Edit panel's color pickers preview
           * live - the same thing draftLayerColors does for a layer
           * being edited. Every other boundary stays in its own saved
           * colors, since only one is ever being edited.
           */
          const isEditing =
            String(boundary._id) === String(runtime.selectedBoundaryId) &&
            !!runtime.draftBoundaryColors;

          const colors = isEditing ? runtime.draftBoundaryColors : boundary;

          return {
            _id: boundary._id,
            geometry: boundary.geometry,
            opacity: Number.isFinite(
              Number(runtime.boundaryViewState?.[boundary._id]?.opacity),
            )
              ? Number(runtime.boundaryViewState[boundary._id].opacity)
              : 1,
            fillColor:
              colors.fillColor || DEFAULT_BOUNDARY_DISPLAY_COLORS.fillColor,
            borderColor:
              colors.borderColor || DEFAULT_BOUNDARY_DISPLAY_COLORS.borderColor,
          };
        }),
    };
  }, [
    runtime.currentPage,
    runtime.boundaries,
    runtime.selectedBoundaryId,
    runtime.draftBoundaryColors,
    runtime.boundaryViewState,
  ]);
}

/*
 * Whether the Boundaries page's own draw/edit tools (Draw Boundary/
 * Move Vertex/Move Boundary) are active. boundaryTool holds one of
 * draftGeometry.js's own tool keys directly ("multipolygon"/"move"/
 * "moveGeometry") rather than a boundary-specific name, so the exact
 * same DrawController/BoundaryToolLayer machinery the places/events
 * editor already uses for those keys works here unchanged.
 *
 * One page, one piece of state: this used to read whichever of two
 * per-page tool states applied (layersBoundaryTool on the Layers page,
 * aggregatesActiveTool on the Aggregates page), which is how the events
 * engine ended up supporting only one of the two and the Layers page
 * ended up with no boundary layer at all there.
 */
function useBoundaryToolMapData(runtime) {
  return useMemo(() => {
    if (runtime.currentPage !== "boundaries") return null;

    const isDrawOrEditTool =
      runtime.boundaryTool === "multipolygon" ||
      runtime.boundaryTool === "move" ||
      runtime.boundaryTool === "moveGeometry";

    /*
     * Import Boundary has no click-to-draw session of its own (the
     * geometry comes from a parsed file, not the map) - it only ever
     * shows a live, non-interactive preview once a file has actually
     * been parsed (boundaryDraftGeometry set) and its own Add Boundary
     * panel is open for naming/coloring it, mirroring the Draw
     * Boundary workflow's own "reviewing before save" phase.
     */
    const isImportPreview =
      runtime.boundaryTool === "importBoundary" &&
      !!runtime.boundaryDraftGeometry;

    if (!isDrawOrEditTool && !isImportPreview) return null;

    return {
      geometryTool: runtime.boundaryTool,
      isDrawing:
        runtime.boundaryTool === "multipolygon"
          ? runtime.isDrawingBoundary
          : false,
      draftGeometry: runtime.boundaryDraftGeometry,
      setDraftGeometry: runtime.setBoundaryDraftGeometry,
      draftColors: runtime.draftBoundaryColors,
    };
  }, [
    runtime.currentPage,
    runtime.boundaryTool,
    runtime.isDrawingBoundary,
    runtime.boundaryDraftGeometry,
    runtime.setBoundaryDraftGeometry,
    runtime.draftBoundaryColors,
  ]);
}

/*
 * Decides what (if anything) the Aggregates page's own map should
 * render, returning null to fall through to the ordinary
 * GeometryMapContent (never used interactively by that page itself,
 * but this keeps the same "null means not this page's concern"
 * contract useLayersMapData uses). Exactly one of {boundaries,
 * aggregates, the live-filtered Data Layer preview} is ever on the map
 * at once - see src/workflows/Aggregates.jsx's own top comment for why.
 *
 * Boundaries have no color of their own (DEFAULT_BOUNDARY_DISPLAY_COLORS
 * is purely a "so it's visible at all" fallback) - only an aggregate's
 * own fillColor/borderColor are real, user-chosen colors. An
 * aggregate's own displayed geometry is always its boundary's current
 * geometry (a live reference, not a snapshot - editing a boundary
 * changes every aggregate built on it), looked up fresh here rather
 * than duplicated onto the aggregate's own document.
 */
function useAggregatesMapData(runtime) {
  return useMemo(() => {
    if (runtime.currentPage !== "aggregates") return null;

    /*
     * The boundary picker always renders over the plain geometry layer
     * showing every data item, on every page - returning null here is
     * what falls through to it. Without this the Edit Filters branch
     * would keep drawing its own draft layer, which is filtered by the
     * very boundary being replaced.
     */
    if (runtime.isSelectingFilterBoundary) return null;
    /* See useLayersMapData's matching comment. */
    if (runtime.aggregateEditMode === "filters") return null;

    const isAdding = runtime.aggregatesActiveTool === "addAggregate";

    /*
     * From the fields step onward the aggregate itself is what's being
     * built, so the map shows it as the shape it will actually be - its
     * boundary polygon in its own colors - rather than the data behind
     * it. The filter step before this is where the data preview lives.
     *
     * There is always a polygon to draw: an unconstrained filter
     * resolves to the world itself (resolveFilterBoundaryShape), so this
     * never has to handle a shapeless draft. The draft stays on screen
     * until Add Aggregate is submitted, at which point it becomes a real
     * aggregate in the stack below.
     */
    if (isAdding && runtime.addAggregatePhase >= 2) {
      return {
        items: [
          {
            _id: "__aggregate_draft__",
            geometry: resolveFilterBoundaryShape(
              runtime.filterState?.geometry,
              buildBoundariesById(runtime.boundaries),
            ),
            opacity: 1,
            ...(runtime.draftAggregateColors || DEFAULT_AGGREGATE_COLORS),
          },
        ],
      };
    }

    /*
     * Phase 1 is the filter step - the same story as the Layers page:
     * show the project's own data narrowing down in its normal colors
     * rather than a draft, which is what returning null falls through
     * to. It also has to stop here explicitly, or an in-progress add
     * would drop through to the saved-aggregate stack below.
     */
    if (isAdding) return null;

    /*
     * The aggregate being edited renders from the LIVE edit session,
     * not from its saved document - both halves of it.
     *
     * Colors already worked this way. filterState did not, so changing
     * the boundary through the filter panel and coming back left the
     * polygon sitting on the old shape until the aggregate was saved.
     * An aggregate's shape IS its filterState boundary, so the same
     * rule has to cover it - and because resolveFilterBoundaryShape
     * below reads whatever it is handed, this works for a bounding box
     * and a selected boundary alike with no extra branching.
     *
     * Colors are spread separately because they can legitimately be
     * null (no color edit in progress) while the filters still need
     * overriding.
     */
    const isEditingAggregate = runtime.aggregatesActiveTool === "edit";

    const mergedAggregates = mergeLayersWithViewState(
      runtime.aggregates,
      runtime.aggregateViewState,
    ).map((aggregate) => {
      const isEdited =
        isEditingAggregate &&
        aggregate._id === runtime.selectedAggregateEntityId;

      if (!isEdited) return aggregate;

      return {
        ...aggregate,
        filterState: runtime.filterState || aggregate.filterState,
        ...(runtime.draftAggregateColors || {}),
      };
    });

    const boundaryById = buildBoundariesById(runtime.boundaries);

    return {
      items: mergedAggregates
        .filter((aggregate) => aggregate.visible !== false)
        .map((aggregate) => {
          /*
           * The shape an aggregate draws as is whatever its own
           * geometry filter resolves to - a picked boundary, or the
           * rectangle a bounding box describes. Both come from its
           * filterState now, the only place its boundary is stored.
           *
           * null is expected and fine: an aggregate constrained to
           * nothing still lists, selects and reports its result, it
           * just has no shape to draw (and its opacity slider has
           * nothing to act on).
           */
          const geometry = resolveFilterBoundaryShape(
            aggregate?.filterState?.geometry,
            boundaryById,
          );
          if (!geometry) return null;

          return {
            _id: aggregate._id,
            geometry,
            fillColor: aggregate.fillColor,
            borderColor: aggregate.borderColor,
            opacity: aggregate.opacity,
          };
        })
        .filter(Boolean),
    };
  }, [
    runtime.currentPage,
    runtime.isSelectingFilterBoundary,
    runtime.aggregateEditMode,
    runtime.aggregatesActiveTool,
    runtime.addAggregatePhase,
    runtime.filterState,
    runtime.boundaries,
    runtime.boundaryViewState,
    runtime.aggregates,
    runtime.aggregateViewState,
    runtime.selectedAggregateEntityId,
    runtime.draftAggregateColors,
  ]);
}

/*
 * Decides what (if anything) the Layers page's own non-interactive
 * LayersMapContent should render, returning null whenever the page
 * should fall through to the ordinary interactive GeometryMapContent
 * instead (every non-Layers page, and the Layers page's own Add tool
 * while just browsing/filtering with its panel not open yet). `data`
 * is always the full runtime.data - which of it actually belongs to a
 * layer is now decided live inside LayersGeometryLayer itself (each
 * layer's own stored filterState re-applied against current data, see
 * computeLayerMembers.js), not pre-filtered here.
 *
 * Two live-preview cases beyond the ordinary saved-layer stack:
 *  - Add tool, panel open: renders ONLY a synthetic one-off "draft"
 *    layer using the *current* filterState (whatever's live in the
 *    FilterPanel right now) plus runtime.draftLayerColors, so picking
 *    a color repaints the filtered data with it immediately - before
 *    Add Layer is ever clicked. See src/layers/LayerEditPanel/
 *    LayerEditPanel.jsx's own comment for why draftLayerColors lives
 *    in runtime instead of that panel's local state. Every other
 *    saved layer, and the Data Layer toggle's own fallback rendering,
 *    are both suppressed here regardless of their own on/off state -
 *    per Brody's own call, drafting a new layer is its own isolated
 *    preview, not a layer added on top of the normal stacked view.
 *    They resume together once Add Layer is actually saved (or the
 *    panel is closed without saving) and this branch stops applying.
 *  - Default view, a layer selected for edit: overrides that one
 *    saved layer's own colors with draftLayerColors so the stack
 *    previews an in-progress edit too, before Save Layer is clicked -
 *    every other layer and the Data Layer toggle render normally here,
 *    since editing a layer that's already part of the stack isn't the
 *    same isolated situation drafting a brand new one is.
 */
function useLayersMapData(runtime) {
  return useMemo(() => {
    if (runtime.currentPage !== "layers") return null;

    /*
     * The boundary picker always renders over the plain geometry layer
     * showing every data item, on every page - returning null here is
     * what falls through to it. Without this the Edit Filters branch
     * would keep drawing its own draft layer, which is filtered by the
     * very boundary being replaced.
     */
    if (runtime.isSelectingFilterBoundary) return null;
    /*
     * Editing a layer's filters puts the filter panel on screen, and
     * whenever that panel is what you are working in the map shows the
     * data being filtered - the same rule the Add workflow's own filter
     * step follows. Drawing the layer draft here instead meant watching
     * a shape that already had those filters applied, which tells you
     * nothing about the change you are making.
     */
    if (runtime.layerEditMode === "filters") return null;

    /*
     * The Edit tool renders the layer *as it will be*, not as it is
     * saved - one draft layer built from the live edit session
     * (filterState, boundary, clip mode, colors), with everything else
     * hidden. It has to apply for the whole session, not just inside
     * the Edit Filters branch: coming back to the Edit panel used to
     * fall through to the saved-layer stack, so a filter or boundary
     * change appeared to revert the moment the branch was left.
     */
    const isEditingSelectedLayer =
      runtime.isLayerEditToolActive && !!runtime.selectedLayerId;

    /*
     * The Add workflow's FIRST step is the filter panel now, and that
     * step is about watching the project's own data narrow down - so it
     * renders the ordinary geometry layer in its normal colors, which is
     * what returning null here falls through to. The draft layer only
     * appears from the naming step onward, once the filters are settled
     * and the layer's own color is a real choice rather than a default.
     */
    if (runtime.isAddLayerToolActive && Number(runtime.addLayerPhase) < 2) {
      return null;
    }

    if (runtime.isAddLayerToolActive || isEditingSelectedLayer) {
      /*
       * Every other step, plus the "Edit Filters" branch - one synthetic
       * draft layer carrying the live filterState and the chosen
       * boundary, so the map tracks the filter panel and the clip
       * together. It carries boundaryId like any real layer, so
       * LayersGeometryLayer resolves its geometry the same way. The
       * filter step has no colors picked yet, so it falls back to the
       * layer defaults rather than rendering nothing.
       */
      return {
        layers: [
          {
            _id: "__draft__",
            visible: true,
            opacity: 1,
            filterState: runtime.filterState,
            classification: runtime.addLayerClassification,
            ...(runtime.draftLayerColors || DEFAULT_LAYER_COLORS),
          },
        ],
        data: runtime.data,
        showDataLayer: false,
        dataLayerOpacity: 1,
      };
    }

    const mergedLayers = mergeLayersWithViewState(
      runtime.layers,
      runtime.layerViewState,
    ).map((layer) =>
      layer._id === runtime.selectedLayerId && runtime.draftLayerColors
        ? { ...layer, ...runtime.draftLayerColors }
        : layer,
    );

    return {
      layers: mergedLayers,
      data: runtime.data,
      showDataLayer: runtime.showDataLayer,
      dataLayerOpacity: runtime.dataLayerOpacity,
    };
  }, [
    runtime.currentPage,
    runtime.isSelectingFilterBoundary,
    runtime.isAddLayerToolActive,
    runtime.addLayerClassification,
    runtime.addLayerPhase,
    runtime.layerEditMode,
    runtime.isLayerEditToolActive,
    runtime.isAddLayerPanelOpen,
    runtime.draftLayerColors,
    runtime.filterState,
    runtime.layers,
    runtime.layerViewState,
    runtime.selectedLayerId,
    runtime.data,
    runtime.showDataLayer,
    runtime.dataLayerOpacity,
  ]);
}

/*
 * The one entry point. Every hook below runs on every render - only
 * which result is used changes - so this is safe to call unconditionally
 * at the top of an engine own MapboxMapContent, which is exactly how it
 * must be called.
 *
 * Order matters. A live draw/move draft outranks the Boundaries page
 * resting view, and each page own content outranks the engine ordinary
 * data rendering.
 */
export function useSpatialToolsMapContent(runtime, system) {
  const boundaryToolMapData = useBoundaryToolMapData(runtime);
  const boundariesPageMapData = useBoundariesPageMapData(runtime);
  const layersMapData = useLayersMapData(runtime);
  const aggregatesMapData = useAggregatesMapData(runtime);

  if (boundaryToolMapData) {
    return (
      <MapboxBoundaryToolMapContent
        geometryTool={boundaryToolMapData.geometryTool}
        isDrawing={boundaryToolMapData.isDrawing}
        draftGeometry={boundaryToolMapData.draftGeometry}
        setDraftGeometry={boundaryToolMapData.setDraftGeometry}
        draftColors={boundaryToolMapData.draftColors}
        system={system}
      />
    );
  }

  /*
   * The Boundaries page resting view reuses the Aggregates page own
   * boundary renderer rather than another copy - it is the same "draw
   * these boundaries, non-interactively" job.
   */
  if (boundariesPageMapData) {
    return (
      <MapboxAggregatesMapContent items={boundariesPageMapData.boundaryItems} />
    );
  }

  if (layersMapData) {
    return (
      <MapboxLayersMapContent
        layers={layersMapData.layers}
        data={layersMapData.data}
        schema={runtime.schema}
        filterTimeZone={runtime.filterTimeZone}
        showDataLayer={layersMapData.showDataLayer}
        dataLayerOpacity={layersMapData.dataLayerOpacity}
        boundaries={runtime.boundaries}
      />
    );
  }

  if (aggregatesMapData) {
    return <MapboxAggregatesMapContent items={aggregatesMapData.items} />;
  }

  return null;
}
