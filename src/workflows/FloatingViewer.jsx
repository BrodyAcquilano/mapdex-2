import { useState, useEffect, useMemo } from "react";
import InfoPanel from "../display/InfoPanel.jsx";
import FloatingInfoPanel from "../display/FloatingInfoPanel.jsx";

import "./pages.css";

const PROJECT_EXTENSION_ORDER = [
  {
    key: "Bulletin",
    label: "Open Bulletin",
    title: "Open Bulletin",
    icon: "📌",
    getMode: () => "viewer",
  },
  {
    key: "Chat",
    label: "Open Chat",
    title: "Open Chat",
    icon: "💬",
    getMode: () => "viewer",
  },
];

function FloatingViewer({
  selectedDataItem,
  setSelectedDataItem,
  schema,
  viewerTimeZone,
  onOpenExtension,
  currentPage,
  setCurrentPage,
  analysisResult,
  isMobile,
  activeExtensionModal,
  setActiveExtensionModal,
}) {
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    setCurrentPage("viewer");
  }, [setCurrentPage]);

  const enabledProjectExtensions = useMemo(() => {
    return PROJECT_EXTENSION_ORDER.filter(
      (extension) => schema?.extensions?.[extension.key]?.enabled === true,
    );
  }, [schema._id,  schema?.configUpdatedAt,]);

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
      {enabledProjectExtensions.map((extension, index) => (
        <button
          key={extension.key}
          className="side-extension-button"
          style={{
           top: isMobile ? `${90 + index * 55}px` : `${95 + index * 55}px`,
            left: isMobile ? "10px" : "30px",
          }}
          onClick={() => handleProjectExtensionClick(extension)}
          aria-label={extension.label}
          title={extension.title}
        >
          {extension.icon}
        </button>
      ))}

      {isMobile ? (
        <>
          <button
            className={`right-side-toggle right-toggle ${
              showInfo ? "" : "right-collapsed-toggle"
            }`}
            onClick={() => setShowInfo((prev) => !prev)}
            aria-label="Toggle Info Panel"
          >
            ☰
          </button>

          <div
            className={`right-overlay-panel right-panel-wrapper ${
              showInfo ? "" : "right-collapsed"
            }`}
            aria-hidden={!showInfo}
          >
            <InfoPanel
              selectedDataItem={selectedDataItem}
              schema={schema}
              viewerTimeZone={viewerTimeZone}
              onOpenExtension={onOpenExtension}
              currentPage={currentPage}
              analysisResult={analysisResult}
            />
          </div>
        </>
      ) : (
        <>
          {selectedDataItem && (
            <FloatingInfoPanel
              selectedDataItem={selectedDataItem}
              setSelectedDataItem={setSelectedDataItem}
              schema={schema}
              viewerTimeZone={viewerTimeZone}
              onOpenExtension={onOpenExtension}
              currentPage={currentPage}
              analysisResult={analysisResult}
            />
          )}
        </>
      )}
    </>
  );
}

export default FloatingViewer;
