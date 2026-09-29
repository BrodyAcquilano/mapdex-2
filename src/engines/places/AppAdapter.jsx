import FilterToggle from "../../filters/FilterToggle";
import FilterPanel from "../../filters/FilterPanel";
import TrackLocationButton from "../../workspace/TrackLocationButton/TrackLocationButton.jsx";
import FilterBoundarySelection from "../../boundaries/FilterBoundarySelection/FilterBoundarySelection.jsx";
import LayerButton from "../../workspace/LayerButton/LayerButton.jsx";
import MiniGallery from "../../extensions/MiniGallery";

export function AppAdapter({ runtime, system }) {
  if (
    runtime.currentPage === "projects" ||
    runtime.currentPage === "account" ||
    runtime.currentPage === "community" ||
    runtime.currentPage === "profile" ||
    runtime.currentPage === "schema"
  ) {
    return null;
  }

  /*
   * The Boundaries, Layers and Aggregates pages own their left/right
   * panels entirely - unlike Viewer/Editor, none of their list views
   * or tool views share FilterPanel/TrackLocationButton/
   * LayerButton/MiniGallery with anything else, so there is nothing for
   * this shared chrome to contribute here.
   */
  if (
    runtime.currentPage === "boundaries" ||
    runtime.currentPage === "layers" ||
    runtime.currentPage === "aggregates" ||
    runtime.currentPage === "insights"
  ) {
    return null;
  }

  return (
    <>
      {/* Main Components */}

      {/* Modifier */}
      {!runtime.isSelectingFilterBoundary && (
        <FilterToggle
          showFilter={runtime.showFilter}
          setShowFilter={runtime.setShowFilter}
        />
      )}

      {/* Filter Panel Wrapper */}
      <div
        className={`left-overlay-panel left-panel-wrapper ${
          runtime.showFilter && !runtime.isSelectingFilterBoundary ? "" : "left-collapsed"
        }`}
        aria-hidden={!runtime.showFilter || runtime.isSelectingFilterBoundary}
      >
        <FilterPanel
          schema={runtime.schema}
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
          clearFilters={runtime.clearFilters}
          filteredData={runtime.filteredData}
          boundaries={runtime.boundaries}
          onSelectBoundary={runtime.openFilterBoundarySelection}
          system={system}
          exports={runtime.exports}
        />
      </div>

      {/*
        * The geometry filter's own "pick a boundary" step. It takes the
        * filter panel's place rather than stacking beside it - only one
        * thing should be asking for input at a time - and the map swaps
        * the project's data for its boundaries while it's open (see
        * each engine's MapAdapter.jsx). The filter panel above is hidden
        * rather than unmounted, so nothing about its state changes while
        * you're away from it.
        */}
      <FilterBoundarySelection
        isSelectingFilterBoundary={runtime.isSelectingFilterBoundary}
        showFilterBoundaryPicker={runtime.showFilterBoundaryPicker}
        setShowFilterBoundaryPicker={runtime.setShowFilterBoundaryPicker}
        filterBoundaryDraft={runtime.filterBoundaryDraft}
        setFilterBoundaryDraft={runtime.setFilterBoundaryDraft}
        onCancel={runtime.cancelFilterBoundarySelection}
        onSave={runtime.saveFilterBoundarySelection}
        boundaries={runtime.boundaries}      />

      <TrackLocationButton
        trackLocation={runtime.trackLocation}
        hasBottomUI={runtime.hasBottomUI}
        handleTrackLocationToggle={runtime.handleTrackLocationToggle}
        isMobile={runtime.isMobile}
        system={system}
      />

        <LayerButton
          activeLayer={runtime.activeLayer}
          activeParentDataItemId={runtime.activeParentDataItemId}
          selectedDataItem={runtime.selectedDataItem}
          filteredData={runtime.filteredData}
          setActiveLayer={runtime.setActiveLayer}
          setActiveParentDataItemId={runtime.setActiveParentDataItemId}
          setSelectedDataItem={runtime.setSelectedDataItem}
          setIsMiniGalleryOpen={runtime.setIsMiniGalleryOpen}
          system={system}
          isMobile={runtime.isMobile}
          hasBottomUI={runtime.hasBottomUI}
        />

      {/* MiniGallery Conditional Block */}
      {!runtime.isMobile &&
        !runtime.activeExtensionModal &&
        !runtime.isSettingsModalOpen &&
        runtime.selectedDataItem && (
          <MiniGallery
            isMiniGalleryOpen={runtime.isMiniGalleryOpen}
            setIsMiniGalleryOpen={runtime.setIsMiniGalleryOpen}
            selectedDataItem={runtime.selectedDataItem}
            schema={runtime.schema}
            onOpenExtension={runtime.onOpenExtension}
            currentPage={runtime.currentPage}
            system={system}
            apis={runtime.apis}
            dataUtils={runtime.dataUtils}
          />
        )}
    </>
  );
}

export default AppAdapter;
