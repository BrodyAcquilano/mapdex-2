import { useState, useEffect } from "react";
import "./Account.css";
import {
  validatePassword,
  validateUserName,
} from "../../../shared/auth/auth.js";
import { validateUserColorTheme } from "../../../shared/validation/accounts.js";

export default function Account({
  setCurrentPage,
  system,
  accountsApi,
  apis,
  user,
  setUser,
  USER_ICON_THEMES,
}) {
  useEffect(() => {
    setCurrentPage("account");
  }, [setCurrentPage]);

  const [newUserName, setNewUserName] = useState("");
  const [userNameError, setUserNameError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [selectedUserColorTheme, setSelectedUserColorTheme] = useState(
    user?.userColorTheme || "green",
  );

  useEffect(() => {
    setSelectedUserColorTheme(user?.userColorTheme || "green");
  }, [user?.userColorTheme]);

  const handleChangeUserName = async (e) => {
    e.preventDefault();

    const trimmedUserName = newUserName.trim();
    const error = validateUserName(trimmedUserName);

    if (error) {
      setUserNameError(error);
      return;
    }

if (
  (user?.userName || "").trim().toLowerCase() ===
  trimmedUserName.toLowerCase()
) {
  system.notify("That username is already selected.");
  return;
}

    system.startLoading("Updating username...");

    try {
      const { success, message } = await accountsApi.changeUserName(
        trimmedUserName,
      );

      system.notify(message);

      if (success) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                userName: trimmedUserName,
              }
            : prev,
        );

        setNewUserName("");
        setUserNameError("");
      }
    } catch (err) {
      system.notify("Failed to update username.");
    } finally {
      system.stopLoading();
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      system.notify("Current password is required.");
      return;
    }

    const error = validatePassword(newPassword);
    if (error) {
      setPasswordError(error);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      system.notify("New passwords do not match.");
      return;
    }

    system.startLoading("Updating password...");

    try {
      const { success, message } = await accountsApi.changePassword(
        currentPassword,
        newPassword,
      );

      system.notify(message);

      if (success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        setPasswordError("");
      }
    } catch (err) {
      system.notify("Failed to update password.");
    } finally {
      system.stopLoading();
    }
  };

  const handleChangeUserColorTheme = async (e) => {
    e.preventDefault();

    const themeError = validateUserColorTheme(selectedUserColorTheme);
    if (themeError) {
      system.notify(themeError);
      return;
    }

    const normalizedUserColorTheme = selectedUserColorTheme.trim();

    if ((user?.userColorTheme || "green") === normalizedUserColorTheme) {
      system.notify("That color theme is already selected.");
      return;
    }

    system.startLoading("Updating user color theme...");

    try {
      const { success, message, data } = await accountsApi.changeUserColorTheme(
        normalizedUserColorTheme,
      );

      system.notify(message);

      if (success) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                userColorTheme:
                  data?.userColorTheme || normalizedUserColorTheme,
              }
            : prev,
        );
      }
    } catch (err) {
      system.notify("Failed to update user color theme.");
    } finally {
      system.stopLoading();
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await system.confirm({
      message:
        "Are you sure you want to delete your account? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    system.startLoading("Deleting account...");

    try {
      const { success, message } = await accountsApi.deleteAccount();

      system.notify(message);
      system.setVoicePlan("free");

      if (success) {
        window.location.href = "/";
      }
    } catch {
      system.notify("Failed to delete account.");
    } finally {
      system.stopLoading();
    }
  };

  const safeBlockedUsers = Array.isArray(user?.blockedUsers)
    ? user.blockedUsers
    : [];

  const handleUnblockUser = async (userName) => {
    system.startLoading("Unblocking user...");

    try {
      const { message } = await apis.usersApi.unblockUser(userName);
      system.notify(message);

      setUser((prev) =>
        prev
          ? {
              ...prev,
              blockedUsers: (Array.isArray(prev.blockedUsers)
                ? prev.blockedUsers
                : []
              ).filter(
                (ref) => ref.userName.toLowerCase() !== userName.toLowerCase(),
              ),
            }
          : prev,
      );
    } catch {
      system.notify("Failed to unblock user.");
    } finally {
      system.stopLoading();
    }
  };

  const currentThemeKey = selectedUserColorTheme || "green";
  const currentTheme =
    USER_ICON_THEMES?.[currentThemeKey] || USER_ICON_THEMES?.green || null;

  return (
    <div className="accounts-page">
      <div className="accounts-page-overlay">
        <div className="accounts-page-panel">
          <div className="accounts-title-wrap">
            <h1 className="accounts-title">Account Settings</h1>
          </div>

          <div className="accounts-page-body">
            <div className="accounts-page-content">
              <div className="accounts-header-text">
                <div className="accounts-header-heading">
                  Manage your account details and security settings.
                </div>
                <div className="accounts-header-subtext">
                  Signed in as{" "}
                  <strong>{user.userName || "Unknown User"}</strong>.
                </div>
              </div>

              <div className="accounts-section-divider" aria-hidden="true" />

              <section className="account-block">
                <div className="account-block-header">
                  <h2 className="account-block-title">Current Username</h2>
                  <div className="account-block-description">
                    Your current username is shown below.
                  </div>
                </div>

                <div className="account-display-panel">
                  <div className="account-current-value">
                    {user.userName || "No username found."}
                  </div>
                </div>
              </section>

              <section className="account-block">
                <div className="account-block-header">
                  <h2 className="account-block-title">Change Username</h2>
                  <div className="account-block-description">
                    Choose a new username for your account.
                  </div>
                </div>

                <form
                  onSubmit={handleChangeUserName}
                  className="account-form-panel"
                >
                  <div className="account-form-group">
                    <label>New Username</label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewUserName(val);
                        setUserNameError(validateUserName(val) || "");
                      }}
                      required
                    />
                    {userNameError && (
                      <div className="account-form-error">
                        {userNameError}
                      </div>
                    )}
                  </div>
                </form>

                <div className="account-button-row">
                  <button
                    type="submit"
                    form={undefined}
                    className="account-primary-btn"
                    onClick={handleChangeUserName}
                  >
                    Update Username
                  </button>
                </div>
              </section>

              <section className="account-block">
                <div className="account-block-header">
                  <h2 className="account-block-title">Change Password</h2>
                  <div className="account-block-description">
                    Update your password to keep your account secure.
                  </div>
                </div>

                <form
                  onSubmit={handleChangePassword}
                  className="account-form-panel"
                >
                  <div className="account-form-group">
                    <label>Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="account-form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewPassword(val);
                        setPasswordError(validatePassword(val));
                      }}
                      required
                    />
                    {passwordError && (
                      <div className="account-form-error">
                        {passwordError}
                      </div>
                    )}
                  </div>

                  <div className="account-form-group">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </form>

                <div className="account-button-row">
                  <button
                    type="submit"
                    className="account-primary-btn"
                    onClick={handleChangePassword}
                  >
                    Update Password
                  </button>
                </div>
              </section>

              <section className="account-block">
                <div className="account-block-header">
                  <h2 className="account-block-title">User Marker Color</h2>
                  <div className="account-block-description">
                    Choose the color theme used for your live map marker.
                  </div>
                </div>

                <form
                  onSubmit={handleChangeUserColorTheme}
                  className="account-form-panel"
                >
                  <div className="account-form-group">
                    <label>User Color Theme</label>
                    <select
                      value={selectedUserColorTheme}
                      onChange={(e) =>
                        setSelectedUserColorTheme(e.target.value)
                      }
                      className="account-select"
                    >
                      {Object.keys(USER_ICON_THEMES || {}).map((themeKey) => (
                        <option key={themeKey} value={themeKey}>
                          {themeKey.charAt(0).toUpperCase() +
                            themeKey.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="account-form-group">
                    <label>Preview</label>
                    <div className="account-theme-preview-box">
                      <div
                        className="account-theme-preview-dot"
                        style={{
                          backgroundColor:
                            currentTheme?.fill || "rgba(26, 203, 53, 0.96)",
                          borderColor:
                            currentTheme?.stroke || "rgba(35, 98, 47, 0.8)",
                        }}
                      />
                    </div>
                  </div>
                </form>

                <div className="account-button-row">
                  <button
                    type="submit"
                    className="account-primary-btn"
                    onClick={handleChangeUserColorTheme}
                  >
                    Save Color Theme
                  </button>
                </div>
              </section>

              <section className="account-block">
                <div className="account-block-header">
                  <h2 className="account-block-title">Blocked Users</h2>
                  <div className="account-block-description">
                    Blocked users can't view your profile or projects, and you
                    won't see theirs. Unblock someone to restore visibility in
                    both directions.
                  </div>
                </div>

                {safeBlockedUsers.length > 0 ? (
                  <ul className="account-blocked-user-list">
                    {safeBlockedUsers.map((blocked) => (
                      <li
                        key={blocked.userName}
                        className="account-blocked-user-item"
                      >
                        <span>{blocked.userName}</span>
                        <button
                          type="button"
                          className="account-primary-btn"
                          onClick={() => handleUnblockUser(blocked.userName)}
                        >
                          Unblock
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="account-block-description">
                    You haven't blocked anyone.
                  </div>
                )}
              </section>

              <div className="accounts-section-divider" aria-hidden="true" />

              <section className="account-block">
                <div className="account-block-header">
                  <h2 className="account-block-title">Delete Account</h2>
                  <div className="account-block-description">
                    Permanently delete your account and all associated data.
                  </div>
                </div>

                <div className="account-danger-note">
                  This action cannot be undone.
                </div>

                <div className="account-button-row">
                  <button
                    className="account-danger-btn"
                    onClick={handleDeleteAccount}
                  >
                    Delete My Account
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}