import { Route, Navigate } from "react-router-dom";
import Viewer from "../../workflows/Viewer.jsx";
import PresenceEditor from "../../workflows/PresenceEditor.jsx";
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
            <PresenceEditor
              setData={runtime.setData}
              draftUser={runtime.draftUser}
              setDraftUser={runtime.setDraftUser}
              schema={runtime.schema}
              setSchema={runtime.setSchema}
              setCurrentPage={runtime.setCurrentPage}
              blankFormTemplate={runtime.blankFormTemplate}
              forms={runtime.forms}
              dataUtils={runtime.dataUtils}
              system={system}
              apis={runtime.apis}
              trackLocation={runtime.trackLocation}
              onOpenExtension={runtime.onOpenExtension}
              isMobile={runtime.isMobile}
              activeExtensionModal={runtime.activeExtensionModal}
              setActiveExtensionModal={runtime.setActiveExtensionModal}
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
