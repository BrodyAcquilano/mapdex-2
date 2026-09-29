// src/runtime/useSpatialToolsRuntime.js

import { useState, useMemo } from "react";

import { layersApi } from "../api/layersApi.js";
import { aggregatesApi } from "../api/aggregatesApi.js";
import { boundariesApi } from "../api/boundariesApi.js";

import { useLayerCrud } from "../layers/hooks/useLayerCrud.js";
import { useBlankLayerTemplate } from "../layers/hooks/useBlankLayerTemplate.js";
import { blankLayerFromSchema } from "../layers/utils/blankLayerFromSchema.js";
import { populateBlankLayer } from "../layers/utils/populateBlankLayer.js";

import { useAggregateCrud } from "../aggregates/hooks/useAggregateCrud.js";
import { useBlankAggregateTemplate } from "../aggregates/hooks/useBlankAggregateTemplate.js";
import { blankAggregateFromSchema } from "../aggregates/utils/blankAggregateFromSchema.js";
import { populateBlankAggregate } from "../aggregates/utils/populateBlankAggregate.js";

import { useBoundaryCrud } from "../boundaries/hooks/useBoundaryCrud.js";
import { useBoundaryGeometryTools } from "../boundaries/hooks/useBoundaryGeometryTools.js";
import { useBlankBoundaryTemplate } from "../boundaries/hooks/useBlankBoundaryTemplate.js";
import {
  blankBoundaryFromSchema,
  populateBlankBoundary,
} from "../boundaries/utils/blankBoundaryFromSchema.js";

/*
 * Boundaries, Layers and Aggregates - the three spatial tools, for every
 * engine.
 *
 * All of this used to exist twice, once in PlacesRuntime and again in
 * EventRuntime, because those were the only two engines with the pages.
 * Every engine has them now, so per-engine copies would have meant five.
 * It lives here instead and GlobalRuntime spreads it - the same move the
 * runtime has already made for everything that turned out not to be
 * engine-specific.
 *
 * Nothing in here is engine-aware. A boundary is a polygon, a layer is a
 * saved filter over whatever the project's data items are, and an
 * aggregate is a set of operations over those. Only the collection the
 * data items come from differs, and the server already knows that from
 * the project.
 */
