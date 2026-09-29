import { SUBSCRIPTION_LIMITS } from "../../../shared/validation/validationConstants.js";
import { validateProjectCreatePayload } from "../../../shared/validation/projectValidation.js";

export const ENGINE_DESCRIPTIONS = {
  places:
    "Best for mapping infrastructure, destinations, and features that exist continuously over time.",
  events:
    "Best for things that happen at a moment or over a time range, including festivals, concerts, meetings, and historical events.",
  neighbourhoods:
    "A polygon-based aggregation and analysis tool for working with area-level counts, comparisons, and experimental mapping workflows.",
  presence:
    "A live location tracking map for coordination, security teams, finding friends, and lightweight virtual hangout scenarios.",
  motion:
    "Best for recording saved movement routes over time, including walks, rides, field surveys, travel paths, and route observations.",
};

export function getRoleUserDisplayName(user) {
  if (typeof user === "object" && user) {
    return user.userName || "";
  }

  return String(user || "");
}

// Splits a list of owned projects into private/public/open groups, each
// keeping the order it was given in (the owned-projects route already
// sorts by updatedAt, so each group stays sorted by updatedAt too).
export function groupProjectsByVisibility(projects) {
  const safe = Array.isArray(projects) ? projects : [];
  return {
    private: safe.filter((p) => p.visibility === "private"),
    public: safe.filter((p) => p.visibility === "public"),
    open: safe.filter((p) => p.visibility === "open"),
  };
}

export function normalizeRoleUser(user) {
  if (typeof user === "object" && user) {
    return {
      userName: user.userName || "",
      userColorTheme: user.userColorTheme || "green",
    };
  }

  return {
    userName: String(user || ""),
    userColorTheme: "green",
  };
}

function getMaxProjectsForUser(user) {
  const tier = String(user?.subscriptionTier || "free")
    .trim()
    .toLowerCase();

  return (
    SUBSCRIPTION_LIMITS.maxProjectsByTier[tier] ??
    SUBSCRIPTION_LIMITS.maxProjectsByTier.free
  );
}

export function getVisibilityDescription(visibility) {
  if (visibility === "private") {
    return "Private projects require explicit access. Only assigned users can view or contribute.";
  }

  if (visibility === "public") {
    return "Public projects can be viewed by anyone, but only editor, admin, and owner roles can modify project data.";
  }

  if (visibility === "open") {
    return "⚠️ Open projects can be viewed by anyone, and public users are treated like editors for regular project data.";
  }

  return "";
}

export function handleLoadProject({
  selectedLoadId,
  projectId,
  system,
  setProjectId,
}) {
  if (!selectedLoadId) {
    system?.notify?.("Select a project to load.");
    return;
  }

  if (String(selectedLoadId) === String(projectId)) {
    system?.notify?.("That project is already loaded.");
    return;
  }

  system?.notify?.("Project changed");
  setProjectId(selectedLoadId);
  system?.startLoading?.("Switching Project...");
}

export async function handleDeleteProject({
  selectedDeleteId,
  safeProjects,
  projectId,
  system,
  apis,
  setProjects,
  setProjectId,
  setSelectedDeleteId,
}) {
  if (!selectedDeleteId) {
    system?.notify?.("Select a project to delete.");
    return;
  }

  if (safeProjects.length <= 1) {
    system?.notify?.("You must have at least one project.");
    return;
  }

  const project = safeProjects.find(
    (p) => String(p._id) === String(selectedDeleteId),
  );

  const confirmed = await system.confirm({
  message:
    `Delete project "${project?.projectName}"?\n\n` +
    "All project data, images, and extension data will be permanently deleted.\n\n" +
    "This cannot be undone.",
  confirmText: "Delete Project",
  cancelText: "Cancel",
});

  if (!confirmed) return;

  try {
    system?.startLoading?.("Removing Project...");
    const { data, message } = await apis.projectApi.remove(selectedDeleteId);

    if (!data?._id) {
      system?.notify?.("Delete failed.");
      return;
    }

    const updatedProjects = safeProjects.filter(
      (p) => String(p._id) !== String(selectedDeleteId),
    );

    setProjects(updatedProjects);

    if (String(selectedDeleteId) === String(projectId)) {
      if (updatedProjects.length > 0) {
        setProjectId(updatedProjects[0]._id);
        system?.startLoading?.("Switching Project...");
      } else {
        setProjectId(null);
      }
    }

    setSelectedDeleteId(null);

    if (message) {
      message.split("\n").forEach((line) => {
        if (line.trim()) system?.notify?.(line);
      });
    }
  } catch (err) {
    console.error(err);
    system?.notify?.("Delete failed.");
  }
}

