import { useEffect, useState } from "react";
import {
  getVisibilityDescription,
  handleAddRoleUser,
  handleRemoveRoleUser,
  handleSaveVisibility,
  normalizeRoleUser,
} from "./projectHelpers.js";
import UserBadge from "../community/UserBadge.jsx";
import "../community/renderUserProfile.css";

function RenderProjectPermissions({ project, system, apis, onUpdate }) {
  const userRole = project.userRole || "viewer";
  const isOwner = userRole === "owner";
  const hasAdminClearance = isOwner || userRole === "admin";

  const [visibility, setVisibility] = useState(project.visibility || "private");
  const [adminUserName, setAdminUserName] = useState("");
  const [editorUserName, setEditorUserName] = useState("");
  const [viewerUserName, setViewerUserName] = useState("");

  useEffect(() => {
    setVisibility(project.visibility || "private");
  }, [project._id, project.visibility]);

  if (!hasAdminClearance) return null;

  const viewerRoleLocked = visibility === "public" || visibility === "open";

  function renderRoleList(roleKey, roleUsers, isLocked = false) {
    if (!Array.isArray(roleUsers) || roleUsers.length === 0) {
      return <div className="proj-role-empty">No users assigned.</div>;
    }

    return (
      <ul className="rup-user-list">
        {roleUsers.map((roleUser, index) => {
          const normalizedUser = normalizeRoleUser(roleUser);
          const key = `${normalizedUser.userName}-${index}`;
          const displayName = normalizedUser.userName || "Unknown User";

          return (
            <li key={key} className="rup-user-list-item">
              <UserBadge
                compact
                userName={displayName}
                userColorTheme={normalizedUser.userColorTheme}
              />

              {!isLocked && (
                <button
                  type="button"
                  className="rup-remove-x"
                  onClick={() =>
                    handleRemoveRoleUser({
                      roleKey,
                      roleUser: normalizedUser,
                      project,
                      viewerRoleLocked,
                      system,
                      apis,
                      onSuccess: onUpdate,
                    })
                  }
                  aria-label={`Remove ${displayName}`}
                  title="Remove User"
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="proj-panel" role="tabpanel">
      <div className="proj-panel-heading proj-panel-heading-center">
        <div>
          <h2 className="proj-panel-title">Permissions</h2>
        </div>
      </div>

      <div className="proj-title-divider" />

      <div className="proj-section">
        <h3 className="proj-section-title">Visibility</h3>
        <p
          className="proj-section-description"
          style={
            visibility === "open"
              ? { color: "#b00020", fontWeight: 600 }
              : undefined
          }
        >
          {getVisibilityDescription(visibility)}
        </p>

        <label className="proj-label">Project Visibility</label>
        <select
          className="proj-select"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
        >
          <option value="private">Private</option>
          <option value="public">Public</option>
          <option value="open">Open</option>
        </select>

        <div className="proj-actions">
          <button
            className="proj-button proj-button-accent"
            onClick={() =>
              handleSaveVisibility({
                project,
                visibility,
                system,
                apis,
                onSuccess: onUpdate,
              })
            }
          >
            Save Privacy
          </button>
        </div>
      </div>


      <div className="proj-section">
        <h3 className="proj-section-title">Admin Role</h3>
        <p className="proj-section-description">
          Admin can edit roles, change project visibility, edit the schema,
          and update the project name, description, and tags. Unlike
          editors, admins can edit or delete any data item in the project,
          not just their own. Admin also has editor permissions, but cannot
          delete the project and cannot remove another admin. For presence
          projects, even admins and owners cannot override another user's
          own location marker.
        </p>

        <div className="proj-role-panel">
          {renderRoleList("adminRole", project.adminRole || [])}
        </div>

        <label className="proj-label">Add Admin by Username</label>
        <input
          className="proj-input"
          type="text"
          placeholder="Username"
          value={adminUserName}
          onChange={(e) => setAdminUserName(e.target.value)}
        />

        <div className="proj-actions">
          <button
            className="proj-button proj-button-accent"
            onClick={() => {
              handleAddRoleUser({
                roleKey: "adminRole",
                userName: adminUserName,
                project,
                viewerRoleLocked,
                system,
                apis,
                onSuccess: (patch) => {
                  onUpdate(patch);
                  setAdminUserName("");
                },
              });
            }}
          >
            Add Admin
          </button>
        </div>
      </div>

      <div className="proj-section">
        <h3 className="proj-section-title">Editor Role</h3>
        <p className="proj-section-description">
          Editor cannot manage roles or change the schema. Editors can add
          project data, but can only edit or delete the data items they
          added themselves. For presence projects, this always means only
          your own location marker, regardless of role.
        </p>

        <div className="proj-role-panel">
          {renderRoleList("editorRole", project.editorRole || [])}
        </div>

        <label className="proj-label">Add Editor by Username</label>
        <input
          className="proj-input"
          type="text"
          placeholder="Username"
          value={editorUserName}
          onChange={(e) => setEditorUserName(e.target.value)}
        />

        <div className="proj-actions">
          <button
            className="proj-button proj-button-accent"
            onClick={() => {
              handleAddRoleUser({
                roleKey: "editorRole",
                userName: editorUserName,
                project,
                viewerRoleLocked,
                system,
                apis,
                onSuccess: (patch) => {
                  onUpdate(patch);
                  setEditorUserName("");
                },
              });
            }}
          >
            Add Editor
          </button>
        </div>
      </div>

      <div className="proj-section">
        <h3 className="proj-section-title">Viewer Role</h3>
        <p className="proj-section-description">
          Viewer is read-only. If the project is public or open, viewer
          permissions are overlooked because public access already covers
          visibility.
        </p>

        <div className="proj-role-panel">
          {renderRoleList(
            "viewerRole",
            project.viewerRole || [],
            viewerRoleLocked,
          )}
        </div>

        <label className="proj-label">Add Viewer by Username</label>
        <input
          className="proj-input"
          type="text"
          placeholder="Username"
          value={viewerUserName}
          onChange={(e) => setViewerUserName(e.target.value)}
          disabled={viewerRoleLocked}
        />

        {viewerRoleLocked && (
          <div className="proj-lock-message">
            Viewer permissions do not apply when the project is set to
            public or open.
          </div>
        )}

        <div className="proj-actions">
          <button
            className="proj-button proj-button-accent"
            onClick={() => {
              handleAddRoleUser({
                roleKey: "viewerRole",
                userName: viewerUserName,
                project,
                viewerRoleLocked,
                system,
                apis,
                onSuccess: (patch) => {
                  onUpdate(patch);
                  setViewerUserName("");
                },
              });
            }}
            disabled={viewerRoleLocked}
          >
            Add Viewer
          </button>
        </div>
      </div>
    </div>
  );
}

export default RenderProjectPermissions;
