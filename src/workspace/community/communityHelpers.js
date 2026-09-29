export async function loadCommunityProjects({
  system,
  apis,
  setPublicProjects,
  filters = {},
}) {
  system?.startLoading?.("Searching Public Projects...");

  try {
    const publicResult = await apis?.projectApi?.getPublicProjects?.(filters);

    if (publicResult?.message) {
      system?.notify?.(publicResult.message);
    }

    setPublicProjects(Array.isArray(publicResult?.data) ? publicResult.data : []);
  } catch (err) {
    console.error("Community project load failed:", err);
    system?.notify?.("Failed to load public projects.");
    setPublicProjects([]);
  } finally {
    system?.stopLoading?.();
  }
}

export function handleLoadCommunityProject({
  selectedId,
  projectId,
  setProjectId,
  system,
  emptyMessage,
}) {
  if (!selectedId) {
    system?.notify?.(emptyMessage || "Select a project.");
    return;
  }

  if (String(selectedId) === String(projectId)) {
    system?.notify?.("That project is already loaded.");
    return;
  }

  setProjectId(selectedId);
  system?.notify?.("Project changed");
  system?.startLoading?.("Switching Project...");
}