export async function handleCreateProject({
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
  setSelectedLoadId,
}) {
  const projectName = String(newProjectName || "").trim();

  if (!projectName) {
    system?.notify?.("Enter a project name.");
    return;
  }

  const maxProjects = getMaxProjectsForUser(user);

  if ((safeProjects || []).length >= maxProjects) {
    system?.notify?.(`You have reached your project limit (${maxProjects}).`);
    return;
  }

  const confirmed = await system.confirm({
    message:
      "Creating a new project will switch context. Any unsaved changes will be lost. Continue?",
    confirmText: "Create",
    cancelText: "Cancel",
  });

  if (!confirmed) return;

  const payload = {
    engineKey: newEngineKey,
    projectName,
    projectDescription: newProjectDescription || "",
    projectTags: Array.isArray(newProjectTags) ? newProjectTags : [],
    visibility: newVisibility || "private",
  };

  if (!validateProjectCreatePayload(payload)) {
    system?.notify?.("Invalid project details.");
    return;
  }

  try {
    system?.startLoading?.("Creating Project...");

    const { data, message } = await apis.projectApi.add(payload);
    system?.notify?.(message);

    if (!data?._id) {
      system?.notify?.("Project creation failed.");
      return;
    }

    const newMetaProject = {
      _id: data._id,
      projectName: payload.projectName,
      projectDescription: payload.projectDescription,
      projectTags: payload.projectTags,
      engineKey: payload.engineKey,
      userRole: "owner",
      visibility: payload.visibility,
      owner: user?.userName || "",
      ownerColorTheme: user?.userColorTheme || "green",
      adminRole: [],
      editorRole: [],
      viewerRole: [],
      updatedAt: data.updatedAt || new Date().toISOString(),
      configUpdatedAt: data.configUpdatedAt || new Date().toISOString(),
    };

    setProjects([...(safeProjects || []), newMetaProject]);

    setProjectId(data._id);
    system?.startLoading?.("Switching Project...");

    setNewProjectName("");
    setNewProjectDescription?.("");
    setNewProjectTags?.([]);
    setSelectedLoadId(data._id);
  } catch (err) {
    console.error(err);
    system?.notify?.("Create failed.");
  }
}

