import { useEffect, useRef, useMemo, useState } from "react";
import "../../styles/modals.css";
import "./SettingsModal.css";
import { validateUserColorTheme } from "../../../shared/validation/accounts.js";

function SettingsModal({
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  projects,
  setProjectId,
  projectId,
  setSelectedDataItem,
  tileStyleKey,
  setTileStyleKey,
  TILE_STYLES,
  system,
  schema,
  user,
  setUser,
  accountsApi,
  USER_ICON_THEMES,
}) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  const safeProjects = Array.isArray(projects) ? projects : [];
  const [selectedOwnedProjectId, setSelectedOwnedProjectId] = useState(
    projectId || "",
  );

  const selectedOwnedProject = useMemo(() => {
    return (
      safeProjects.find(
        (p) => String(p._id) === String(selectedOwnedProjectId),
      ) || null
    );
  }, [safeProjects, selectedOwnedProjectId]);

  const [selectedUserColorTheme, setSelectedUserColorTheme] = useState(
    user?.userColorTheme || "green",
  );

  useEffect(() => {
    setSelectedUserColorTheme(user?.userColorTheme || "green");
  }, [user?.userColorTheme]);

  useEffect(() => {
    if (!isSettingsModalOpen) return;

    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();

    const cleanup = system.trapFocus(modalRef.current, () =>
      setIsSettingsModalOpen(false),
    );

    return () => {
      cleanup();
      previousFocus?.focus?.();
    };
  }, [isSettingsModalOpen, setIsSettingsModalOpen]);

  useEffect(() => {
    if (!isSettingsModalOpen) return;

    const cleanupVoice = system.registerVoiceCommands("settingsModal", {
      setIsSettingsModalOpen,
      setProjectId,
      setTileStyleKey,
      setSelectedDataItem,
      system,
    });

    return () => {
      cleanupVoice();
    };
  }, [
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    setProjectId,
    setTileStyleKey,
    setSelectedDataItem,
    system,
  ]);

  const selectedProjectName = schema?.projectName || "No Project Loaded";
  const selectedProjectOwner = schema?.owner || "Unknown Owner";
  const selectedProjectDescription = schema?.projectDescription?.trim() || null;
  const selectedProjectRole = schema?.userRole || "viewer";

  const currentThemeKey = selectedUserColorTheme || "green";
  const currentTheme =
    USER_ICON_THEMES?.[currentThemeKey] || USER_ICON_THEMES?.green || null;

  const handleProjectChange = (newProjectId) => {
    setProjectId(newProjectId);
    system.startLoading("Switching Projects...");
    setSelectedDataItem(null);
    system.notify("Project Changed");
  };

  const handleLoadOwnedProject = () => {
    if (!selectedOwnedProjectId) {
      system.notify("Select a project to load.");
      return;
    }

    if (String(selectedOwnedProjectId) === String(projectId)) {
      system.notify("That project is already loaded.");
      return;
    }

    handleProjectChange(selectedOwnedProjectId);
    setIsSettingsModalOpen(false);
  };

  const handleStyleChange = (newKey) => {
    setTileStyleKey(newKey);
    system.notify("Map Style Changed");
  };

  const handleSaveUserColorTheme = async () => {
    const themeError = validateUserColorTheme(selectedUserColorTheme);
    if (themeError) {
      system.notify(themeError);
      return;
    }

    const normalizedUserColorTheme = selectedUserColorTheme.trim();

    if ((user?.userColorTheme || "green") === normalizedUserColorTheme) {
      system.notify("That color theme is already selected.");
      return;
    }

    system.startLoading("Updating user color theme...");

    try {
      const { success, message, data } = await accountsApi.changeUserColorTheme(
        normalizedUserColorTheme,
      );

      system.notify(message);

      if (success) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                userColorTheme:
                  data?.userColorTheme || normalizedUserColorTheme,
              }
            : prev,
        );
      }
    } catch {
      system.notify("Failed to update user color theme.");
    } finally {
      system.stopLoading();
    }
  };

  return (
    <div
      className={`modal-backdrop ${isSettingsModalOpen ? "open" : "hidden"}`}
      aria-hidden={!isSettingsModalOpen}
      onMouseDown={() => setIsSettingsModalOpen(false)}
    >
      <div
        ref={modalRef}
        className="modal-overlay centered-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="modal settings-modal"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            ref={closeButtonRef}
            className="close-button"
            onClick={() => setIsSettingsModalOpen(false)}
            aria-label="Close Settings"
          >
            ×
          </button>

          <h3 id="settings-modal-title">Settings</h3>

          <div className="settings-section-divider" aria-hidden="true" />
          <h4>Map Settings</h4>

          <div className="form-group">
            <label className="label-container" htmlFor="tile-style-selector">
              Map Style:
            </label>
            <select
              id="tile-style-selector"
              value={tileStyleKey}
              onChange={(e) => handleStyleChange(e.target.value)}
            >
              {Object.keys(TILE_STYLES).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-section-divider" aria-hidden="true" />
          <h4>User Settings</h4>

          <div className="settings-note">
            Choose the color theme used for your live user icon.
          </div>

          <div className="settings-user-block">
            <div className="form-group">
              <label
                className="label-container"
                htmlFor="user-color-theme-selector"
              >
                User Icon Color:
              </label>
              <select
                id="user-color-theme-selector"
                value={selectedUserColorTheme}
                onChange={(e) => setSelectedUserColorTheme(e.target.value)}
              >
                {Object.keys(USER_ICON_THEMES || {}).map((themeKey) => (
                  <option key={themeKey} value={themeKey}>
                    {themeKey.charAt(0).toUpperCase() + themeKey.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-user-preview-wrap">
              <div className="settings-user-preview-label">Preview</div>
              <div className="settings-user-preview-box">
                <div
                  className="settings-user-preview-dot"
                  style={{
                    backgroundColor:
                      currentTheme?.fill || "rgba(26, 203, 53, 0.96)",
                    borderColor:
                      currentTheme?.stroke || "rgba(35, 98, 47, 0.8)",
                  }}
                />
              </div>
            </div>

            <div className="settings-project-buttons">
              <button
                type="button"
                className="settings-project-button settings-project-button-green"
                onClick={handleSaveUserColorTheme}
              >
                Save User Color
              </button>
            </div>
          </div>

          <div className="settings-section-divider" aria-hidden="true" />
          <h4>Current Project</h4>

          <div>
            You are currently viewing <strong>{selectedProjectName}</strong> as{" "}
            <strong>{selectedProjectRole}</strong>
          </div>
          <br />
          <div className="settings-current-project-banner">
            <div>
              <strong>Current Project: </strong> {selectedProjectName}
            </div>
            <div>
              <strong>Project Owner: </strong>
              {selectedProjectOwner}
            </div>
            {selectedProjectDescription && (
              <div>
                <strong>Project Description:</strong>{" "}
                {selectedProjectDescription}
              </div>
            )}
          </div>

          <div className="settings-section-divider" aria-hidden="true" />
          <h4>Your Projects</h4>

          <div className="settings-note">
            These are projects you own. To discover public projects or projects
            shared with you, use the community page.
          </div>

          <div className="settings-project-block">
            <div className="settings-project-section">
              <h4>Your Projects</h4>

              <div
                className="settings-project-list"
                role="listbox"
                aria-label="Your Projects"
              >
                {safeProjects.length > 0 ? (
                  safeProjects.map((project) => (
                    <div
                      key={project._id}
                      className={`settings-project-item ${
                        String(selectedOwnedProjectId) === String(project._id)
                          ? "settings-project-item-selected"
                          : ""
                      }`}
                      onClick={() => setSelectedOwnedProjectId(project._id)}
                    >
                      {project.projectName}
                    </div>
                  ))
                ) : (
                  <div className="settings-empty-message">
                    No owned projects found.
                  </div>
                )}
              </div>
            </div>

            {selectedOwnedProject?.projectDescription?.trim() && (
              <div className="settings-note">
                <br />
                <strong>Project Description:</strong>{" "}
                {selectedOwnedProject.projectDescription}
              </div>
            )}

            <div className="settings-project-buttons">
              <button
                type="button"
                className="settings-project-button settings-project-button-green"
                onClick={handleLoadOwnedProject}
              >
                Load Selected Project
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;