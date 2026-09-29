import { useEffect, useMemo, useState } from "react";
import { getEngineList } from "../../engines";
import {
  applyProjectPatch,
  handleCloneProject,
  handleDeleteProject,
  handleExportProject,
  handleLoadProject,
  handleToggleFavourite,
} from "../projects/projectHelpers.js";
import RenderProjectProfile from "../projects/renderProjectProfile.jsx";
import RenderProjectPermissions from "../projects/renderProjectPermissions.jsx";
import CommunityProfileViewer from "../projects/CommunityProfileViewer.jsx";
import UserBadge from "./UserBadge.jsx";
import { loadCommunityProjects } from "./communityHelpers.js";
import { searchCommunityUsers } from "./userProfileHelpers.js";
import "../projects/Projects.css";
import "./Community.css";
import {
  GEOMETRY_LIMITS,
  SUBSCRIPTION_LIMITS,
} from "../../../shared/validation/validationConstants.js";
import { normalizeTag } from "../../../shared/validation/formValueHelpers.js";

function toggleFilterValue(list, setList, value) {
  setList((prev) =>
    prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
  );
}

const TABS = [
  { key: "current", label: "Current Project" },
  { key: "public", label: "Public Projects" },
  { key: "shared", label: "Shared Projects" },
  { key: "favourites", label: "Favourite Projects" },
  { key: "findUsers", label: "Find Users" },
  { key: "following", label: "Following" },
  { key: "followers", label: "Followers" },
];

function ProjectCard({ project, selected, onSelect, engineLabel }) {
  const glyph = (project.projectName || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`community-card ${selected ? "community-card-selected" : ""}`}
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
      <div className="community-card-image">
        <span className="community-card-image-glyph">{glyph}</span>
      </div>
      <div className="community-card-body">
        {engineLabel && (
          <span className="community-card-engine">{engineLabel}</span>
        )}
        <div className="community-card-name">
          {project.projectName || "Untitled Project"}
        </div>
        {project.projectDescription?.trim() && (
          <div className="community-card-desc">
            {project.projectDescription}
          </div>
        )}
      </div>
    </div>
  );
}

