// src/workflows/MotionEditor.jsx

import { useState, useEffect, useMemo } from "react";
import EditPanel from "../forms/EditPanel.jsx";
import "./pages.css";

const PROJECT_EXTENSION_ORDER = [
  {
    key: "Bulletin",
    label: "Open Bulletin",
    title: "Open Bulletin",
    icon: "📌",
    getMode: () => "editor",
  },
  {
    key: "Chat",
    label: "Open Chat",
    title: "Open Chat",
    icon: "💬",
    getMode: () => "viewer",
  },
];

function MotionEditor({
  setData,
  selectedDataItem,
  setSelectedDataItem,
  schema,
  setSchema,
  onOpenExtension,
  setIsMiniGalleryOpen,
  setCurrentPage,
  blankFormTemplate,
  forms,
  dataUtils,
  system,
  map,
  apis,
  isMobile,
  activeExtensionModal,
  setActiveExtensionModal,
  trackLocation,
}) {
  const [showEditPanel, setShowEditPanel] = useState(false);

  useEffect(() => {
    setCurrentPage("editor");
  }, [setCurrentPage]);

  useEffect(() => {
    if (!trackLocation) return;

    setShowEditPanel(false);
    setIsMiniGalleryOpen?.(false);
  }, [trackLocation, setIsMiniGalleryOpen]);

  const enabledProjectExtensions = useMemo(() => {
    return PROJECT_EXTENSION_ORDER.filter(
      (extension) => schema?.extensions?.[extension.key]?.enabled === true,
    );
  }, [schema?._id, schema?.configUpdatedAt, schema?.extensions]);

  function handleProjectExtensionClick(extension) {
    if (extension.key === "Chat") {
      if (
        activeExtensionModal?.key === "Chat" &&
        activeExtensionModal?.mode === "viewer"
      ) {
        setActiveExtensionModal?.(null);
        return;
      }
    }

    onOpenExtension?.(extension.key, extension.getMode());
  }

  return (
    <>
      {!trackLocation && (
        <>
          {enabledProjectExtensions.map((extension, index) => (
            <button
              key={extension.key}
              className="side-extension-button"
              style={{
                top: isMobile
                  ? `${90 + index * 55}px`
                  : `${95 + index * 55}px`,
                left: isMobile ? "10px" : "30px",
              }}
              onClick={() => handleProjectExtensionClick(extension)}
              aria-label={extension.label}
              title={extension.title}
            >
              {extension.icon}
            </button>
          ))}

          <button
            className={`right-side-toggle right-toggle ${
              showEditPanel ? "" : "right-collapsed-toggle"
            }`}
            onClick={() => setShowEditPanel(!showEditPanel)}
            aria-label="Toggle Edit Panel"
          >
            ☰
          </button>

          <div
            className={`right-overlay-panel right-panel-wrapper ${
              showEditPanel ? "" : "right-collapsed"
            }`}
            aria-hidden={!showEditPanel}
          >
            <EditPanel
              setData={setData}
              selectedDataItem={selectedDataItem}
              setSelectedDataItem={setSelectedDataItem}
              schema={schema}
              setSchema={setSchema}
              onOpenExtension={onOpenExtension}
              setIsMiniGalleryOpen={setIsMiniGalleryOpen}
              blankFormTemplate={blankFormTemplate}
              forms={forms}
              dataUtils={dataUtils}
              system={system}
              map={map}
              apis={apis}
            />
          </div>
        </>
      )}
    </>
  );
}

export default MotionEditor;