export async function handleCloneCurrentProject({
  projectId,
  schema,
  safeProjects,
  user,
  system,
  apis,
  setProjects,
  setProjectId,
}) {
  if (!projectId || !schema) {
    system?.notify?.("No project loaded.");
    return;
  }

  const maxProjects = getMaxProjectsForUser(user);

  if ((safeProjects || []).length >= maxProjects) {
    system?.notify?.(`You have reached your project limit (${maxProjects}).`);
    return;
  }

  const confirmed = await system.confirm({
    message:
      "This will create a new project under your account.\n\n" +
      "Are you sure you want to proceed?",
    confirmText: "Clone Project",
    cancelText: "Cancel",
  });

  if (!confirmed) return;

  try {
    system?.startLoading?.("Cloning Project...");

    const { data, message } = await apis.projectApi.clone(projectId);

    system?.notify?.(message || "Project cloned.");

    if (!data?._id) {
      system?.notify?.("Clone failed.");
      return;
    }

    const baseProjectName = String(schema.projectName || "Untitled Project")
      .trim();

    const newMetaProject = {
      _id: data._id,
      projectName: `${baseProjectName} Copy`,
      projectDescription: schema.projectDescription || "",
      projectTags: Array.isArray(schema.projectTags) ? [...schema.projectTags] : [],
      engineKey: schema.engineKey,
      userRole: "owner",
      visibility: "private",
      owner: user?.userName || "",
      ownerColorTheme: user?.userColorTheme || "green",
      adminRole: [],
      editorRole: [],
      viewerRole: [],
      updatedAt: data.updatedAt || new Date().toISOString(),
      configUpdatedAt: data.configUpdatedAt || new Date().toISOString(),
    };

    setProjects([...(safeProjects || []), newMetaProject]);
    setProjectId(data._id);
    system?.startLoading?.("Switching Project...");
  } catch (err) {
    console.error(err);
    system?.notify?.("Clone failed.");
  } finally {
    system?.stopLoading?.();
  }
}

export async function handleExportCurrentProject({
  projectId,
  schema,
  system,
  apis,
}) {
  if (!projectId) {
    system?.notify?.("No exportable project loaded.");
    return;
  }

  try {
    system?.startLoading?.("Exporting Project...");

    const { data, message } = await apis.projectApi.export(projectId);

    if (!(data instanceof Blob)) {
      system?.notify?.(message || "Export failed.");
      return;
    }

    const safeProjectName = String(schema?.projectName || "project")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-");

    const url = window.URL.createObjectURL(data);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${safeProjectName || "project"}-${projectId}.geojson`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);

    if (schema?.engineKey === "presence") {
      system?.notify?.(message || "Presence project schema exported.");
    } else {
      system?.notify?.(message || "Project exported.");
    }
  } catch (err) {
    console.error(err);
    system?.notify?.("Export failed.");
  } finally {
    system?.stopLoading?.();
  }
}

export async function handleCloneProject({
  project,
  safeProjects,
  user,
  system,
  apis,
  setProjects,
  setProjectId,
}) {
  if (!project?._id) {
    system?.notify?.("No project selected.");
    return;
  }

  const maxProjects = getMaxProjectsForUser(user);

  if ((safeProjects || []).length >= maxProjects) {
    system?.notify?.(`You have reached your project limit (${maxProjects}).`);
    return;
  }

  const confirmed = await system.confirm({
    message:
      "This will create a new project under your account.\n\n" +
      "Are you sure you want to proceed?",
    confirmText: "Clone Project",
    cancelText: "Cancel",
  });

  if (!confirmed) return;

  try {
    system?.startLoading?.("Cloning Project...");

    const { data, message } = await apis.projectApi.clone(project._id);

    system?.notify?.(message || "Project cloned.");

    if (!data?._id) {
      system?.notify?.("Clone failed.");
      return;
    }

    const baseProjectName = String(
      project.projectName || "Untitled Project",
    ).trim();

    const newMetaProject = {
      _id: data._id,
      projectName: `${baseProjectName} Copy`,
      projectDescription: project.projectDescription || "",
      projectTags: Array.isArray(project.projectTags) ? [...project.projectTags] : [],
      engineKey: project.engineKey,
      userRole: "owner",
      visibility: "private",
      owner: user?.userName || "",
      ownerColorTheme: user?.userColorTheme || "green",
      adminRole: [],
      editorRole: [],
      viewerRole: [],
      updatedAt: data.updatedAt || new Date().toISOString(),
      configUpdatedAt: data.configUpdatedAt || new Date().toISOString(),
    };

    setProjects([...(safeProjects || []), newMetaProject]);
    setProjectId(data._id);
    system?.startLoading?.("Switching Project...");
  } catch (err) {
    console.error(err);
    system?.notify?.("Clone failed.");
  } finally {
    system?.stopLoading?.();
  }
}

export async function handleExportProject({ project, system, apis }) {
  if (!project?._id) {
    system?.notify?.("No exportable project selected.");
    return;
  }

  try {
    system?.startLoading?.("Exporting Project...");

    const { data, message } = await apis.projectApi.export(project._id);

    if (!(data instanceof Blob)) {
      system?.notify?.(message || "Export failed.");
      return;
    }

    const safeProjectName = String(project.projectName || "project")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-");

    const url = window.URL.createObjectURL(data);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${safeProjectName || "project"}-${project._id}.geojson`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);

    if (project.engineKey === "presence") {
      system?.notify?.(message || "Presence project schema exported.");
    } else {
      system?.notify?.(message || "Project exported.");
    }
  } catch (err) {
    console.error(err);
    system?.notify?.("Export failed.");
  } finally {
    system?.stopLoading?.();
  }
}