export function useSpatialToolsRuntime({
  schema,
  /*
   * The boundaries list itself lives in GlobalRuntime - the geometry
   * filter needs it to resolve a stored boundaryId, and that filter is
   * shared by every page. Only the setter is needed here, so CRUD and
   * the move tools write back to that one list.
   */
  setBoundaries,
}) {
  // ─────────────────────────────────────────────
  // Layers Tool State
  // ─────────────────────────────────────────────
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [isAddLayerToolActive, setIsAddLayerToolActive] = useState(false);
  /*
   * Which of the two Add tools (LayersToolMenu.jsx's own "add-patch"/
   * "add-corridor" buttons) is active - "Patch"/"Corridor"/null. Set
   * alongside isAddLayerToolActive by Layers.jsx's own handleSelectTool,
   * and read by both that page (to build the create payload's immutable
   * classification, and to exclude Point/MultiPoint from the live
   * "N items match" count while adding a corridor) and this engine's own
   * MapAdapter.jsx (to build the draft layer object the map previews,
   * so a corridor's own point exclusion already applies before Add
   * Layer is ever clicked).
   */
  const [addLayerClassification, setAddLayerClassification] = useState(null);
  const [isAddLayerPanelOpen, setIsAddLayerPanelOpen] = useState(false);
  /*
   * The boundary a layer is being built against, and how it clips.
   * Both live here rather than in Layers.jsx because MapAdapter.jsx - a
   * sibling of that page, not a child - needs them to clip the live
   * draft preview from the moment a boundary is picked, the same reason
   * draftLayerColors is lifted. boundaryId null means "the whole
   * dataset", which is what a layer with no boundary uses.
   */
  /*
   * Which step of the Add Layer workflow is on screen, mirroring the
   * Add Aggregate one: null while not adding, otherwise 1 (pick a
   * boundary + clip mode) -> 2 (filter the data) -> 3 (name/color it).
   * Lives here rather than in Layers.jsx because MapAdapter.jsx renders
   * a different preview per step - boundaries to choose between at 1,
   * the clipped/filtered data at 2, the draft layer at 3.
   */
  const [addLayerPhase, setAddLayerPhase] = useState(null);
  /*
   * Which of the Edit panel's own sub-branches is open for a selected
   * layer: null (ordinary metadata editing), "filters" (the filter
   * panel reopened so the layer's own filterState can be changed), or
   * "boundary" (the boundary picker reopened so it can be re-pointed).
   * In runtime because MapAdapter.jsx renders a different preview for
   * each, exactly as it does for the Add workflow's own steps.
   */
  const [layerEditMode, setLayerEditMode] = useState(null);
  /*
   * Whether the Layers page's Edit tool is selected. In runtime rather
   * than page-local because MapAdapter.jsx renders the in-progress
   * edit as a draft layer for as long as it is - the map has to show
   * what the layer *will* be, not what it currently is saved as.
   */
  const [isLayerEditToolActive, setIsLayerEditToolActive] = useState(false);
  /*
   * Which boundary is selected on the Boundaries page. Shared runtime
   * state rather than page-local because MapAdapter.jsx - a sibling of
   * the routed page, not a child - seeds the Move Vertex/Move Boundary
   * draft from it, and because the Layers and Aggregates pages read the
   * boundary list too (to clip a layer / shape an aggregate).
   */
  const [selectedBoundaryId, setSelectedBoundaryId] = useState(null);
  const [layerViewState, setLayerViewState] = useState({});
  const [showDataLayer, setShowDataLayer] = useState(true);
  const [dataLayerOpacity, setDataLayerOpacity] = useState(1);
  /*
   * The Add/Edit Layer panel's own 5 color fields, lifted here (rather
   * than kept local to LayerEditPanel.jsx) so MapAdapter.jsx - a
   * sibling of the routed Layers.jsx page, not a child of it - can
   * preview them live on the map as they're changed, before Save/Add
   * Layer is ever clicked. null whenever neither panel is actively
   * editing colors.
   */
  const [draftLayerColors, setDraftLayerColors] = useState(null);

  // ─────────────────────────────────────────────
  // Aggregates Tool State
  // ─────────────────────────────────────────────
  const [aggregates, setAggregates] = useState([]);
  const [aggregateViewState, setAggregateViewState] = useState({});
  const [selectedAggregateEntityId, setSelectedAggregateEntityId] =
    useState(null);
  const [aggregatesActiveTool, setAggregatesActiveTool] = useState(null);
  /*
   * null while not in the Add Aggregate workflow, otherwise 1 (pick a
   * boundary) -> 2 (filter the data) -> 3 (pick fields/operations) ->
   * 4 (name/description/colors) - see src/workflows/Aggregates.jsx.
   */
  const [addAggregatePhase, setAddAggregatePhase] = useState(null);
  /*
   * How the picked boundary clips the data (AGGREGATE_BOUNDARY_FILTER_TYPE_
   * OPTIONS - "Centroid Inside"/"Fully Inside"/"Any Overlap"). Lives
   * here rather than local to Aggregates.jsx because MapAdapter.jsx - a
   * sibling of that page, not a child - needs it to clip the live map
   * preview from the moment a boundary is picked, the same reason
   * draftAggregateColors is lifted.
   */
  const [addAggregateFields, setAddAggregateFields] = useState([]);
  /*
   * Which of the Aggregate Edit panel's own sub-branches is open:
   * null, "filters" or "boundary" - the aggregate counterpart to
   * layerEditMode. In runtime because MapAdapter.jsx renders a
   * different preview for each.
   */
  const [aggregateEditMode, setAggregateEditMode] = useState(null);
  /*
   * Lifted here for the same reason draftLayerColors is (see its own
   * comment) - MapAdapter.jsx, a sibling of Aggregates.jsx not a
   * child, needs it too for the live color preview.
   */
  const [draftAggregateColors, setDraftAggregateColors] = useState(null);

  /*
   * Which Boundaries-page tool is selected, and whether its Add
   * Boundary panel is open/expanded. One set of state for one page -
   * boundaries used to be a *tab* on both the Layers and Aggregates
   * pages, which meant two parallel copies of all of this
   * (layersBoundaryTool vs a boundary key smuggled into
   * aggregatesActiveTool, plus a local isBoundaryAddPanelOpen on each
   * page) that drifted until drawing worked on one page and was
   * completely broken on the other. Brody's call was to give
   * boundaries their own route instead: one tool state, one draft, one
   * draft layer on the map, and no tab-switching state at all.
   *
   * The tool value is one of draftGeometry.js's own keys
   * ("multipolygon"/"move"/"moveGeometry") or "importBoundary", so the
   * same DrawController/BoundaryToolLayer machinery the places/events
   * editor already uses for those keys works here unchanged.
   */
  const [boundaryTool, setBoundaryTool] = useState(null);
  const [isBoundaryAddPanelOpen, setIsBoundaryAddPanelOpen] = useState(false);
  const [showBoundaryAddPanel, setShowBoundaryAddPanel] = useState(true);

  /*
   * isDrawingBoundary/boundaryDraftGeometry mirror isDrawing/
   * draftGeometry above, kept as their own separate state rather than
   * reusing those, so a boundary's in-progress draft can never collide
   * with an actual place/event item's.
   */
  const [isDrawingBoundary, setIsDrawingBoundary] = useState(false);
  const [boundaryDraftGeometry, setBoundaryDraftGeometry] = useState(null);

  /*
   * Kept entirely separate from boundaryDraftGeometry's own borderColor/
   * fillColor - a boundary's stored geometry (and therefore its own
   * draft) never carries color fields at all (see aggregateValidation.js's
   * own isValidBoundaryGeometry, which rejects any extra keys), so
   * merging a live color edit straight into the draft geometry object
   * the way an early version of this did corrupted it enough to fail
   * that exact-keys check at save time. This is BoundaryToolLayer.jsx's
   * (both map renderers) own separate source for the draft/edit
   * preview's fill/border paint, and Aggregates.jsx's own
   * handleBoundaryColorsPreview writes here instead.
   */
  const [draftBoundaryColors, setDraftBoundaryColors] = useState(null);

  const { loadLayers, createLayer, updateLayer, deleteLayer } = useLayerCrud({
    layersApi,
    setLayers,
    setSelectedLayerId,
  });

  const { loadAggregates, createAggregate, updateAggregate, deleteAggregate } =
    useAggregateCrud({
      aggregatesApi,
      setAggregates,
      setSelectedAggregateEntityId,
    });

  const { loadBoundaries, createBoundary, updateBoundary, deleteBoundary } =
    useBoundaryCrud({
      boundariesApi,
      setBoundaries,
      setSelectedAggregateEntityId,
    });

  /*
   * The Draw/Move Boundary tools' own finish handlers - see
   * src/boundaries/hooks/useBoundaryGeometryTools.js.
   */
  const {
    completeBoundaryGeometry,
    drawBoundaryDraft,
    finishDrawingBoundary,
    finishBoundaryGeometryEdit,
  } = useBoundaryGeometryTools({
    schema,
    boundaryDraftGeometry,
    setBoundaryDraftGeometry,
    setIsDrawingBoundary,
    setBoundaries,
    boundariesApi,
  });

  const blankLayerTemplate = useBlankLayerTemplate(schema);
  const blankAggregateTemplate = useBlankAggregateTemplate(schema);
  const blankBoundaryTemplate = useBlankBoundaryTemplate(schema);

  const layerUtils = useMemo(
    () => ({ blankLayerFromSchema, populateBlankLayer }),
    [],
  );

  const aggregateUtils = useMemo(
    () => ({ blankAggregateFromSchema, populateBlankAggregate }),
    [],
  );

  const boundaryUtils = useMemo(
    () => ({ blankBoundaryFromSchema, populateBlankBoundary }),
    [],
  );

  return {
    selectedBoundaryId,
    setSelectedBoundaryId,
    boundaryTool,
    setBoundaryTool,
    isBoundaryAddPanelOpen,
    setIsBoundaryAddPanelOpen,
    showBoundaryAddPanel,
    setShowBoundaryAddPanel,
    isDrawingBoundary,
    setIsDrawingBoundary,
    boundaryDraftGeometry,
    setBoundaryDraftGeometry,
    draftBoundaryColors,
    setDraftBoundaryColors,
    loadBoundaries,
    createBoundary,
    updateBoundary,
    deleteBoundary,
    completeBoundaryGeometry,
    drawBoundaryDraft,
    finishDrawingBoundary,
    finishBoundaryGeometryEdit,
    blankBoundaryTemplate,
    boundaryUtils,

    layers,
    setLayers,
    selectedLayerId,
    setSelectedLayerId,
    isAddLayerToolActive,
    setIsAddLayerToolActive,
    addLayerClassification,
    setAddLayerClassification,
    isAddLayerPanelOpen,
    setIsAddLayerPanelOpen,
    addLayerPhase,
    setAddLayerPhase,
    layerEditMode,
    setLayerEditMode,
    isLayerEditToolActive,
    setIsLayerEditToolActive,
    layerViewState,
    setLayerViewState,
    showDataLayer,
    setShowDataLayer,
    dataLayerOpacity,
    setDataLayerOpacity,
    draftLayerColors,
    setDraftLayerColors,
    loadLayers,
    createLayer,
    updateLayer,
    deleteLayer,
    blankLayerTemplate,
    layerUtils,

    aggregates,
    setAggregates,
    aggregateViewState,
    setAggregateViewState,
    selectedAggregateEntityId,
    setSelectedAggregateEntityId,
    aggregatesActiveTool,
    setAggregatesActiveTool,
    addAggregatePhase,
    setAddAggregatePhase,
    addAggregateFields,
    setAddAggregateFields,
    aggregateEditMode,
    setAggregateEditMode,
    draftAggregateColors,
    setDraftAggregateColors,
    loadAggregates,
    createAggregate,
    updateAggregate,
    deleteAggregate,
    blankAggregateTemplate,
    aggregateUtils,
  };
}
