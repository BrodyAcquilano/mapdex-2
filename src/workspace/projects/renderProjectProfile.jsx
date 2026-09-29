import { useEffect, useState } from "react";
import { handleSaveProjectSettings } from "./projectHelpers.js";
import { PROJECT_LIMITS } from "../../../shared/validation/validationConstants.js";
import { normalizeTag } from "../../../shared/validation/formValueHelpers.js";
import UserBadge from "../community/UserBadge.jsx";
import "./renderProjectProfile.css";

const ROLE_LEVELS = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

function VisibilityBadge({ visibility }) {
  const label = visibility
    ? visibility.charAt(0).toUpperCase() + visibility.slice(1)
    : "Private";

  return (
    <span className={`rpp-visibility rpp-visibility-${visibility || "private"}`}>
      Visibility: {label}
    </span>
  );
}

function RenderProjectProfile({
  project,
  engineLabel,
  isCurrentProject = false,
  currentProjectCount = 0,
  maxProjects = 0,
  system,
  apis,
  onBack,
  onLoad,
  onDelete,
  onClone,
  onExport,
  onUpdate,
  onOwnerClick,
  onHome,
  isFavourited = false,
  onToggleFavourite,
}) {
  const userRole = project?.userRole || "viewer";
  const isOwnerRole = userRole === "owner";
  const hasAdminClearance = isOwnerRole || userRole === "admin";

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(project?.projectName || "");
  const [draftDescription, setDraftDescription] = useState(
    project?.projectDescription || "",
  );
  const [draftTags, setDraftTags] = useState(
    Array.isArray(project?.projectTags) ? project.projectTags : [],
  );
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (isEditing) return;
    setDraftName(project?.projectName || "");
    setDraftDescription(project?.projectDescription || "");
    setDraftTags(Array.isArray(project?.projectTags) ? project.projectTags : []);
  }, [
    project?._id,
    project?.projectName,
    project?.projectDescription,
    project?.projectTags,
    isEditing,
  ]);

  if (!project) return null;

  const glyph =
    (project.projectName || "?").trim().charAt(0).toUpperCase() || "?";

  const accessLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);

  /*
   * Clone and export are offered to anyone who can see the project.
   * Both only re-shape data the viewer already has access to, so gating
   * them protected nothing and only made projects fiddlier to configure
   * (Brody's own call).
   */
  const showClone = Boolean(onClone);
  const showExport = Boolean(onExport);
  const showLoad = Boolean(onLoad) && !isCurrentProject;
  const showDelete = Boolean(onDelete) && isOwnerRole;

  const normalizedTagInput = normalizeTag(tagInput);
  const tagAlreadyExists = draftTags.some(
    (tag) => tag.toLowerCase() === normalizedTagInput.toLowerCase(),
  );
  const hasReachedMaxTags = draftTags.length >= PROJECT_LIMITS.maxProjectTags;
  const canAddTag =
    normalizedTagInput !== "" && !tagAlreadyExists && !hasReachedMaxTags;

  function handleAddTag() {
    if (!canAddTag) return;
    setDraftTags((prev) => [...prev, normalizedTagInput]);
    setTagInput("");
  }

  function handleRemoveDraftTag(index) {
    setDraftTags((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleStartEditing() {
    setDraftName(project.projectName || "");
    setDraftDescription(project.projectDescription || "");
    setDraftTags(Array.isArray(project.projectTags) ? project.projectTags : []);
    setTagInput("");
    setIsEditing(true);
  }

  function handleCancelEditing() {
    setTagInput("");
    setIsEditing(false);
  }

  function handleSaveSettings() {
    const trimmedName = draftName.trim();

    if (!trimmedName) {
      system?.notify?.("Enter a project name.");
      return;
    }

    handleSaveProjectSettings({
      project,
      projectName: trimmedName,
      projectDescription: draftDescription,
      projectTags: draftTags,
      system,
      apis,
      onSuccess: (patch) => {
        onUpdate?.(patch);
        setIsEditing(false);
      },
    });
  }

  const displayedTags = isEditing
    ? draftTags
    : Array.isArray(project.projectTags)
      ? project.projectTags
      : [];

  return (
    <>
      <div className="proj-panel rpp" role="tabpanel">
        {(onBack || onHome || hasAdminClearance) && (
          <div className="rpp-toolbar">
            <div className="rpp-toolbar-nav">
              {onBack && (
                <button
                  type="button"
                  className="rpp-back"
                  onClick={onBack}
                  aria-label="Back to project list"
                >
                  ← Back
                </button>
              )}

              {onHome && (
                <button
                  type="button"
                  className="rpp-back"
                  onClick={onHome}
                  aria-label="Community home"
                >
                  ⌂ Home
                </button>
              )}
            </div>

            {hasAdminClearance && !isEditing && (
              <button
                type="button"
                className="rpp-edit-toggle"
                onClick={handleStartEditing}
              >
                Edit
              </button>
            )}
          </div>
        )}

        {project.owner && (
          <div className="rpp-owner-row">
            <UserBadge
              userName={project.owner}
              userColorTheme={project.ownerColorTheme}
              onClick={
                onOwnerClick ? () => onOwnerClick(project.owner) : undefined
              }
            />
          </div>
        )}

        <div className="rpp-header">
          <div className="rpp-image">
            <span className="rpp-image-glyph">{glyph}</span>
          </div>

          <div className="rpp-header-info">
            <div className="rpp-name-row">
              {isEditing ? (
                <input
                  type="text"
                  className="rpp-name-input"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={PROJECT_LIMITS.projectNameMaxLength}
                  placeholder="Project name"
                />
              ) : (
                <h2 className="rpp-name">
                  {project.projectName || "Untitled Project"}
                </h2>
              )}

              {onToggleFavourite && (
                <button
                  type="button"
                  className={`rpp-favourite-star ${
                    isFavourited ? "rpp-favourite-star-active" : ""
                  }`}
                  onClick={onToggleFavourite}
                  aria-label={
                    isFavourited ? "Remove from favourites" : "Add to favourites"
                  }
                  title={
                    isFavourited ? "Remove from favourites" : "Add to favourites"
                  }
                >
                  {isFavourited ? "★" : "☆"}
                </button>
              )}
            </div>

            <div className="rpp-badges">
              {engineLabel && (
                <span className="rpp-engine">Engine: {engineLabel}</span>
              )}
              <VisibilityBadge visibility={project.visibility} />
              <span className="rpp-access-badge">
                Access Level: {accessLabel}
              </span>
              {isCurrentProject && (
                <span className="rpp-current-badge">Currently Loaded</span>
              )}
            </div>
          </div>
        </div>

        {isEditing ? (
          <textarea
            className="rpp-description-input"
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            maxLength={PROJECT_LIMITS.projectDescriptionMaxLength}
            placeholder="Project description"
            rows={3}
          />
        ) : (
          project.projectDescription?.trim() && (
            <p className="rpp-description">{project.projectDescription}</p>
          )
        )}

        <div className="rpp-tags">
          <span className="rpp-tags-label">Tags</span>

          {isEditing && (
            <div className="rpp-tags-input-row">
              <input
                type="text"
                className="rpp-tags-input"
                value={tagInput}
                maxLength={PROJECT_LIMITS.projectTagMaxLength}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a tag..."
              />
              <button
                type="button"
                className="rpp-tag-add-button"
                onClick={handleAddTag}
                disabled={!canAddTag}
                title={
                  hasReachedMaxTags
                    ? `Maximum of ${PROJECT_LIMITS.maxProjectTags} tags reached`
                    : tagAlreadyExists
                      ? "That tag already exists"
                      : "Add tag"
                }
              >
                +
              </button>
            </div>
          )}

          {displayedTags.length > 0 ? (
            <ul className="rpp-tag-list">
              {displayedTags.map((tag, index) => (
                <li key={`${tag}-${index}`} className="rpp-tag-item">
                  <span className="rpp-tag-text">{tag}</span>
                  {isEditing && (
                    <button
                      type="button"
                      className="rpp-tag-remove-button"
                      onClick={() => handleRemoveDraftTag(index)}
                      aria-label={`Remove ${tag}`}
                      title="Remove tag"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rpp-tags-empty">No tags.</div>
          )}
        </div>

        {isEditing && (
          <div className="rpp-edit-actions">
            <button
              type="button"
              className="rpp-cancel-button"
              onClick={handleCancelEditing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="proj-button proj-button-accent"
              onClick={handleSaveSettings}
            >
              Save Project Settings
            </button>
          </div>
        )}

      </div>

      {(showLoad || showClone || showExport || showDelete) && (
        <div className="proj-panel" role="tabpanel">
          <div className="proj-panel-heading proj-panel-heading-center">
            <div>
              <h2 className="proj-panel-title">Project Actions</h2>
            </div>
          </div>

          <div className="proj-title-divider" />

          <div className="rpp-clone-export">
            {showLoad && (
              <div className="rpp-action-block">
                <h3 className="rpp-action-title">Load Project</h3>
                <p className="rpp-action-description">
                  Switch to this project and make it your active workspace.
                </p>
                <div className="proj-actions">
                  <button
                    type="button"
                    className="proj-button proj-button-accent"
                    onClick={onLoad}
                  >
                    Load Project
                  </button>
                </div>
              </div>
            )}

            {showClone && (
              <div className="rpp-action-block">
                <h3 className="rpp-action-title">Clone Project</h3>
                <p className="rpp-action-description">
                  Make a copy of this project that you will be the owner of.
                </p>
                <div className="rpp-action-meta">
                  <strong>Your Project Count:</strong> {currentProjectCount} /{" "}
                  {maxProjects}
                </div>
                <div className="proj-actions">
                  <button
                    type="button"
                    className="proj-button proj-button-accent"
                    onClick={onClone}
                  >
                    Clone Project
                  </button>
                </div>
              </div>
            )}

            {showExport && (
              <div className="rpp-action-block">
                <h3 className="rpp-action-title">Export Project</h3>
                <p className="rpp-action-description">
                  {project.engineKey === "presence"
                    ? "Download this Presence project schema as a GeoJSON export file. Live presence locations are not included."
                    : "Download this project as a GeoJSON export file."}
                </p>
                <div className="proj-actions">
                  <button
                    type="button"
                    className="proj-button proj-button-accent"
                    onClick={onExport}
                  >
                    Export Project
                  </button>
                </div>
              </div>
            )}

            {showDelete && (
              <div className="rpp-action-block">
                <h3 className="rpp-action-title">Delete Project</h3>
                <p className="rpp-action-description">
                  Permanently remove this project and all of its data. This
                  cannot be undone.
                </p>
                <div className="proj-actions">
                  <button
                    type="button"
                    className="proj-button proj-button-danger"
                    onClick={onDelete}
                  >
                    Delete Project
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default RenderProjectProfile;
