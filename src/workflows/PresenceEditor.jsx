import { useState, useEffect, useMemo } from "react";
import PresenceEditPanel from "../forms/PresenceEditPanel.jsx";
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

function PresenceEditor({
  setData,
  draftUser,
  setDraftUser,
  schema,
  setSchema,
  setCurrentPage,
  blankFormTemplate,
  forms,
  dataUtils,
  system,
  apis,
  trackLocation,
  onOpenExtension,
  isMobile,
  activeExtensionModal,
  setActiveExtensionModal,
}) {
  const [showEditPanel, setShowEditPanel] = useState(false);

  useEffect(() => {
    setCurrentPage("editor");
  }, []);

  const enabledProjectExtensions = useMemo(() => {
    return PROJECT_EXTENSION_ORDER.filter(
      (extension) => schema?.extensions?.[extension.key]?.enabled === true,
    );
  }, [schema._id, schema?.configUpdatedAt]);

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
        <PresenceEditPanel
          setData={setData}
          draftUser={draftUser}
          setDraftUser={setDraftUser}
          schema={schema}
          setSchema={setSchema}
          blankFormTemplate={blankFormTemplate}
          forms={forms}
          dataUtils={dataUtils}
          system={system}
          apis={apis}
          trackLocation={trackLocation}
        />
      </div>
    </>
  );
}

export default PresenceEditor;
