import { useEffect, useMemo, useState } from "react";
import { getEngineList } from "../../engines";
import {
  applyProjectPatch,
  ENGINE_DESCRIPTIONS,
  getVisibilityDescription,
  groupProjectsByVisibility,
  handleCloneProject,
  handleCreateProject,
  handleDeleteProject,
  handleExportProject,
  handleLoadProject,
  handleToggleFavourite,
} from "./projectHelpers.js";
import RenderProjectProfile from "./renderProjectProfile.jsx";
import RenderProjectPermissions from "./renderProjectPermissions.jsx";
import CommunityProfileViewer from "./CommunityProfileViewer.jsx";
import "./Projects.css";
import {
  PROJECT_LIMITS,
  SUBSCRIPTION_LIMITS,
} from "../../../shared/validation/validationConstants.js";
import {
  VISIBILITY_OPTIONS,
} from "../../../shared/validation/schemaConstants.js";
import { normalizeTag } from "../../../shared/validation/formValueHelpers.js";

const TABS = [
  { key: "current", label: "Current Project" },
  { key: "projects", label: "Your Projects" },
  { key: "create", label: "Create Project" },
];

function ProjectCard({ project, selected, onSelect, engineLabel }) {
  const glyph =
    (project.projectName || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`proj-card ${selected ? "proj-card-selected" : ""}`}
      onClick={() => onSelect(project._id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(project._id);
        }
      }}
    >
      <div className="proj-card-image">
        <span className="proj-card-image-glyph">{glyph}</span>
      </div>
      <div className="proj-card-body">
        {engineLabel && (
          <span className="proj-card-engine">{engineLabel}</span>
        )}
        <div className="proj-card-name">
          {project.projectName || "Untitled Project"}
        </div>
        {project.projectDescription?.trim() && (
          <div className="proj-card-desc">{project.projectDescription}</div>
        )}
      </div>
    </div>
  );
}

