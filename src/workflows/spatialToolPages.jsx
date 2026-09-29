// src/workflows/spatialToolPages.jsx

import { Route } from "react-router-dom";

import Boundaries from "./Boundaries.jsx";
import Layers from "./Layers.jsx";
import Aggregates from "./Aggregates.jsx";
import Insights from "./Insights.jsx";

/*
 * The Boundaries, Layers and Aggregates pages, for every engine.
 *
 * These three are the only pages in Mapdex that are not engine-specific
 * at all - a boundary is a polygon, a layer is a saved filter over the
 * project own data items, and an aggregate is a set of operations over
 * those. Nothing in any of them asks what kind of data the project
 * holds, which is why their state now lives in GlobalRuntime rather
 * than in an engine runtime (see src/runtime/useSpatialToolsRuntime.js).
 *
 * The nav entries and the routes live here together rather than being
 * written out in each engine own PagesAdapter, because they were
 * already byte-identical between the places and events adapters and
 * adding the other three engines would have meant five copies of the
 * same 160 lines of prop passing.
 */

/*
 * Boundaries come before Layers and Aggregates in the nav because both
 * of those consume one: you draw or import the shape first, then build
 * a layer or an aggregate against it.
 *
 * Every role can open all three - a viewer/editor gets the saved list,
 * the visibility/opacity toggles and export. Each page own admin/owner
 * check (canManage) is what decides whether the toolbar, the Add tool
 * and the edit panel render at all.
 */
export const SPATIAL_TOOL_PAGES = [
  { key: "boundaries", path: "boundaries", label: "Boundaries" },
  { key: "layers", path: "layers", label: "Layers" },
  { key: "aggregates", path: "aggregates", label: "Aggregates" },
  /*
   * Insights comes last: it reports on everything above it, so it reads
   * as the summary at the end of the group rather than another tool.
   */
  { key: "insights", path: "insights", label: "Insights" },
];

/*
 * Returned as a fragment of <Route> elements, the same shape a
 * PagesAdapter itself returns, so an adapter renders it inline with
 * its own routes.
 */
