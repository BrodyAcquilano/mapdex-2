// src/ResetPassword.jsx

import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { validatePassword } from "../../../shared/auth/auth.js";
import "../styles/Auth.css";

export default function ResetPassword({ system, authApi }) {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    registerVoiceCommands,
    registerKeyboardCommands,
    startLoading,
    stopLoading,
    notify,
  } = system;

  const [token, setToken] = useState(null);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkedToken, setCheckedToken] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const cleanupVoice = registerVoiceCommands("resetPassword", {
      navigate,
    });

    const cleanupKeyboard = registerKeyboardCommands("authKeyboardCommands", {
      navigate,
    });

    return () => {
      cleanupVoice();
      cleanupKeyboard();
    };
  }, [registerVoiceCommands, registerKeyboardCommands, navigate]);

  /* ─────────────────────────────
     CHECK TOKEN ON MOUNT
  ───────────────────────────── */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resetToken = params.get("token");

    if (!resetToken) {
      notify("Invalid or expired reset link.");
      navigate("/login", { replace: true });
      return;
    }

    const run = async () => {
      startLoading("Validating reset link...");

      try {
        const result = await authApi.verifyPasswordResetToken(resetToken);

        stopLoading();

        if (!result.success) {
          notify("Invalid or expired reset link.");
          navigate("/login", { replace: true });
          return;
        }

        setToken(resetToken);
        setIsValidToken(true);
        setCheckedToken(true);
      } catch {
        stopLoading();
        notify("Invalid or expired reset link.");
        navigate("/login", { replace: true });
      }
    };

    run();
  }, [location.search, authApi, navigate, startLoading, stopLoading, notify]);

  /* ─────────────────────────────
     HANDLE SUBMIT
  ───────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextPasswordError = validatePassword(password);
    if (nextPasswordError) {
      setPasswordError(nextPasswordError);
      notify(nextPasswordError);
      return;
    }

    if (password !== confirmPassword) {
      notify("Passwords do not match.");
      return;
    }

    startLoading("Resetting password...");

    try {
      const result = await authApi.resetPassword(token, password);

      notify(result.message);

      stopLoading();

      if (result.success) {
        navigate("/login", { replace: true });
      }
    } catch {
      stopLoading();
      notify("Failed to reset password.");
    }
  };

  /* ─────────────────────────────
     RENDER
  ───────────────────────────── */
  if (!checkedToken) return null;
  if (!isValidToken) return null;

  return (
    <main className="auth-page" role="main">
      <div className="auth-hero">
        <h1 className="auth-title">Mapdex</h1>
      </div>

      <section className="auth-card" aria-labelledby="reset-heading">
        <h2 id="reset-heading">Reset Password</h2>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-form-group password-group">
            <label htmlFor="new-password">New Password</label>

            <div className="password-wrapper">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                aria-invalid={!!passwordError}
                aria-describedby={
                  passwordError ? "new-password-error" : undefined
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setPassword(val);
                  setPasswordError(validatePassword(val) || "");
                }}
                ref={(el) => {
                  if (el) el.__reactSetter = setPassword;
                }}
              />

              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {passwordError && (
              <div
                id="new-password-error"
                className="form-error"
                aria-live="polite"
              >
                {passwordError}
              </div>
            )}
          </div>

          <div className="auth-form-group password-group">
            <label htmlFor="confirm-new-password">Confirm New Password</label>

            <div className="password-wrapper">
              <input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                ref={(el) => {
                  if (el) el.__reactSetter = setConfirmPassword;
                }}
              />

              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="primary-btn"
            aria-label="Reset password"
          >
            Reset Password
          </button>
        </form>

        <p className="return-home">
          <Link to="/">Home</Link>
        </p>
      </section>
    </main>
  );
}