function Projects({
  setCurrentPage,
  system,
  apis,
  schema,
  setSchema,
  projectId,
  setProjectId,
  projects,
  setProjects,
  favouriteProjects,
  setFavouriteProjects,
  user,
  setUser,
}) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const isProjectFavourited = (project) =>
    (favouriteProjects || []).some((p) => String(p._id) === String(project?._id));
  const userTier = String(user?.subscriptionTier || "free")
    .trim()
    .toLowerCase();

  const maxProjects =
    SUBSCRIPTION_LIMITS.maxProjectsByTier[userTier] ??
    SUBSCRIPTION_LIMITS.maxProjectsByTier.free;

  const currentProjectCount = Array.isArray(safeProjects)
    ? safeProjects.length
    : 0;

  const [activeTab, setActiveTab] = useState("current");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectsView, setProjectsView] = useState("list");
  const [navStack, setNavStack] = useState([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newEngineKey, setNewEngineKey] = useState(
    getEngineList()[0]?.key || "",
  );
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectTags, setNewProjectTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [newVisibility, setNewVisibility] = useState("private");

  useEffect(() => {
    setCurrentPage("projects");
  }, [setCurrentPage]);

  useEffect(() => {
    if (
      selectedProjectId &&
      !safeProjects.some((p) => String(p._id) === String(selectedProjectId))
    ) {
      setSelectedProjectId(null);
      setProjectsView("list");
    }
  }, [selectedProjectId, safeProjects]);

  const selectedProject = useMemo(() => {
    return (
      safeProjects.find((p) => String(p._id) === String(selectedProjectId)) ||
      null
    );
  }, [safeProjects, selectedProjectId]);

  const engineLabels = useMemo(() => {
    const map = {};
    getEngineList().forEach((engine) => {
      map[engine.key] = engine.label;
    });
    return map;
  }, []);

  const selectedEngineDescription = useMemo(() => {
    return (
      ENGINE_DESCRIPTIONS[newEngineKey] ||
      "Create a new project using one of the available engine types."
    );
  }, [newEngineKey]);

  const normalizedNewTagInput = normalizeTag(newTagInput);
  const newTagAlreadyExists = newProjectTags.some(
    (tag) => tag.toLowerCase() === normalizedNewTagInput.toLowerCase(),
  );
  const hasReachedMaxNewTags =
    newProjectTags.length >= PROJECT_LIMITS.maxProjectTags;
  const canAddNewTag =
    normalizedNewTagInput !== "" && !newTagAlreadyExists && !hasReachedMaxNewTags;

  function handleAddNewTag() {
    if (!canAddNewTag) return;
    setNewProjectTags((prev) => [...prev, normalizedNewTagInput]);
    setNewTagInput("");
  }

  function handleRemoveNewTag(index) {
    setNewProjectTags((prev) => prev.filter((_, idx) => idx !== index));
  }

  function openUserProfile(userName) {
    setNavStack((prev) => [...prev, { type: "user", userName }]);
  }

  function handleSelectTab(tabKey) {
    setNavStack([]);
    setActiveTab(tabKey);
  }

  return (
    <div className="projects-page">
      <div className="projects-shell">
        <div className="projects-header">
          <h1 className="projects-title">Project Manager</h1>
          <p className="projects-subtitle">
            Manage your projects, organize access, and control how your work
            is shared.
          </p>
        </div>

        <div
          className="projects-tabbar"
          role="tablist"
          aria-label="Project manager sections"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`projects-tab ${
                activeTab === tab.key ? "projects-tab-active" : ""
              }`}
              onClick={() => handleSelectTab(tab.key)}
            >
              {tab.label}
              {tab.key === "projects" && (
                <span className="projects-tab-count">
                  {safeProjects.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {navStack.length > 0 ? (
          <CommunityProfileViewer
            stack={navStack}
            setStack={setNavStack}
            engineLabels={engineLabels}
            system={system}
            apis={apis}
            setSchema={setSchema}
            projectId={projectId}
            setProjectId={setProjectId}
            safeProjects={safeProjects}
            setProjects={setProjects}
            favouriteProjects={favouriteProjects}
            setFavouriteProjects={setFavouriteProjects}
            user={user}
            setUser={setUser}
            currentProjectCount={currentProjectCount}
            maxProjects={maxProjects}
          />
        ) : (
          <>
        {activeTab === "current" && schema?._id && (
          <>
            <RenderProjectProfile
              project={schema}
              engineLabel={engineLabels[schema.engineKey] || schema.engineKey}
              isCurrentProject
              currentProjectCount={currentProjectCount}
              maxProjects={maxProjects}
              system={system}
              apis={apis}
              onOwnerClick={openUserProfile}
              isFavourited={isProjectFavourited(schema)}
              onToggleFavourite={() =>
                handleToggleFavourite({
                  project: schema,
                  isFavourited: isProjectFavourited(schema),
                  system,
                  apis,
                  setFavouriteProjects,
                })
              }
              onUpdate={(patch) =>
                applyProjectPatch({
                  id: schema._id,
                  patch,
                  setLists: [setProjects, setFavouriteProjects],
                  setSchema,
                })
              }
              onDelete={() =>
                handleDeleteProject({
                  selectedDeleteId: schema._id,
                  safeProjects,
                  projectId,
                  system,
                  apis,
                  setProjects,
                  setProjectId,
                  setSelectedDeleteId: () => {},
                })
              }
              onClone={() =>
                handleCloneProject({
                  project: schema,
                  safeProjects,
                  user,
                  system,
                  apis,
                  setProjects,
                  setProjectId,
                })
              }
              onExport={() =>
                handleExportProject({
                  project: schema,
                  system,
                  apis,
                })
              }
            />

            <RenderProjectPermissions
              key={schema._id}
              project={schema}
              system={system}
              apis={apis}
              onUpdate={(patch) =>
                applyProjectPatch({
                  id: schema._id,
                  patch,
                  setLists: [setProjects, setFavouriteProjects],
                  setSchema,
                })
              }
            />
          </>
        )}

        {activeTab === "projects" && (
          <>
            {projectsView === "profile" && selectedProject ? (
              <RenderProjectProfile
                project={selectedProject}
                engineLabel={
                  engineLabels[selectedProject.engineKey] ||
                  selectedProject.engineKey
                }
                isCurrentProject={
                  String(selectedProject._id) === String(projectId)
                }
                currentProjectCount={currentProjectCount}
                maxProjects={maxProjects}
                system={system}
                apis={apis}
                onOwnerClick={openUserProfile}
                isFavourited={isProjectFavourited(selectedProject)}
                onToggleFavourite={() =>
                  handleToggleFavourite({
                    project: selectedProject,
                    isFavourited: isProjectFavourited(selectedProject),
                    system,
                    apis,
                    setFavouriteProjects,
                  })
                }
                onUpdate={(patch) =>
                  applyProjectPatch({
                    id: selectedProject._id,
                    patch,
                    setLists: [setProjects, setFavouriteProjects],
                    setSchema,
                  })
                }
                onBack={() => setProjectsView("list")}
                onLoad={() =>
                  handleLoadProject({
                    selectedLoadId: selectedProjectId,
                    projectId,
                    system,
                    setProjectId,
                  })
                }
                onDelete={() =>
                  handleDeleteProject({
                    selectedDeleteId: selectedProjectId,
                    safeProjects,
                    projectId,
                    system,
                    apis,
                    setProjects,
                    setProjectId,
                    setSelectedDeleteId: setSelectedProjectId,
                  })
                }
                onClone={() =>
                  handleCloneProject({
                    project: selectedProject,
                    safeProjects,
                    user,
                    system,
                    apis,
                    setProjects,
                    setProjectId,
                  })
                }
                onExport={() =>
                  handleExportProject({
                    project: selectedProject,
                    system,
                    apis,
                  })
                }
              />
            ) : (
              <div className="proj-panel" role="tabpanel">
                <div className="proj-panel-heading">
                  <div>
                    <h2 className="proj-panel-title">Your Projects</h2>
                    <p className="proj-panel-description">
                      Select a project to view its details, load it, or
                      manage it.
                    </p>
                  </div>
                </div>

                {(() => {
                  const grouped = groupProjectsByVisibility(safeProjects);
                  const groups = [
                    { key: "private", label: "Your Private Projects", list: grouped.private },
                    { key: "public", label: "Your Public Projects", list: grouped.public },
                    { key: "open", label: "Your Open Projects", list: grouped.open },
                  ];

                  return groups.map((group) => (
                    <div key={group.key} className="proj-section">
                      <h3 className="proj-section-title">{group.label}</h3>

                      {group.list.length > 0 ? (
                        <div className="proj-grid">
                          {group.list.map((project) => (
                            <ProjectCard
                              key={project._id}
                              project={project}
                              selected={
                                String(selectedProjectId) === String(project._id)
                              }
                              onSelect={(id) => {
                                setSelectedProjectId(id);
                                setProjectsView("profile");
                              }}
                              engineLabel={
                                engineLabels[project.engineKey] || project.engineKey
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="proj-empty">
                          {group.key === "private"
                            ? "No private projects."
                            : group.key === "public"
                              ? "No public projects."
                              : "No open projects."}
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            )}

            {projectsView === "profile" && selectedProject && (
              <RenderProjectPermissions
                key={selectedProject._id}
                project={selectedProject}
                system={system}
                apis={apis}
                onUpdate={(patch) =>
                  applyProjectPatch({
                    id: selectedProject._id,
                    patch,
                    setLists: [setProjects, setFavouriteProjects],
                    setSchema,
                  })
                }
              />
            )}
          </>
        )}

        {activeTab === "create" && (
          <>
            <div className="proj-panel" role="tabpanel">
              <div className="proj-panel-heading">
                <div>
                  <h2 className="proj-panel-title">Create Project</h2>
                  <p className="proj-panel-description">
                    Create a new project using one of the available engine
                    types.
                  </p>
                </div>
              </div>
            </div>

            <div className="proj-panel" role="tabpanel">
              <div className="proj-panel-heading proj-panel-heading-center">
                <div>
                  <h2 className="proj-panel-title">Engine</h2>
                </div>
              </div>

              <div className="proj-title-divider" />

              <div className="proj-section">
                <label className="proj-label">Engine / Project Type</label>
                <select
                  className="proj-select"
                  value={newEngineKey}
                  onChange={(e) => setNewEngineKey(e.target.value)}
                >
                  {getEngineList().map((engine) => (
                    <option key={engine.key} value={engine.key}>
                      {engine.label}
                    </option>
                  ))}
                </select>

                <p className="proj-section-description">
                  {selectedEngineDescription}
                </p>
              </div>
            </div>

            <div className="proj-panel" role="tabpanel">
              <div className="proj-panel-heading proj-panel-heading-center">
                <div>
                  <h2 className="proj-panel-title">Project Details</h2>
                </div>
              </div>

              <div className="proj-title-divider" />

              <div className="proj-section">
                <label className="proj-label">Project Name</label>
                <input
                  className="proj-input"
                  type="text"
                  placeholder="Project Name"
                  value={newProjectName}
                  maxLength={PROJECT_LIMITS.projectNameMaxLength}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />

                <label className="proj-label">Project Description</label>
                <textarea
                  className="proj-input"
                  placeholder="Project Description"
                  value={newProjectDescription}
                  maxLength={PROJECT_LIMITS.projectDescriptionMaxLength}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  rows={3}
                />

                <label className="proj-label">Tags</label>
                <div className="rpp-tags-input-row">
                  <input
                    type="text"
                    className="rpp-tags-input"
                    value={newTagInput}
                    maxLength={PROJECT_LIMITS.projectTagMaxLength}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewTag();
                      }
                    }}
                    placeholder="Add a tag..."
                  />
                  <button
                    type="button"
                    className="rpp-tag-add-button"
                    onClick={handleAddNewTag}
                    disabled={!canAddNewTag}
                    title={
                      hasReachedMaxNewTags
                        ? `Maximum of ${PROJECT_LIMITS.maxProjectTags} tags reached`
                        : newTagAlreadyExists
                          ? "That tag already exists"
                          : "Add tag"
                    }
                  >
                    +
                  </button>
                </div>

                {newProjectTags.length > 0 && (
                  <ul className="rpp-tag-list">
                    {newProjectTags.map((tag, index) => (
                      <li key={`${tag}-${index}`} className="rpp-tag-item">
                        <span className="rpp-tag-text">{tag}</span>
                        <button
                          type="button"
                          className="rpp-tag-remove-button"
                          onClick={() => handleRemoveNewTag(index)}
                          aria-label={`Remove ${tag}`}
                          title="Remove tag"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="proj-panel" role="tabpanel">
              <div className="proj-panel-heading proj-panel-heading-center">
                <div>
                  <h2 className="proj-panel-title">Permissions</h2>
                </div>
              </div>

              <div className="proj-title-divider" />

              <div className="proj-section">
                <h3 className="proj-section-title">Visibility</h3>
                <p className="proj-section-description">
                  {getVisibilityDescription(newVisibility)}
                </p>
                <select
                  className="proj-select"
                  value={newVisibility}
                  onChange={(e) => setNewVisibility(e.target.value)}
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="proj-panel" role="tabpanel">
              <div className="proj-actions">
                <button
                  className="proj-button proj-button-accent"
                  onClick={() =>
                    handleCreateProject({
                      newProjectName,
                      newEngineKey,
                      newProjectDescription,
                      newProjectTags,
                      newVisibility,
                      safeProjects,
                      user,
                      system,
                      apis,
                      setProjects,
                      setProjectId,
                      setNewProjectName,
                      setNewProjectDescription,
                      setNewProjectTags,
                      setSelectedLoadId: setSelectedProjectId,
                    })
                  }
                >
                  Create Project
                </button>
              </div>

              <div className="proj-detail">
                <strong>Your Project Count:</strong> {currentProjectCount} /{" "}
                {maxProjects}
                <div className="proj-upgrade-note">
                  The number of projects you can create depends on your
                  subscription tier, and can be increased by upgrading.
                </div>
              </div>
            </div>
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}

export default Projects;