function Community({
  setCurrentPage,
  system,
  schema,
  setSchema,
  projectId,
  setProjectId,
  projects,
  setProjects,
  publicProjects,
  setPublicProjects,
  sharedProjects,
  setSharedProjects,
  favouriteProjects,
  setFavouriteProjects,
  apis,
  user,
  setUser,
}) {
  const [activeTab, setActiveTab] = useState("current");
  const [selectedPublicId, setSelectedPublicId] = useState(null);
  const [publicView, setPublicView] = useState("list");
  const [selectedSharedId, setSelectedSharedId] = useState(null);
  const [sharedView, setSharedView] = useState("list");
  const [selectedFavouriteId, setSelectedFavouriteId] = useState(null);
  const [favouriteView, setFavouriteView] = useState("list");
  const [navStack, setNavStack] = useState([]);

  const [filterEngineKeys, setFilterEngineKeys] = useState([]);
  const [filterVisibility, setFilterVisibility] = useState([]);
  const [filterGeometryTypes, setFilterGeometryTypes] = useState([]);
  const [filterGeometryMode, setFilterGeometryMode] = useState("any");
  const [filterName, setFilterName] = useState("");
  const [filterTags, setFilterTags] = useState([]);
  const [tagFilterInput, setTagFilterInput] = useState("");
  const [filterUpdatedAtFrom, setFilterUpdatedAtFrom] = useState("");
  const [filterUpdatedAtTo, setFilterUpdatedAtTo] = useState("");

  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userSearchResults, setUserSearchResults] = useState(null);
  const [userSearchPage, setUserSearchPage] = useState(1);

  const safeFollowing = Array.isArray(user?.following) ? user.following : [];
  const safeFollowers = Array.isArray(user?.followers) ? user.followers : [];

  function openUserProfile(userName) {
    setNavStack((prev) => [...prev, { type: "user", userName }]);
  }

  function handleSelectTab(tabKey) {
    setNavStack([]);
    setActiveTab(tabKey);
  }

  function handleSearchUsers(page = 1) {
    setUserSearchPage(page);
    searchCommunityUsers({
      username: userSearchTerm,
      page,
      system,
      apis,
      setResults: setUserSearchResults,
    });
  }

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safePublicProjects = Array.isArray(publicProjects)
    ? publicProjects
    : [];
  const safeSharedProjects = Array.isArray(sharedProjects)
    ? sharedProjects
    : [];
  const safeFavouriteProjects = Array.isArray(favouriteProjects)
    ? favouriteProjects
    : [];

  const userTier = String(user?.subscriptionTier || "free")
    .trim()
    .toLowerCase();

  const maxProjects =
    SUBSCRIPTION_LIMITS.maxProjectsByTier[userTier] ??
    SUBSCRIPTION_LIMITS.maxProjectsByTier.free;

  const currentProjectCount = safeProjects.length;

  const engineLabels = useMemo(() => {
    const map = {};
    getEngineList().forEach((engine) => {
      map[engine.key] = engine.label;
    });
    return map;
  }, []);

  useEffect(() => {
    setCurrentPage("community");
  }, [setCurrentPage]);

  function handleSearchPublicProjects() {
    setPublicView("list");
    loadCommunityProjects({
      system,
      apis,
      setPublicProjects,
      filters: {
        engineKey: filterEngineKeys,
        visibility: filterVisibility,
        geometryTypes: filterGeometryTypes,
        geometryMode: filterGeometryMode,
        name: filterName,
        tags: filterTags,
        updatedAtFrom: filterUpdatedAtFrom,
        updatedAtTo: filterUpdatedAtTo,
      },
    });
  }

  const normalizedTagFilterInput = normalizeTag(tagFilterInput);
  const tagFilterAlreadyExists = filterTags.some(
    (tag) => tag.toLowerCase() === normalizedTagFilterInput.toLowerCase(),
  );
  const canAddFilterTag =
    normalizedTagFilterInput !== "" && !tagFilterAlreadyExists;

  function handleAddFilterTag() {
    if (!canAddFilterTag) return;
    setFilterTags((prev) => [...prev, normalizedTagFilterInput]);
    setTagFilterInput("");
  }

  function handleRemoveFilterTag(index) {
    setFilterTags((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleClearPublicFilters() {
    setFilterEngineKeys([]);
    setFilterVisibility([]);
    setFilterGeometryTypes([]);
    setFilterGeometryMode("any");
    setFilterName("");
    setFilterTags([]);
    setTagFilterInput("");
    setFilterUpdatedAtFrom("");
    setFilterUpdatedAtTo("");
  }

  useEffect(() => {
    if (
      selectedPublicId &&
      !safePublicProjects.some(
        (p) => String(p._id) === String(selectedPublicId),
      )
    ) {
      setSelectedPublicId(null);
      setPublicView("list");
    }
  }, [selectedPublicId, safePublicProjects]);

  useEffect(() => {
    if (
      selectedSharedId &&
      !safeSharedProjects.some(
        (p) => String(p._id) === String(selectedSharedId),
      )
    ) {
      setSelectedSharedId(null);
      setSharedView("list");
    }
  }, [selectedSharedId, safeSharedProjects]);

  useEffect(() => {
    if (
      selectedFavouriteId &&
      !safeFavouriteProjects.some(
        (p) => String(p._id) === String(selectedFavouriteId),
      )
    ) {
      setSelectedFavouriteId(null);
      setFavouriteView("list");
    }
  }, [selectedFavouriteId, safeFavouriteProjects]);

  const selectedPublicProject = useMemo(() => {
    return (
      safePublicProjects.find(
        (p) => String(p._id) === String(selectedPublicId),
      ) || null
    );
  }, [safePublicProjects, selectedPublicId]);

  const selectedSharedProject = useMemo(() => {
    return (
      safeSharedProjects.find(
        (p) => String(p._id) === String(selectedSharedId),
      ) || null
    );
  }, [safeSharedProjects, selectedSharedId]);

  const selectedFavouriteProject = useMemo(() => {
    return (
      safeFavouriteProjects.find(
        (p) => String(p._id) === String(selectedFavouriteId),
      ) || null
    );
  }, [safeFavouriteProjects, selectedFavouriteId]);

  function isProjectFavourited(project) {
    return safeFavouriteProjects.some(
      (p) => String(p._id) === String(project?._id),
    );
  }

  return (
    <div className="community-page">
      <div className="community-shell">
        <div className="community-header">
          <h1 className="community-title">Community</h1>
          <p className="community-subtitle">
            Discover projects, explore ideas, and build something useful
            together. Browse projects other users have shared with you, or
            find public projects anyone can view.
          </p>
        </div>

        <div
          className="community-tabbar"
          role="tablist"
          aria-label="Community sections"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`community-tab ${
                activeTab === tab.key ? "community-tab-active" : ""
              }`}
              onClick={() => handleSelectTab(tab.key)}
            >
              {tab.label}
              {tab.key !== "current" && tab.key !== "findUsers" && (
                <span className="community-tab-count">
                  {tab.key === "shared"
                    ? safeSharedProjects.length
                    : tab.key === "favourites"
                      ? safeFavouriteProjects.length
                      : tab.key === "following"
                        ? safeFollowing.length
                        : tab.key === "followers"
                          ? safeFollowers.length
                          : safePublicProjects.length}
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
            setSharedProjects={setSharedProjects}
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
                  setLists: [setProjects, setSharedProjects, setFavouriteProjects],
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
                  setLists: [setProjects, setSharedProjects, setFavouriteProjects],
                  setSchema,
                })
              }
            />
          </>
        )}

        {activeTab === "public" && (
          <>
            <div className="community-panel" role="tabpanel">
              <div className="community-panel-heading">
                <div>
                  <h2 className="community-panel-title">
                    Search Public Projects
                  </h2>
                  <p className="community-panel-description">
                    Nothing loads until you search. Set any filters you want,
                    or leave them all blank to browse everything.
                  </p>
                </div>
              </div>

              <div className="community-filters">
                <div className="community-filter-group">
                  <span className="community-filter-label">
                    Project Name
                  </span>
                  <input
                    type="text"
                    className="community-filter-input"
                    placeholder="Search by name..."
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                  />
                </div>

                <div className="community-filter-group">
                  <span className="community-filter-label">Engine Type</span>
                  <div className="community-filter-options">
                    {getEngineList().map((engine) => (
                      <label key={engine.key} className="community-checkbox">
                        <input
                          type="checkbox"
                          checked={filterEngineKeys.includes(engine.key)}
                          onChange={() =>
                            toggleFilterValue(
                              filterEngineKeys,
                              setFilterEngineKeys,
                              engine.key,
                            )
                          }
                        />
                        {engine.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="community-filter-group">
                  <span className="community-filter-label">Visibility</span>
                  <div className="community-filter-options">
                    {["public", "open"].map((v) => (
                      <label key={v} className="community-checkbox">
                        <input
                          type="checkbox"
                          checked={filterVisibility.includes(v)}
                          onChange={() =>
                            toggleFilterValue(
                              filterVisibility,
                              setFilterVisibility,
                              v,
                            )
                          }
                        />
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="community-filter-group">
                  <span className="community-filter-label">
                    Geometry Types
                  </span>
                  <div className="community-filter-options">
                    {GEOMETRY_LIMITS.typeOptions.map((t) => (
                      <label key={t} className="community-checkbox">
                        <input
                          type="checkbox"
                          checked={filterGeometryTypes.includes(t)}
                          onChange={() =>
                            toggleFilterValue(
                              filterGeometryTypes,
                              setFilterGeometryTypes,
                              t,
                            )
                          }
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                  <div className="community-filter-mode">
                    <label className="community-radio">
                      <input
                        type="radio"
                        name="geometryMode"
                        checked={filterGeometryMode === "any"}
                        onChange={() => setFilterGeometryMode("any")}
                      />
                      Match any selected
                    </label>
                    <label className="community-radio">
                      <input
                        type="radio"
                        name="geometryMode"
                        checked={filterGeometryMode === "all"}
                        onChange={() => setFilterGeometryMode("all")}
                      />
                      Match all selected
                    </label>
                  </div>
                </div>

                <div className="community-filter-group">
                  <span className="community-filter-label">
                    Updated Between
                  </span>
                  <div className="community-filter-date-row">
                    <input
                      type="date"
                      className="community-filter-input"
                      value={filterUpdatedAtFrom}
                      onChange={(e) => setFilterUpdatedAtFrom(e.target.value)}
                    />
                    <span className="community-filter-date-sep">to</span>
                    <input
                      type="date"
                      className="community-filter-input"
                      value={filterUpdatedAtTo}
                      onChange={(e) => setFilterUpdatedAtTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="community-tag-filter">
                <span className="community-filter-label">Tags</span>

                <div className="community-tag-filter-input-row">
                  <input
                    type="text"
                    className="community-filter-input"
                    placeholder="Add a tag..."
                    value={tagFilterInput}
                    onChange={(e) => setTagFilterInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddFilterTag();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="community-tag-add-button"
                    onClick={handleAddFilterTag}
                    disabled={!canAddFilterTag}
                    title={
                      tagFilterAlreadyExists
                        ? "That tag is already added"
                        : "Add tag"
                    }
                  >
                    +
                  </button>
                </div>

                <span className="community-filter-hint">
                  Matches projects with any of these tags.
                </span>

                {filterTags.length > 0 && (
                  <ul className="community-tag-list">
                    {filterTags.map((tag, index) => (
                      <li key={`${tag}-${index}`} className="community-tag-item">
                        <span className="community-tag-text">{tag}</span>
                        <button
                          type="button"
                          className="community-tag-remove-button"
                          onClick={() => handleRemoveFilterTag(index)}
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

              <div className="community-filter-actions">
                <button
                  type="button"
                  className="community-load-button"
                  onClick={handleSearchPublicProjects}
                >
                  Search Public Projects
                </button>
                <button
                  type="button"
                  className="community-filter-clear"
                  onClick={handleClearPublicFilters}
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {publicView === "profile" && selectedPublicProject ? (
              <>
                <RenderProjectProfile
                  project={selectedPublicProject}
                  engineLabel={
                    engineLabels[selectedPublicProject.engineKey] ||
                    selectedPublicProject.engineKey
                  }
                  isCurrentProject={
                    String(selectedPublicProject._id) === String(projectId)
                  }
                  currentProjectCount={currentProjectCount}
                  maxProjects={maxProjects}
                  system={system}
                  apis={apis}
                  onOwnerClick={openUserProfile}
                  isFavourited={isProjectFavourited(selectedPublicProject)}
                  onToggleFavourite={() =>
                    handleToggleFavourite({
                      project: selectedPublicProject,
                      isFavourited: isProjectFavourited(selectedPublicProject),
                      system,
                      apis,
                      setFavouriteProjects,
                    })
                  }
                  onUpdate={(patch) =>
                    applyProjectPatch({
                      id: selectedPublicProject._id,
                      patch,
                      setLists: [
                        setPublicProjects,
                        setProjects,
                        setSharedProjects,
                        setFavouriteProjects,
                      ],
                      setSchema,
                    })
                  }
                  onBack={() => setPublicView("list")}
                  onLoad={() =>
                    handleLoadProject({
                      selectedLoadId: selectedPublicId,
                      projectId,
                      system,
                      setProjectId,
                    })
                  }
                  onDelete={() =>
                    handleDeleteProject({
                      selectedDeleteId: selectedPublicId,
                      safeProjects,
                      projectId,
                      system,
                      apis,
                      setProjects,
                      setProjectId,
                      setSelectedDeleteId: setSelectedPublicId,
                    })
                  }
                  onClone={() =>
                    handleCloneProject({
                      project: selectedPublicProject,
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
                      project: selectedPublicProject,
                      system,
                      apis,
                    })
                  }
                />

                <RenderProjectPermissions
                  key={selectedPublicProject._id}
                  project={selectedPublicProject}
                  system={system}
                  apis={apis}
                  onUpdate={(patch) =>
                    applyProjectPatch({
                      id: selectedPublicProject._id,
                      patch,
                      setLists: [
                        setPublicProjects,
                        setProjects,
                        setSharedProjects,
                        setFavouriteProjects,
                      ],
                      setSchema,
                    })
                  }
                />
              </>
            ) : (
              <div className="community-panel" role="tabpanel">
                <div className="community-panel-heading">
                  <div>
                    <h2 className="community-panel-title">Results</h2>
                    <p className="community-panel-description">
                      {publicProjects === null
                        ? "Set filters above and search to see results."
                        : `${safePublicProjects.length} project${
                            safePublicProjects.length === 1 ? "" : "s"
                          } found.`}
                    </p>
                  </div>
                </div>

                {safePublicProjects.length > 0 ? (
                  <div className="community-grid">
                    {safePublicProjects.map((project) => (
                      <ProjectCard
                        key={project._id}
                        project={project}
                        selected={
                          String(selectedPublicId) === String(project._id)
                        }
                        onSelect={(id) => {
                          setSelectedPublicId(id);
                          setPublicView("profile");
                        }}
                        engineLabel={
                          engineLabels[project.engineKey] || project.engineKey
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="community-empty">
                    {publicProjects === null
                      ? "No search performed yet."
                      : "No public projects match your filters."}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "shared" && (
          <>
            {sharedView === "profile" && selectedSharedProject ? (
              <>
                <RenderProjectProfile
                  project={selectedSharedProject}
                  engineLabel={
                    engineLabels[selectedSharedProject.engineKey] ||
                    selectedSharedProject.engineKey
                  }
                  isCurrentProject={
                    String(selectedSharedProject._id) === String(projectId)
                  }
                  currentProjectCount={currentProjectCount}
                  maxProjects={maxProjects}
                  system={system}
                  apis={apis}
                  onOwnerClick={openUserProfile}
                  isFavourited={isProjectFavourited(selectedSharedProject)}
                  onToggleFavourite={() =>
                    handleToggleFavourite({
                      project: selectedSharedProject,
                      isFavourited: isProjectFavourited(selectedSharedProject),
                      system,
                      apis,
                      setFavouriteProjects,
                    })
                  }
                  onUpdate={(patch) =>
                    applyProjectPatch({
                      id: selectedSharedProject._id,
                      patch,
                      setLists: [setSharedProjects, setFavouriteProjects],
                      setSchema,
                    })
                  }
                  onBack={() => setSharedView("list")}
                  onLoad={() =>
                    handleLoadProject({
                      selectedLoadId: selectedSharedId,
                      projectId,
                      system,
                      setProjectId,
                    })
                  }
                  onClone={() =>
                    handleCloneProject({
                      project: selectedSharedProject,
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
                      project: selectedSharedProject,
                      system,
                      apis,
                    })
                  }
                />

                <RenderProjectPermissions
                  key={selectedSharedProject._id}
                  project={selectedSharedProject}
                  system={system}
                  apis={apis}
                  onUpdate={(patch) =>
                    applyProjectPatch({
                      id: selectedSharedProject._id,
                      patch,
                      setLists: [setSharedProjects, setFavouriteProjects],
                      setSchema,
                    })
                  }
                />
              </>
            ) : (
              <div className="community-panel" role="tabpanel">
                <div className="community-panel-heading">
                  <div>
                    <h2 className="community-panel-title">
                      Shared Projects
                    </h2>
                    <p className="community-panel-description">
                      Projects other users have shared with you.
                    </p>
                  </div>
                </div>

                {safeSharedProjects.length > 0 ? (
                  <div className="community-grid">
                    {safeSharedProjects.map((project) => (
                      <ProjectCard
                        key={project._id}
                        project={project}
                        selected={
                          String(selectedSharedId) === String(project._id)
                        }
                        onSelect={(id) => {
                          setSelectedSharedId(id);
                          setSharedView("profile");
                        }}
                        engineLabel={
                          engineLabels[project.engineKey] || project.engineKey
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="community-empty">
                    No shared projects available.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "favourites" && (
          <>
            {favouriteView === "profile" && selectedFavouriteProject ? (
              <>
                <RenderProjectProfile
                  project={selectedFavouriteProject}
                  engineLabel={
                    engineLabels[selectedFavouriteProject.engineKey] ||
                    selectedFavouriteProject.engineKey
                  }
                  isCurrentProject={
                    String(selectedFavouriteProject._id) === String(projectId)
                  }
                  currentProjectCount={currentProjectCount}
                  maxProjects={maxProjects}
                  system={system}
                  apis={apis}
                  onOwnerClick={openUserProfile}
                  isFavourited={isProjectFavourited(selectedFavouriteProject)}
                  onToggleFavourite={() =>
                    handleToggleFavourite({
                      project: selectedFavouriteProject,
                      isFavourited: isProjectFavourited(selectedFavouriteProject),
                      system,
                      apis,
                      setFavouriteProjects,
                    })
                  }
                  onUpdate={(patch) =>
                    applyProjectPatch({
                      id: selectedFavouriteProject._id,
                      patch,
                      setLists: [
                        setFavouriteProjects,
                        setProjects,
                        setSharedProjects,
                      ],
                      setSchema,
                    })
                  }
                  onBack={() => setFavouriteView("list")}
                  onLoad={() =>
                    handleLoadProject({
                      selectedLoadId: selectedFavouriteId,
                      projectId,
                      system,
                      setProjectId,
                    })
                  }
                  onClone={() =>
                    handleCloneProject({
                      project: selectedFavouriteProject,
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
                      project: selectedFavouriteProject,
                      system,
                      apis,
                    })
                  }
                />

                <RenderProjectPermissions
                  key={selectedFavouriteProject._id}
                  project={selectedFavouriteProject}
                  system={system}
                  apis={apis}
                  onUpdate={(patch) =>
                    applyProjectPatch({
                      id: selectedFavouriteProject._id,
                      patch,
                      setLists: [
                        setFavouriteProjects,
                        setProjects,
                        setSharedProjects,
                      ],
                      setSchema,
                    })
                  }
                />
              </>
            ) : (
              <div className="community-panel" role="tabpanel">
                <div className="community-panel-heading">
                  <div>
                    <h2 className="community-panel-title">Favourite Projects</h2>
                    <p className="community-panel-description">
                      Projects you've favourited, public or shared with you.
                    </p>
                  </div>
                </div>

                {safeFavouriteProjects.length > 0 ? (
                  <div className="community-grid">
                    {safeFavouriteProjects.map((project) => (
                      <ProjectCard
                        key={project._id}
                        project={project}
                        selected={
                          String(selectedFavouriteId) === String(project._id)
                        }
                        onSelect={(id) => {
                          setSelectedFavouriteId(id);
                          setFavouriteView("profile");
                        }}
                        engineLabel={
                          engineLabels[project.engineKey] || project.engineKey
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="community-empty">
                    No favourite projects yet. Star a project from its profile
                    to add it here.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "findUsers" && (
          <>
            <div className="community-panel" role="tabpanel">
              <div className="community-panel-heading">
                <div>
                  <h2 className="community-panel-title">Find Users</h2>
                  <p className="community-panel-description">
                    Search by username. Leave blank and search to browse
                    everyone.
                  </p>
                </div>
              </div>

              <div className="community-filter-group">
                <span className="community-filter-label">Username</span>
                <input
                  type="text"
                  className="community-filter-input"
                  placeholder="Search by username..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchUsers(1);
                    }
                  }}
                />
              </div>

              <div className="community-filter-actions">
                <button
                  type="button"
                  className="community-load-button"
                  onClick={() => handleSearchUsers(1)}
                >
                  Get Users
                </button>
              </div>
            </div>

            <div className="community-panel" role="tabpanel">
              <div className="community-panel-heading">
                <div>
                  <h2 className="community-panel-title">Results</h2>
                  <p className="community-panel-description">
                    {userSearchResults === null
                      ? "Search above to see results."
                      : `${userSearchResults.total} user${
                          userSearchResults.total === 1 ? "" : "s"
                        } found.`}
                  </p>
                </div>
              </div>

              {userSearchResults && userSearchResults.users.length > 0 ? (
                <>
                  <ul className="rup-user-list">
                    {userSearchResults.users.map((u) => (
                      <li key={u.userName} className="rup-user-list-item">
                        <UserBadge
                          userName={u.userName}
                          userColorTheme={u.userColorTheme}
                          onClick={() => openUserProfile(u.userName)}
                        />
                      </li>
                    ))}
                  </ul>

                  {userSearchResults.total > userSearchResults.pageSize && (
                    <div className="community-filter-actions">
                      <button
                        type="button"
                        className="community-filter-clear"
                        disabled={userSearchPage <= 1}
                        onClick={() => handleSearchUsers(userSearchPage - 1)}
                      >
                        Previous
                      </button>
                      <span className="community-panel-description">
                        Page {userSearchPage} of{" "}
                        {Math.ceil(
                          userSearchResults.total / userSearchResults.pageSize,
                        )}
                      </span>
                      <button
                        type="button"
                        className="community-load-button"
                        disabled={
                          userSearchPage * userSearchResults.pageSize >=
                          userSearchResults.total
                        }
                        onClick={() => handleSearchUsers(userSearchPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="community-empty">
                  {userSearchResults === null
                    ? "No search performed yet."
                    : "No users match your search."}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "following" && (
          <div className="community-panel" role="tabpanel">
            <div className="community-panel-heading">
              <div>
                <h2 className="community-panel-title">Following</h2>
                <p className="community-panel-description">
                  Users you follow.
                </p>
              </div>
            </div>

            {safeFollowing.length > 0 ? (
              <ul className="rup-user-list">
                {safeFollowing.map((u) => (
                  <li key={u.userName} className="rup-user-list-item">
                    <UserBadge
                      userName={u.userName}
                      userColorTheme={u.userColorTheme}
                      onClick={() => openUserProfile(u.userName)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="community-empty">
                You aren&apos;t following anyone yet.
              </div>
            )}
          </div>
        )}

        {activeTab === "followers" && (
          <div className="community-panel" role="tabpanel">
            <div className="community-panel-heading">
              <div>
                <h2 className="community-panel-title">Followers</h2>
                <p className="community-panel-description">
                  Users who follow you.
                </p>
              </div>
            </div>

            {safeFollowers.length > 0 ? (
              <ul className="rup-user-list">
                {safeFollowers.map((u) => (
                  <li key={u.userName} className="rup-user-list-item">
                    <UserBadge
                      userName={u.userName}
                      userColorTheme={u.userColorTheme}
                      onClick={() => openUserProfile(u.userName)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="community-empty">No followers yet.</div>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

export default Community;