// Applies a permissions/visibility patch to whichever state holds this
// project: any lightweight list(s) it may appear in, and the loaded schema
// if it's the same project (a project can be edited while a different one,
// or this same one, is currently loaded).
export function applyProjectPatch({ id, patch, setLists = [], setSchema }) {
  setLists.forEach((setList) => {
    setList?.((prev) =>
      (Array.isArray(prev) ? prev : []).map((p) =>
        String(p._id) === String(id) ? { ...p, ...patch } : p,
      ),
    );
  });

  setSchema?.((prev) => {
    if (!prev || String(prev._id) !== String(id)) return prev;
    return { ...prev, ...patch };
  });
}

// Favourites are optimistic: the caller already has the full lightweight
// project object in hand (from whatever list it was rendered from), so
// adding just appends it locally rather than refetching the whole list.
export async function handleToggleFavourite({
  project,
  isFavourited,
  system,
  apis,
  setFavouriteProjects,
}) {
  if (!project?._id) return;

  try {
    if (isFavourited) {
      const { message } = await apis.usersApi.removeFavouriteProject(project._id);
      system?.notify?.(message);
      setFavouriteProjects?.((prev) =>
        (Array.isArray(prev) ? prev : []).filter(
          (p) => String(p._id) !== String(project._id),
        ),
      );
    } else {
      const { data, message } = await apis.usersApi.addFavouriteProject(project._id);
      system?.notify?.(message);
      if (!data) return;
      setFavouriteProjects?.((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        if (safePrev.some((p) => String(p._id) === String(project._id))) {
          return safePrev;
        }
        return [project, ...safePrev];
      });
    }
  } catch (err) {
    console.error("Toggle favourite failed:", err);
    system?.notify?.("Failed to update favourites.");
  }
}

export async function handleSaveProjectSettings({
  project,
  projectName,
  projectDescription,
  projectTags,
  system,
  apis,
  onSuccess,
}) {
  if (!project?._id || !project?.configUpdatedAt) {
    system?.notify?.("No project loaded.");
    return;
  }

  system?.startLoading?.("Saving project settings...");

  try {
    const { data, message } = await apis.projectApi.updateProjectSettings(
      project._id,
      projectName,
      projectDescription,
      projectTags,
      project.configUpdatedAt,
    );

    system?.notify?.(message || "Project settings updated.");

    if (!data?._id) return;

    onSuccess?.({
      projectName: data.projectName,
      projectDescription: data.projectDescription,
      projectTags: data.projectTags,
      updatedAt: data.updatedAt,
      configUpdatedAt: data.configUpdatedAt,
    });
  } catch (err) {
    console.error(err);
    system?.notify?.("Failed to update project settings.");
  } finally {
    system?.stopLoading?.();
  }
}

