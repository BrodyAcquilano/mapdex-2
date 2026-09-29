import { useEffect, useMemo, useState } from "react";
import RenderProjectProfile from "./renderProjectProfile.jsx";
import RenderProjectPermissions from "./renderProjectPermissions.jsx";
import RenderUserProfile from "./renderUserProfile.jsx";
import {
  applyProjectPatch,
  handleCloneProject,
  handleDeleteProject,
  handleExportProject,
  handleLoadProject,
  handleToggleFavourite,
} from "./projectHelpers.js";
import {
  loadUserProfile,
  loadUserProjects,
  loadUserFavouriteProjects,
  handleFollowUser,
  handleUnfollowUser,
  handleRemoveFollower,
  handleBlockUser,
} from "../community/userProfileHelpers.js";

/* ─────────────────────────────
   Renders whatever is on top of a shared user/project navigation stack.
   Used by Community and the account's own profile page so that clicking a
   project owner, a follower, or a project card from any of those surfaces
   drills into the same profile viewer, with Back/Home controls managed by
   the stack itself.
───────────────────────────── */
function CommunityProfileViewer({
  stack,
  setStack,
  engineLabels = {},
  system,
  apis,
  setSchema,
  projectId,
  setProjectId,
  safeProjects,
  setProjects,
  setSharedProjects,
  favouriteProjects,
  setFavouriteProjects,
  user,
  setUser,
  currentProjectCount,
  maxProjects,
  homeStack = [],
  rootStackLength = 0,
}) {
  const top = stack[stack.length - 1] || null;

  const [viewedProfile, setViewedProfile] = useState(null);
  const [viewedProfileProjects, setViewedProfileProjects] = useState(null);
  const [viewedProfileFavourites, setViewedProfileFavourites] = useState(null);

  const isSelf =
    top?.type === "user" &&
    String(top.userName).toLowerCase() ===
      String(user?.userName || "").toLowerCase();

  // Derived live from `user` (rather than copied into state once) so an
  // unfollow/remove-follower on your own profile re-renders immediately
  // instead of waiting for a refetch or a full page reload.
  const selfProfile = useMemo(() => {
    if (!isSelf) return null;
    return {
      userName: user.userName,
      userColorTheme: user.userColorTheme,
      followers: Array.isArray(user.followers) ? user.followers : [],
      following: Array.isArray(user.following) ? user.following : [],
      isFollowedByMe: false,
      isFollowingMe: false,
    };
  }, [isSelf, user?.userName, user?.userColorTheme, user?.followers, user?.following]);

  const profile = isSelf ? selfProfile : viewedProfile;
  const profileProjects = isSelf ? safeProjects : viewedProfileProjects;
  const profileFavourites = isSelf
    ? Array.isArray(favouriteProjects)
      ? favouriteProjects
      : []
    : viewedProfileFavourites;

  useEffect(() => {
    if (!top || top.type !== "user" || isSelf) return;

    setViewedProfile(null);
    setViewedProfileProjects(null);
    setViewedProfileFavourites(null);

    loadUserProfile({
      userName: top.userName,
      system,
      apis,
      setProfile: setViewedProfile,
    });

    loadUserProjects({
      userName: top.userName,
      system,
      apis,
      setProjects: setViewedProfileProjects,
    });

    loadUserFavouriteProjects({
      userName: top.userName,
      system,
      apis,
      setFavourites: setViewedProfileFavourites,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top?.type, top?.userName, isSelf]);

  function pushUser(userName) {
    setStack((prev) => [...prev, { type: "user", userName }]);
  }

  function pushProject(project) {
    setStack((prev) => [...prev, { type: "project", project }]);
  }

  function goBack() {
    setStack((prev) => prev.slice(0, -1));
  }

  function goHome() {
    setStack(homeStack);
  }

  function patchStackTopProject(patch) {
    setStack((prev) => {
      const next = [...prev];
      const idx = next.length - 1;
      if (next[idx]?.type === "project") {
        next[idx] = { ...next[idx], project: { ...next[idx].project, ...patch } };
      }
      return next;
    });
  }

  if (!top) return null;

  if (top.type === "user") {
    return (
      <RenderUserProfile
        userName={top.userName}
        isSelf={isSelf}
        profile={profile}
        projects={profileProjects}
        favourites={profileFavourites}
        engineLabels={engineLabels}
        onBack={stack.length > rootStackLength ? goBack : undefined}
        onHome={stack.length > rootStackLength ? goHome : undefined}
        onUserClick={pushUser}
        onProjectClick={pushProject}
        onFollow={(targetUserName) =>
          handleFollowUser({
            targetUserName,
            me: user,
            system,
            apis,
            setUser,
            onProfilePatch: isSelf ? undefined : setViewedProfile,
          })
        }
        onUnfollow={(targetUserName) =>
          handleUnfollowUser({
            targetUserName,
            me: user,
            system,
            apis,
            setUser,
            onProfilePatch: isSelf ? undefined : setViewedProfile,
          })
        }
        onRemoveFollower={(targetUserName) =>
          handleRemoveFollower({
            targetUserName,
            me: user,
            system,
            apis,
            setUser,
            onProfilePatch: isSelf ? undefined : setViewedProfile,
          })
        }
        onBlock={(targetUserName) =>
          handleBlockUser({
            targetUserName,
            system,
            apis,
            setUser,
            onBlocked: goBack,
          })
        }
      />
    );
  }

  const project = top.project;

  const isFavourited = (favouriteProjects || []).some(
    (p) => String(p._id) === String(project._id),
  );

  return (
    <>
      <RenderProjectProfile
        project={project}
        engineLabel={engineLabels[project.engineKey] || project.engineKey}
        isCurrentProject={String(project._id) === String(projectId)}
        currentProjectCount={currentProjectCount}
        maxProjects={maxProjects}
        system={system}
        apis={apis}
        onBack={stack.length > rootStackLength ? goBack : undefined}
        onHome={stack.length > rootStackLength ? goHome : undefined}
        onOwnerClick={pushUser}
        isFavourited={isFavourited}
        onToggleFavourite={() =>
          handleToggleFavourite({
            project,
            isFavourited,
            system,
            apis,
            setFavouriteProjects,
          })
        }
        onLoad={() =>
          handleLoadProject({
            selectedLoadId: project._id,
            projectId,
            system,
            setProjectId,
          })
        }
        onDelete={
          project.userRole === "owner"
            ? () =>
                handleDeleteProject({
                  selectedDeleteId: project._id,
                  safeProjects,
                  projectId,
                  system,
                  apis,
                  setProjects,
                  setProjectId,
                  setSelectedDeleteId: goBack,
                })
            : undefined
        }
        onClone={() =>
          handleCloneProject({
            project,
            safeProjects,
            user,
            system,
            apis,
            setProjects,
            setProjectId,
          })
        }
        onExport={() => handleExportProject({ project, system, apis })}
        onUpdate={(patch) => {
          applyProjectPatch({
            id: project._id,
            patch,
            setLists: [setProjects, setSharedProjects, setFavouriteProjects],
            setSchema,
          });
          patchStackTopProject(patch);
        }}
      />

      <RenderProjectPermissions
        key={project._id}
        project={project}
        system={system}
        apis={apis}
        onUpdate={(patch) => {
          applyProjectPatch({
            id: project._id,
            patch,
            setLists: [setProjects, setSharedProjects, setFavouriteProjects],
            setSchema,
          });
          patchStackTopProject(patch);
        }}
      />
    </>
  );
}

export default CommunityProfileViewer;