export function renderSpatialToolRoutes({ runtime, system }) {
  return (
    <>
      <Route
        path="boundaries"
        element={
          <Boundaries
            schema={runtime.schema}
            boundaries={runtime.boundaries}
            boundaryViewState={runtime.boundaryViewState}
            setBoundaryViewState={runtime.setBoundaryViewState}
            selectedBoundaryId={runtime.selectedBoundaryId}
            setSelectedBoundaryId={runtime.setSelectedBoundaryId}
            boundaryTool={runtime.boundaryTool}
            setBoundaryTool={runtime.setBoundaryTool}
            isBoundaryAddPanelOpen={runtime.isBoundaryAddPanelOpen}
            setIsBoundaryAddPanelOpen={runtime.setIsBoundaryAddPanelOpen}
            showBoundaryAddPanel={runtime.showBoundaryAddPanel}
            setShowBoundaryAddPanel={runtime.setShowBoundaryAddPanel}
            isDrawingBoundary={runtime.isDrawingBoundary}
            setIsDrawingBoundary={runtime.setIsDrawingBoundary}
            boundaryDraftGeometry={runtime.boundaryDraftGeometry}
            setBoundaryDraftGeometry={runtime.setBoundaryDraftGeometry}
            setDraftBoundaryColors={runtime.setDraftBoundaryColors}
            createBoundary={runtime.createBoundary}
            updateBoundary={runtime.updateBoundary}
            deleteBoundary={runtime.deleteBoundary}
            finishDrawingBoundary={runtime.finishDrawingBoundary}
            finishBoundaryGeometryEdit={runtime.finishBoundaryGeometryEdit}
            setCurrentPage={runtime.setCurrentPage}
            apis={runtime.apis}
            exports={runtime.exports}
            system={system}
          />
        }
      />

      <Route
        path="layers"
        element={
          <Layers
            schema={runtime.schema}
            data={runtime.data}
            filteredData={runtime.filteredData}
            layers={runtime.layers}
            createLayer={runtime.createLayer}
            updateLayer={runtime.updateLayer}
            deleteLayer={runtime.deleteLayer}
            isAddLayerToolActive={runtime.isAddLayerToolActive}
            setIsAddLayerToolActive={runtime.setIsAddLayerToolActive}
            addLayerClassification={runtime.addLayerClassification}
            setAddLayerClassification={runtime.setAddLayerClassification}
            addLayerPhase={runtime.addLayerPhase}
            setAddLayerPhase={runtime.setAddLayerPhase}
            layerEditMode={runtime.layerEditMode}
            isLayerEditToolActive={runtime.isLayerEditToolActive}
            setIsLayerEditToolActive={runtime.setIsLayerEditToolActive}
            setLayerEditMode={runtime.setLayerEditMode}
            boundaries={runtime.boundaries}
            boundaryViewState={runtime.boundaryViewState}
            setBoundaryViewState={runtime.setBoundaryViewState}
            isAddLayerPanelOpen={runtime.isAddLayerPanelOpen}
            setIsAddLayerPanelOpen={runtime.setIsAddLayerPanelOpen}
            selectedLayerId={runtime.selectedLayerId}
            setSelectedLayerId={runtime.setSelectedLayerId}
            layerViewState={runtime.layerViewState}
            setLayerViewState={runtime.setLayerViewState}
            showDataLayer={runtime.showDataLayer}
            setShowDataLayer={runtime.setShowDataLayer}
            dataLayerOpacity={runtime.dataLayerOpacity}
            setDataLayerOpacity={runtime.setDataLayerOpacity}
            draftLayerColors={runtime.draftLayerColors}
            setDraftLayerColors={runtime.setDraftLayerColors}
            showFilter={runtime.showFilter}
            setShowFilter={runtime.setShowFilter}
            filterState={runtime.filterState}
            setFilterState={runtime.setFilterState}
            viewerTimeZone={runtime.viewerTimeZone}
            timeFilterOverride={runtime.timeFilterOverride}
            setTimeFilterOverride={runtime.setTimeFilterOverride}
            filterTimezoneMode={runtime.filterTimezoneMode}
            setFilterTimezoneMode={runtime.setFilterTimezoneMode}
            filterTimeZone={runtime.filterTimeZone}
            setFilterTimeZone={runtime.setFilterTimeZone}
            TIMEZONE_OPTIONS={runtime.TIMEZONE_OPTIONS}
            isSelectingFilterBoundary={runtime.isSelectingFilterBoundary}
            showFilterBoundaryPicker={runtime.showFilterBoundaryPicker}
            setShowFilterBoundaryPicker={runtime.setShowFilterBoundaryPicker}
            filterBoundaryDraft={runtime.filterBoundaryDraft}
            setFilterBoundaryDraft={runtime.setFilterBoundaryDraft}
            openFilterBoundarySelection={runtime.openFilterBoundarySelection}
            cancelFilterBoundarySelection={
              runtime.cancelFilterBoundarySelection
            }
            saveFilterBoundarySelection={runtime.saveFilterBoundarySelection}
            clearFilters={runtime.clearFilters}
            setCurrentPage={runtime.setCurrentPage}
            apis={runtime.apis}
            exports={runtime.exports}
            system={system}
          />
        }
      />

      <Route
        path="aggregates"
        element={
          <Aggregates
            schema={runtime.schema}
            data={runtime.data}
            filteredData={runtime.filteredData}
            aggregates={runtime.aggregates}
            boundaries={runtime.boundaries}
            boundaryViewState={runtime.boundaryViewState}
            setBoundaryViewState={runtime.setBoundaryViewState}
            aggregateViewState={runtime.aggregateViewState}
            setAggregateViewState={runtime.setAggregateViewState}
            selectedAggregateEntityId={runtime.selectedAggregateEntityId}
            setSelectedAggregateEntityId={runtime.setSelectedAggregateEntityId}
            aggregatesActiveTool={runtime.aggregatesActiveTool}
            setAggregatesActiveTool={runtime.setAggregatesActiveTool}
            addAggregatePhase={runtime.addAggregatePhase}
            setAddAggregatePhase={runtime.setAddAggregatePhase}
            addAggregateFields={runtime.addAggregateFields}
            aggregateEditMode={runtime.aggregateEditMode}
            setAggregateEditMode={runtime.setAggregateEditMode}
            setAddAggregateFields={runtime.setAddAggregateFields}
            draftAggregateColors={runtime.draftAggregateColors}
            setDraftAggregateColors={runtime.setDraftAggregateColors}
            createAggregate={runtime.createAggregate}
            updateAggregate={runtime.updateAggregate}
            deleteAggregate={runtime.deleteAggregate}
            showFilter={runtime.showFilter}
            setShowFilter={runtime.setShowFilter}
            filterState={runtime.filterState}
            setFilterState={runtime.setFilterState}
            viewerTimeZone={runtime.viewerTimeZone}
            timeFilterOverride={runtime.timeFilterOverride}
            setTimeFilterOverride={runtime.setTimeFilterOverride}
            filterTimezoneMode={runtime.filterTimezoneMode}
            setFilterTimezoneMode={runtime.setFilterTimezoneMode}
            filterTimeZone={runtime.filterTimeZone}
            setFilterTimeZone={runtime.setFilterTimeZone}
            TIMEZONE_OPTIONS={runtime.TIMEZONE_OPTIONS}
            isSelectingFilterBoundary={runtime.isSelectingFilterBoundary}
            showFilterBoundaryPicker={runtime.showFilterBoundaryPicker}
            setShowFilterBoundaryPicker={runtime.setShowFilterBoundaryPicker}
            filterBoundaryDraft={runtime.filterBoundaryDraft}
            setFilterBoundaryDraft={runtime.setFilterBoundaryDraft}
            openFilterBoundarySelection={runtime.openFilterBoundarySelection}
            cancelFilterBoundarySelection={
              runtime.cancelFilterBoundarySelection
            }
            saveFilterBoundarySelection={runtime.saveFilterBoundarySelection}
            clearFilters={runtime.clearFilters}
            setCurrentPage={runtime.setCurrentPage}
            apis={runtime.apis}
            exports={runtime.exports}
            system={system}
          />
        }
      />

      {/*
       * Read-only, and so far the only page here that needs nothing
       * but the derived insights object - no tools, no draft state,
       * no map.
       */}
      <Route
        path="insights"
        element={
          <Insights
            insights={runtime.insights}
            setCurrentPage={runtime.setCurrentPage}
          />
        }
      />
    </>
  );
}
