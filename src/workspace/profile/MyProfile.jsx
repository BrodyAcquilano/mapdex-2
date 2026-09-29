import { useEffect, useMemo, useState } from "react";
import { getEngineList } from "../../engines";
import CommunityProfileViewer from "../projects/CommunityProfileViewer.jsx";
import "../projects/Projects.css";
import { SUBSCRIPTION_LIMITS } from "../../../shared/validation/validationConstants.js";

function MyProfile({
  setCurrentPage,
  system,
  apis,
  setSchema,
  projectId,
  setProjectId,
  projects,
  setProjects,
  setSharedProjects,
  favouriteProjects,
  setFavouriteProjects,
  user,
  setUser,
}) {
  useEffect(() => {
    setCurrentPage("profile");
  }, [setCurrentPage]);

  const rootStack = useMemo(
    () => [{ type: "user", userName: user?.userName || "" }],
    [user?.userName],
  );

  const [navStack, setNavStack] = useState(rootStack);

  useEffect(() => {
    setNavStack(rootStack);
  }, [rootStack]);

  const safeProjects = Array.isArray(projects) ? projects : [];
  const userTier = String(user?.subscriptionTier || "free")
    .trim()
    .toLowerCase();

  const maxProjects =
    SUBSCRIPTION_LIMITS.maxProjectsByTier[userTier] ??
    SUBSCRIPTION_LIMITS.maxProjectsByTier.free;

  const engineLabels = useMemo(() => {
    const map = {};
    getEngineList().forEach((engine) => {
      map[engine.key] = engine.label;
    });
    return map;
  }, []);

  return (
    <div className="projects-page">
      <div className="projects-shell">
        <div className="projects-header">
          <h1 className="projects-title">My Profile</h1>
          <p className="projects-subtitle">
            Your public profile, connections, and projects.
          </p>
        </div>

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
          currentProjectCount={safeProjects.length}
          maxProjects={maxProjects}
          homeStack={rootStack}
          rootStackLength={1}
        />
      </div>
    </div>
  );
}

export default MyProfile;
