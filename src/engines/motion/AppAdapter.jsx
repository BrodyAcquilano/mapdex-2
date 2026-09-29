// src/engines/motion/AppAdapter.jsx
import { useEffect } from "react";

import FilterToggle from "../../filters/FilterToggle";
import FilterPanel from "../../filters/FilterPanel";
import TrackLocationButton from "../../workspace/TrackLocationButton/TrackLocationButton.jsx";
import MiniGallery from "../../extensions/MiniGallery";
import TimeWindowFilter from "../../filters/TimeWindowFilter";
import FilterBoundarySelection from "../../boundaries/FilterBoundarySelection/FilterBoundarySelection.jsx";

function hasEditorAccess(role) {
  return role === "owner" || role === "admin" || role === "editor";
}

export function AppAdapter({ runtime, system }) {
  const { setVoiceLayout, resetVoiceLayout } = system;

  const canEdit = hasEditorAccess(runtime.schema?.userRole);

  const hasTimeWindowFilter =
    runtime.schema?.time?.isFilter === true &&
    !runtime.timeFilterOverride &&
    !runtime.trackLocation;

  useEffect(() => {
    if (
      runtime.currentPage === "projects" ||
      runtime.currentPage === "account" ||
      runtime.currentPage === "community" ||
      runtime.currentPage === "profile" ||
      runtime.currentPage === "schema"
    ) {
      resetVoiceLayout();
      return;
    }

    setVoiceLayout({
      hasBottomUI: hasTimeWindowFilter,
    });

    return () => {
      resetVoiceLayout();
    };
  }, [
    setVoiceLayout,
    resetVoiceLayout,
    runtime.currentPage,
    hasTimeWindowFilter,
  ]);

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
   * or tool views share this shell chrome with anything else, so there
   * is nothing for it to contribute here.
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
      {/* Filter Controls */}
      {!runtime.trackLocation && (
        <>
          {runtime.schema?.time?.isFilter && (
            <TimeWindowFilter
              schema={runtime.schema}
              data={runtime.data}
              selectedDataItem={runtime.selectedDataItem}
              setSelectedDataItem={runtime.setSelectedDataItem}
              viewerTimeZone={runtime.viewerTimeZone}
              timeFilterOverride={runtime.timeFilterOverride}
              filterState={runtime.filterState}
              setFilterState={runtime.setFilterState}
              filterTimeZone={runtime.filterTimeZone}
              setFilterTimeZone={runtime.setFilterTimeZone}
              filterTimezoneMode={runtime.filterTimezoneMode}
              setFilterTimezoneMode={runtime.setFilterTimezoneMode}
              TIMEZONE_OPTIONS={runtime.TIMEZONE_OPTIONS}
              isMobile={runtime.isMobile}
            />
          )}

          {!runtime.isSelectingFilterBoundary && (
            <FilterToggle
              showFilter={runtime.showFilter}
              setShowFilter={runtime.setShowFilter}
            />
          )}

          <div
            className={`left-overlay-panel left-panel-wrapper ${
              runtime.showFilter && !runtime.isSelectingFilterBoundary
                ? ""
                : "left-collapsed"
            }`}
            aria-hidden={
              !runtime.showFilter || runtime.isSelectingFilterBoundary
            }
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
              system={system}
              apis={runtime.apis}
              exports={runtime.exports}
              boundaries={runtime.boundaries}
              onSelectBoundary={runtime.openFilterBoundarySelection}
            />
          </div>
        </>
      )}

      {/* Motion Tracking */}
      {canEdit && (
        <TrackLocationButton
          trackLocation={runtime.trackLocation}
          hasBottomUI={hasTimeWindowFilter}
          handleTrackLocationToggle={runtime.handleTrackLocationToggle}
          isMobile={runtime.isMobile}
          system={system}
        />
      )}

      {/* MiniGallery Conditional Block */}
      {!runtime.trackLocation &&
        !runtime.isMobile &&
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

      {/*
       * The geometry filter's own "pick a boundary" step. It takes the
       * filter panel's place rather than stacking beside it - only one
       * thing should be asking for input at a time - and the map swaps
       * the project's data for its boundaries while it's open (see this
       * engine's MapAdapter.jsx). The filter panel is hidden rather
       * than unmounted, so nothing about its state changes while you
       * are away from it.
       */}
      <FilterBoundarySelection
        isSelectingFilterBoundary={runtime.isSelectingFilterBoundary}
        showFilterBoundaryPicker={runtime.showFilterBoundaryPicker}
        setShowFilterBoundaryPicker={runtime.setShowFilterBoundaryPicker}
        filterBoundaryDraft={runtime.filterBoundaryDraft}
        setFilterBoundaryDraft={runtime.setFilterBoundaryDraft}
        onCancel={runtime.cancelFilterBoundarySelection}
        onSave={runtime.saveFilterBoundarySelection}
        boundaries={runtime.boundaries}
      />
    </>
  );
}

export default AppAdapter;
