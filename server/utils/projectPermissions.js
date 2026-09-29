export function hasProjectAccess(project, authUserId, requiredRole = "viewer") {
  const authUserIdString = String(authUserId);

  const isOwner = String(project?.projectOwnerId) === authUserIdString;

  const isPublic = project?.visibility === "public";
  const isOpen = project?.visibility === "open";

  const viewerRole = Array.isArray(project?.viewerRole) ? project.viewerRole : [];
  const editorRole = Array.isArray(project?.editorRole) ? project.editorRole : [];
  const adminRole = Array.isArray(project?.adminRole) ? project.adminRole : [];

  const hasViewerRole = viewerRole.some(
    (roleUser) => String(roleUser?._id) === authUserIdString,
  );

  const hasEditorRole = editorRole.some(
    (roleUser) => String(roleUser?._id) === authUserIdString,
  );

  const hasAdminRole = adminRole.some(
    (roleUser) => String(roleUser?._id) === authUserIdString,
  );

  let resolvedRole = null;

  if (isOwner) {
    resolvedRole = "owner";
  } else if (hasAdminRole) {
    resolvedRole = "admin";
  } else if (hasEditorRole) {
    resolvedRole = "editor";
  } else if (hasViewerRole) {
    resolvedRole = "viewer";
  } else if (isOpen) {
    resolvedRole = "editor";
  } else if (isPublic) {
    resolvedRole = "viewer";
  }

  const roleRank = {
    viewer: 1,
    editor: 2,
    admin: 3,
    owner: 4,
  };

  const hasAccess =
    resolvedRole !== null &&
    roleRank[resolvedRole] >= roleRank[requiredRole];

  return {
    hasAccess,
    resolvedRole,
    isOwner,
    isAdmin: resolvedRole === "admin" || resolvedRole === "owner",
    isEditor:
      resolvedRole === "editor" ||
      resolvedRole === "admin" ||
      resolvedRole === "owner",
    isViewer: resolvedRole !== null,
    isPublic,
    isOpen,
  };
}

