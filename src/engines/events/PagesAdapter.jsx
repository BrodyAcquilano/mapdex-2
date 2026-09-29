import { Route, Navigate } from "react-router-dom";
import Viewer from "../../workflows/Viewer.jsx";
import Editor from "../../workflows/Editor.jsx";
import {
  SPATIAL_TOOL_PAGES,
  renderSpatialToolRoutes,
} from "../../workflows/spatialToolPages.jsx";

function hasEditorAccess(role) {
  return role === "owner" || role === "admin" || role === "editor";
}

// 🔹 Navigation metadata for Header
export function getPagesConfig(role) {
  const canEdit = hasEditorAccess(role);

  return [
    {
      key: "viewer",
      path: "viewer",
      label: "Viewer",
    },
    ...(canEdit
      ? [
          {
            key: "editor",
            path: "editor",
            label: "Editor",
          },
        ]
      : []),
    ...SPATIAL_TOOL_PAGES,
  ];
}

// 🔹 Route renderer for MainApp
export function PagesAdapter({ runtime, system }) {
  if (!runtime?.schema) return null;

  const canEdit = hasEditorAccess(runtime.schema.userRole);

  return (
    <>
      <Route
        path="viewer"
        element={
          <Viewer
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
            <Editor
              setData={runtime.setData}
              selectedDataItem={runtime.selectedDataItem}
              setSelectedDataItem={runtime.setSelectedDataItem}
              schema={runtime.schema}
              setSchema={runtime.setSchema}
              geometryTool={runtime.geometryTool}
              setGeometryTool={runtime.setGeometryTool}
              isDrawing={runtime.isDrawing}
              setIsDrawing={runtime.setIsDrawing}
              finishGeometryEdit={runtime.finishGeometryEdit}
              draftGeometry={runtime.draftGeometry}
              setDraftGeometry={runtime.setDraftGeometry}
              geometryEditHistory={runtime.geometryEditHistory}
              setGeometryEditHistory={runtime.setGeometryEditHistory}
              toolbarVisible={runtime.toolbarVisible}
              isSelectingFilterBoundary={runtime.isSelectingFilterBoundary}
              setToolbarVisible={runtime.setToolbarVisible}
              isAddPanelOpen={runtime.isAddPanelOpen}
              setIsAddPanelOpen={runtime.setIsAddPanelOpen}
              finishDrawing={runtime.finishDrawing}
              addPanelOnClose={runtime.addPanelOnClose}
              onOpenExtension={runtime.onOpenExtension}
              setIsMiniGalleryOpen={runtime.setIsMiniGalleryOpen}
              setCurrentPage={runtime.setCurrentPage}
              blankFormTemplate={runtime.blankFormTemplate}
              forms={runtime.forms}
              dataUtils={runtime.dataUtils}
              system={system}
              map={runtime.map}
              apis={runtime.apis}
              exports={runtime.exports}
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

      {renderSpatialToolRoutes({ runtime, system })}
    </>
  );
}
