import UserBadge from "../community/UserBadge.jsx";
import { groupProjectsByVisibility } from "./projectHelpers.js";
import { groupUserProjectsForViewing } from "../community/userProfileHelpers.js";
import "./Projects.css";
import "./renderProjectProfile.css";
import "../community/renderUserProfile.css";

function MiniProjectCard({ project, onSelect, engineLabel }) {
  const glyph =
    (project.projectName || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className="proj-card"
      onClick={() => onSelect(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(project);
        }
      }}
    >
      <div className="proj-card-image">
        <span className="proj-card-image-glyph">{glyph}</span>
      </div>
      <div className="proj-card-body">
        {engineLabel && <span className="proj-card-engine">{engineLabel}</span>}
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

function ProjectGroupSection({ title, list, onProjectClick, engineLabels, emptyText }) {
  return (
    <div className="proj-section">
      <h3 className="proj-section-title">{title}</h3>

      {list.length > 0 ? (
        <div className="proj-grid">
          {list.map((project) => (
            <MiniProjectCard
              key={project._id}
              project={project}
              onSelect={onProjectClick}
              engineLabel={engineLabels[project.engineKey] || project.engineKey}
            />
          ))}
        </div>
      ) : (
        <div className="proj-empty">{emptyText}</div>
      )}
    </div>
  );
}

function UserListSection({
  title,
  entries,
  isSelf,
  onUserClick,
  onRemove,
  removeTitle,
}) {
  return (
    <div className="proj-section">
      <h3 className="proj-section-title">
        {title} ({entries.length})
      </h3>

      {entries.length > 0 ? (
        <ul className="rup-user-list">
          {entries.map((entry) => (
            <li key={entry.userName} className="rup-user-list-item">
              <UserBadge
                compact
                userName={entry.userName}
                userColorTheme={entry.userColorTheme}
                onClick={
                  onUserClick ? () => onUserClick(entry.userName) : undefined
                }
              />
              {isSelf && onRemove && (
                <button
                  type="button"
                  className="rup-remove-x"
                  onClick={() => onRemove(entry.userName)}
                  aria-label={`${removeTitle} ${entry.userName}`}
                  title={removeTitle}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="proj-role-empty">None yet.</div>
      )}
    </div>
  );
}

function RenderUserProfile({
  userName,
  isSelf = false,
  profile,
  projects,
  favourites,
  engineLabels = {},
  onBack,
  onHome,
  onUserClick,
  onProjectClick,
  onFollow,
  onUnfollow,
  onRemoveFollower,
  onBlock,
}) {
  if (!profile) return null;

  const followers = Array.isArray(profile.followers) ? profile.followers : [];
  const following = Array.isArray(profile.following) ? profile.following : [];

  return (
    <>
      <div className="proj-panel rup" role="tabpanel">
        {(onBack || onHome) && (
          <div className="rup-toolbar">
            {onBack ? (
              <button
                type="button"
                className="rpp-back"
                onClick={onBack}
                aria-label="Back"
              >
                ← Back
              </button>
            ) : (
              <span />
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
        )}

        <div className="rup-header">
          <UserBadge userName={userName} userColorTheme={profile.userColorTheme} />
          {isSelf && <span className="rpp-current-badge">Your Profile</span>}
        </div>
      </div>

      {!isSelf && (
        <div className="proj-panel" role="tabpanel">
          <div className="proj-panel-heading proj-panel-heading-center">
            <div>
              <h2 className="proj-panel-title">Profile Actions</h2>
            </div>
          </div>

          <div className="proj-title-divider" />

          <div className="rpp-clone-export">
            <div className="rpp-action-block">
              <h3 className="rpp-action-title">
                {profile.isFollowedByMe ? "Unfollow" : "Follow"}
              </h3>
              <p className="rpp-action-description">
                {profile.isFollowedByMe
                  ? `Stop following ${userName}.`
                  : `Follow ${userName} to keep up with their public activity.`}
              </p>
              <div className="proj-actions">
                <button
                  type="button"
                  className="proj-button proj-button-accent"
                  onClick={() =>
                    profile.isFollowedByMe ? onUnfollow(userName) : onFollow(userName)
                  }
                >
                  {profile.isFollowedByMe ? "Unfollow" : "Follow"}
                </button>
              </div>
            </div>

            {profile.isFollowingMe && (
              <div className="rpp-action-block">
                <h3 className="rpp-action-title">Remove Follower</h3>
                <p className="rpp-action-description">
                  {userName} follows you. You can remove them as a follower.
                </p>
                <div className="proj-actions">
                  <button
                    type="button"
                    className="proj-button proj-button-danger"
                    onClick={() => onRemoveFollower(userName)}
                  >
                    Remove Follower
                  </button>
                </div>
              </div>
            )}

            <div className="rpp-action-block">
              <h3 className="rpp-action-title">Block User</h3>
              <p className="rpp-action-description">
                {userName} won't be able to see your profile or projects, and
                you won't see theirs. This also removes any shared-project
                access between you.
              </p>
              <div className="proj-actions">
                <button
                  type="button"
                  className="proj-button proj-button-danger"
                  onClick={() => onBlock(userName)}
                >
                  Block User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="proj-panel" role="tabpanel">
        <div className="proj-panel-heading proj-panel-heading-center">
          <div>
            <h2 className="proj-panel-title">Connections</h2>
          </div>
        </div>

        <div className="proj-title-divider" />

        <UserListSection
          title="Following"
          entries={following}
          isSelf={isSelf}
          onUserClick={onUserClick}
          onRemove={isSelf ? onUnfollow : null}
          removeTitle="Unfollow"
        />

        <UserListSection
          title="Followers"
          entries={followers}
          isSelf={isSelf}
          onUserClick={onUserClick}
          onRemove={isSelf ? onRemoveFollower : null}
          removeTitle="Remove follower"
        />
      </div>

      <div className="proj-panel" role="tabpanel">
        <div className="proj-panel-heading">
          <div>
            <h2 className="proj-panel-title">
              {isSelf ? "Your Projects" : `${userName}'s Projects`}
            </h2>
            <p className="proj-panel-description">
              {isSelf
                ? "All of your projects."
                : "Public, open, and shared-with-you projects."}
            </p>
          </div>
        </div>

        {projects === null ? (
          <div className="proj-empty">Loading projects...</div>
        ) : isSelf ? (
          (() => {
            const grouped = groupProjectsByVisibility(projects);
            return (
              <>
                <ProjectGroupSection
                  title="Your Private Projects"
                  list={grouped.private}
                  onProjectClick={onProjectClick}
                  engineLabels={engineLabels}
                  emptyText="No private projects."
                />
                <ProjectGroupSection
                  title="Your Public Projects"
                  list={grouped.public}
                  onProjectClick={onProjectClick}
                  engineLabels={engineLabels}
                  emptyText="No public projects."
                />
                <ProjectGroupSection
                  title="Your Open Projects"
                  list={grouped.open}
                  onProjectClick={onProjectClick}
                  engineLabels={engineLabels}
                  emptyText="No open projects."
                />
              </>
            );
          })()
        ) : (
          (() => {
            const grouped = groupUserProjectsForViewing(projects);
            return (
              <>
                <ProjectGroupSection
                  title="Public Projects"
                  list={grouped.public}
                  onProjectClick={onProjectClick}
                  engineLabels={engineLabels}
                  emptyText="No public projects."
                />
                <ProjectGroupSection
                  title="Open Projects"
                  list={grouped.open}
                  onProjectClick={onProjectClick}
                  engineLabels={engineLabels}
                  emptyText="No open projects."
                />
                <ProjectGroupSection
                  title="Shared Projects"
                  list={grouped.shared}
                  onProjectClick={onProjectClick}
                  engineLabels={engineLabels}
                  emptyText="No shared projects."
                />
              </>
            );
          })()
        )}
      </div>

      <div className="proj-panel" role="tabpanel">
        <div className="proj-panel-heading">
          <div>
            <h2 className="proj-panel-title">
              {isSelf ? "Your Favourite Projects" : `${userName}'s Favourite Projects`}
            </h2>
            <p className="proj-panel-description">
              {isSelf
                ? "Projects you've favourited."
                : "Projects they've favourited that you can also see."}
            </p>
          </div>
        </div>

        {favourites === null ? (
          <div className="proj-empty">Loading favourites...</div>
        ) : favourites && favourites.length > 0 ? (
          <div className="proj-grid">
            {favourites.map((project) => (
              <MiniProjectCard
                key={project._id}
                project={project}
                onSelect={onProjectClick}
                engineLabel={engineLabels[project.engineKey] || project.engineKey}
              />
            ))}
          </div>
        ) : (
          <div className="proj-empty">No favourite projects.</div>
        )}
      </div>
    </>
  );
}

export default RenderUserProfile;