export async function handleSaveVisibility({
  project,
  visibility,
  system,
  apis,
  onSuccess,
}) {
  if (!project?._id || !visibility || !project?.configUpdatedAt) {
    system?.notify?.("No project loaded.");
    return;
  }

  system?.startLoading?.("Updating visibility...");

  try {
    const { data, message } = await apis.projectApi.updateVisibility(
      project._id,
      visibility,
      project.configUpdatedAt,
    );

    system?.notify?.(message || "Visibility updated.");

    if (!data?._id) return;

    onSuccess?.({
      visibility,
      updatedAt: data.updatedAt,
      configUpdatedAt: data.configUpdatedAt,
    });
  } catch (err) {
    console.error(err);
    system?.notify?.("Failed to update visibility.");
  } finally {
    system?.stopLoading?.();
  }
}

export async function handleAddRoleUser({
  roleKey,
  userName,
  project,
  viewerRoleLocked,
  system,
  apis,
  onSuccess,
}) {
  const trimmed = String(userName || "").trim();

  if (!project?._id || !project?.configUpdatedAt) {
    system?.notify?.("No project loaded.");
    return;
  }

  if (!trimmed) {
    system?.notify?.("Enter a username.");
    return;
  }

  if (roleKey === "viewerRole" && viewerRoleLocked) {
    system?.notify?.(
      "Viewer permissions do not apply to public or open projects.",
    );
    return;
  }

  system?.startLoading?.("Updating permissions...");

  try {
    const { data, message } = await apis.projectApi.addProjectRole(
      project._id,
      roleKey,
      trimmed,
      project.configUpdatedAt,
    );

    system?.notify?.(message || "Role updated.");

    if (!data?._id) return;

    const addedRoleUser = normalizeRoleUser({
      userName: data.userName,
    });

    const currentRoleUsers = Array.isArray(project[roleKey])
      ? project[roleKey]
      : [];

    const alreadyExists = currentRoleUsers.some((roleUser) => {
      const existingName = getRoleUserDisplayName(roleUser);

      return String(existingName) === String(addedRoleUser.userName);
    });

    const nextRoleUsers = alreadyExists
      ? currentRoleUsers
      : [...currentRoleUsers, addedRoleUser];

    onSuccess?.({
      [roleKey]: nextRoleUsers,
      updatedAt: data.updatedAt,
      configUpdatedAt: data.configUpdatedAt,
    });
  } catch (err) {
    console.error(err);
    system?.notify?.("Failed to update role.");
  } finally {
    system?.stopLoading?.();
  }
}

export async function handleRemoveRoleUser({
  roleKey,
  roleUser,
  project,
  viewerRoleLocked,
  system,
  apis,
  onSuccess,
}) {
  const resolvedUser = normalizeRoleUser(roleUser);
  const resolvedUserName = String(resolvedUser.userName || "").trim();

  if (!project?._id || !project?.configUpdatedAt) {
    system?.notify?.("No project loaded.");
    return;
  }

  if (!resolvedUserName) {
    system?.notify?.("Missing username.");
    return;
  }

  if (roleKey === "viewerRole" && viewerRoleLocked) {
    system?.notify?.(
      "Viewer permissions do not apply to public or open projects.",
    );
    return;
  }

  system?.startLoading?.("Updating permissions...");

  try {
    const { data, message } = await apis.projectApi.removeProjectRole(
      project._id,
      roleKey,
      {
        userName: resolvedUserName,
      },
      project.configUpdatedAt,
    );

    system?.notify?.(message || "Role updated.");

    if (!data?._id) return;

    const currentRoleUsers = Array.isArray(project[roleKey])
      ? project[roleKey]
      : [];

    onSuccess?.({
      [roleKey]: currentRoleUsers.filter((roleUser) => {
        const existingName = getRoleUserDisplayName(roleUser);

        return String(existingName) !== String(resolvedUserName);
      }),
      updatedAt: data.updatedAt,
      configUpdatedAt: data.configUpdatedAt,
    });
  } catch (err) {
    console.error(err);
    system?.notify?.("Failed to update role.");
  } finally {
    system?.stopLoading?.();
  }
}
