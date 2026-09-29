import { Route, Navigate } from "react-router-dom";
import FloatingViewer from "../../workflows/FloatingViewer.jsx";
import NeighbourhoodEditor from "../../workflows/NeighbourhoodEditor.jsx";
import NeighbourhoodAnalysis from "../../workflows/NeighbourhoodAnalysis.jsx";
import {
  SPATIAL_TOOL_PAGES,
  renderSpatialToolRoutes,
} from "../../workflows/spatialToolPages.jsx";

function hasEditorAccess(role) {
  return role === "owner" || role === "admin" || role === "editor";
}

export function getPagesConfig(role) {
  const canEdit = hasEditorAccess(role);

  return [
    { key: "viewer", path: "viewer", label: "Viewer" },
    ...(canEdit ? [{ key: "editor", path: "editor", label: "Editor" }] : []),
    { key: "analysis", path: "analysis", label: "Analysis" },
    ...SPATIAL_TOOL_PAGES,
  ];
}

export function PagesAdapter({ runtime, system }) {
  if (!runtime?.schema) return null;

  const canEdit = hasEditorAccess(runtime.schema.userRole);

  return (
    <>
      <Route
        path="viewer"
        element={
          <FloatingViewer
            selectedDataItem={runtime.selectedDataItem}
            setSelectedDataItem={runtime.setSelectedDataItem}
            schema={runtime.schema}
            viewerTimeZone={runtime.viewerTimeZone}
            onOpenExtension={runtime.onOpenExtension}
            currentPage={runtime.currentPage}
            setCurrentPage={runtime.setCurrentPage}
            analysisResult={runtime.analysisResult}
            isMobile={runtime.isMobile}
            activeExtensionModal={runtime.activeExtensionModal}
            setActiveExtensionModal={runtime.setActiveExtensionModal}
          />
        }
      />

      <Route
        path="editor"
        element={
          canEdit ? (
            <NeighbourhoodEditor
              setData={runtime.setData}
              selectedDataItem={runtime.selectedDataItem}
              setSelectedDataItem={runtime.setSelectedDataItem}
              schema={runtime.schema}
              setSchema={runtime.setSchema}
              setCurrentPage={runtime.setCurrentPage}
              onOpenExtension={runtime.onOpenExtension}
              setIsMiniGalleryOpen={runtime.setIsMiniGalleryOpen}
              forms={runtime.forms}
              dataUtils={runtime.dataUtils}
              system={system}
              map={runtime.map}
              apis={runtime.apis}
              blankFormTemplate={runtime.blankFormTemplate}
              isMobile={runtime.isMobile}
              activeExtensionModal={runtime.activeExtensionModal}
              setActiveExtensionModal={runtime.setActiveExtensionModal}
              activeLayer={runtime.activeLayer}
              activeParentDataItemId={runtime.activeParentDataItemId}
            />
          ) : (
            <Navigate to="../viewer" replace />
          )
        }
      />

      <Route
        path="analysis"
        element={
          <NeighbourhoodAnalysis
            selectedDataItem={runtime.selectedDataItem}
            setSelectedDataItem={runtime.setSelectedDataItem}
            schema={runtime.schema}
            viewerTimeZone={runtime.viewerTimeZone}
            onOpenExtension={runtime.onOpenExtension}
            setCurrentPage={runtime.setCurrentPage}
            ANALYSIS_COLORS={runtime.ANALYSIS_COLORS}
            isMobile={runtime.isMobile}
            analysisInputs={runtime.analysisInputs}
            setAnalysisInputs={runtime.setAnalysisInputs}
            currentPage={runtime.currentPage}
            analysisResult={runtime.analysisResult}
            analysisAlgorithm={runtime.analysisAlgorithm}
            setAnalysisAlgorithm={runtime.setAnalysisAlgorithm}
            ALGORITHM_OPTIONS={runtime.ALGORITHM_OPTIONS}
            activeExtensionModal={runtime.activeExtensionModal}
            setActiveExtensionModal={runtime.setActiveExtensionModal}
          />
        }
      />

      {renderSpatialToolRoutes({ runtime, system })}
    </>
  );
}
