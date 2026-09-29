// src/workspace/community/userProfileHelpers.js

// Splits another user's visible-to-me projects into public/open/shared
// groups. A project can appear in more than one group (a public project I'm
// also an admin on shows in both Public and Shared) since these describe
// different, independent reasons the project is visible to me.
export function groupUserProjectsForViewing(projects) {
  const safe = Array.isArray(projects) ? projects : [];
  return {
    public: safe.filter((p) => p.visibility === "public"),
    open: safe.filter((p) => p.visibility === "open"),
    shared: safe.filter((p) => p.isSharedWithMe),
  };
}

export async function loadUserProfile({ userName, system, apis, setProfile }) {
  try {
    const { data, message } = await apis.usersApi.getUserProfile(userName);

    if (!data) {
      system?.notify?.(message || "User not found.");
      setProfile(null);
      return;
    }

    setProfile(data);
  } catch (err) {
    console.error("Load user profile failed:", err);
    system?.notify?.("Failed to load user profile.");
    setProfile(null);
  }
}

export async function loadUserProjects({ userName, system, apis, setProjects }) {
  try {
    const { data, message } = await apis.usersApi.getUserProjects(userName);

    if (message) system?.notify?.(message);

    setProjects(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("Load user projects failed:", err);
    system?.notify?.("Failed to load user's projects.");
    setProjects([]);
  }
}

export async function loadUserFavouriteProjects({
  userName,
  system,
  apis,
  setFavourites,
}) {
  try {
    const { data, message } = await apis.usersApi.getUserFavouriteProjects(userName);

    if (message) system?.notify?.(message);

    setFavourites(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("Load user favourite projects failed:", err);
    system?.notify?.("Failed to load user's favourite projects.");
    setFavourites([]);
  }
}

export async function searchCommunityUsers({
  username,
  page,
  system,
  apis,
  setResults,
}) {
  system?.startLoading?.("Searching Users...");

  try {
    const { data, message } = await apis.usersApi.searchUsers(username, page);

    if (message) system?.notify?.(message);

    setResults(data || { users: [], total: 0, page: 1, pageSize: 50 });
  } catch (err) {
    console.error("Search users failed:", err);
    system?.notify?.("Failed to search users.");
    setResults({ users: [], total: 0, page: 1, pageSize: 50 });
  } finally {
    system?.stopLoading?.();
  }
}

/* ─────────────────────────────
   Follow / Unfollow / Remove Follower
   Each optimistically patches the current user's own following/followers
   list (via setUser) and the profile being viewed (via onProfilePatch),
   so both stay in sync without a full refetch.
───────────────────────────── */
export async function handleFollowUser({
  targetUserName,
  me,
  system,
  apis,
  setUser,
  onProfilePatch,
}) {
  try {
    const { data, message } = await apis.usersApi.followUser(targetUserName);

    if (!data) {
      system?.notify?.(message || "Failed to follow user.");
      return;
    }

    setUser?.((prev) =>
      prev
        ? {
            ...prev,
            following: [
              ...(Array.isArray(prev.following) ? prev.following : []),
              { userName: data.userName, userColorTheme: data.userColorTheme },
            ],
          }
        : prev,
    );

    onProfilePatch?.((prev) =>
      prev
        ? {
            ...prev,
            isFollowedByMe: true,
            followers: [
              ...(Array.isArray(prev.followers) ? prev.followers : []),
              { userName: me.userName, userColorTheme: me.userColorTheme },
            ],
          }
        : prev,
    );

    system?.notify?.(message || "User followed.");
  } catch (err) {
    console.error("Follow user failed:", err);
    system?.notify?.("Failed to follow user.");
  }
}

export async function handleUnfollowUser({
  targetUserName,
  me,
  system,
  apis,
  setUser,
  onProfilePatch,
}) {
  try {
    const { message } = await apis.usersApi.unfollowUser(targetUserName);

    setUser?.((prev) =>
      prev
        ? {
            ...prev,
            following: (Array.isArray(prev.following) ? prev.following : []).filter(
              (ref) => ref.userName.toLowerCase() !== targetUserName.toLowerCase(),
            ),
          }
        : prev,
    );

    onProfilePatch?.((prev) =>
      prev
        ? {
            ...prev,
            isFollowedByMe: false,
            followers: (Array.isArray(prev.followers) ? prev.followers : []).filter(
              (ref) => ref.userName.toLowerCase() !== me.userName.toLowerCase(),
            ),
          }
        : prev,
    );

    system?.notify?.(message || "User unfollowed.");
  } catch (err) {
    console.error("Unfollow user failed:", err);
    system?.notify?.("Failed to unfollow user.");
  }
}

export async function handleBlockUser({
  targetUserName,
  system,
  apis,
  setUser,
  onBlocked,
}) {
  const confirmed = await system.confirm({
    message: `Block ${targetUserName}? They won't be able to see your profile or projects, and you won't see theirs. This also removes any shared-project access between you.`,
    confirmText: "Block",
    cancelText: "Cancel",
  });

  if (!confirmed) return;

  try {
    const { message } = await apis.usersApi.blockUser(targetUserName);

    setUser?.((prev) =>
      prev
        ? {
            ...prev,
            following: (Array.isArray(prev.following) ? prev.following : []).filter(
              (ref) => ref.userName.toLowerCase() !== targetUserName.toLowerCase(),
            ),
            followers: (Array.isArray(prev.followers) ? prev.followers : []).filter(
              (ref) => ref.userName.toLowerCase() !== targetUserName.toLowerCase(),
            ),
          }
        : prev,
    );

    system?.notify?.(message || "User blocked.");
    onBlocked?.();
  } catch (err) {
    console.error("Block user failed:", err);
    system?.notify?.("Failed to block user.");
  }
}

export async function handleRemoveFollower({
  targetUserName,
  me,
  system,
  apis,
  setUser,
  onProfilePatch,
}) {
  try {
    const { message } = await apis.usersApi.removeFollower(targetUserName);

    setUser?.((prev) =>
      prev
        ? {
            ...prev,
            followers: (Array.isArray(prev.followers) ? prev.followers : []).filter(
              (ref) => ref.userName.toLowerCase() !== targetUserName.toLowerCase(),
            ),
          }
        : prev,
    );

    onProfilePatch?.((prev) =>
      prev
        ? {
            ...prev,
            isFollowingMe: false,
            following: (Array.isArray(prev.following) ? prev.following : []).filter(
              (ref) => ref.userName.toLowerCase() !== me.userName.toLowerCase(),
            ),
          }
        : prev,
    );

    system?.notify?.(message || "Follower removed.");
  } catch (err) {
    console.error("Remove follower failed:", err);
    system?.notify?.("Failed to remove follower.");
  }
}
