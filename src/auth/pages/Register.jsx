import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Auth.css";
import {
  validateEmail,
  validatePassword,
  validateUserName,
} from "../../../shared/auth/auth.js";

export default function Register({ system, authApi }) {
  const navigate = useNavigate();

  const [userName, setUserName] = useState("");
  const [userNameError, setUserNameError] = useState("");

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [confirmTouched, setConfirmTouched] = useState(false);

  useEffect(() => {
    const voiceKey = submitted ? "registerSuccess" : "register";

    const cleanupVoice = system.registerVoiceCommands(voiceKey, {
      navigate,
    });

    const cleanupKeyboard = system.registerKeyboardCommands(
      "authKeyboardCommands",
      {
        navigate,
      },
    );

    return () => {
      cleanupVoice();
      cleanupKeyboard();
    };
  }, [system, navigate, submitted]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedUserName = userName.trim();
    const trimmedEmail = email.trim();

    const nextUserNameError = validateUserName(trimmedUserName);
    if (nextUserNameError) {
      setUserNameError(nextUserNameError);
      return;
    }

    const nextEmailError = validateEmail(trimmedEmail);
    if (nextEmailError) {
      setEmailError(nextEmailError);
      return;
    }

    const nextPasswordError = validatePassword(password, trimmedEmail);
    if (nextPasswordError) {
      setPasswordError(nextPasswordError);
      return;
    }

    if (password !== confirmPassword) {
      system.notify("Passwords do not match.");
      return;
    }

    system.startLoading("Creating account...");

    try {
      const { data, message } = await authApi.register(
        trimmedEmail,
        password,
        trimmedUserName,
      );

      system.notify(message);

      if (data?.ok === true) {
        setSubmitted(true);
      }
    } catch (err) {
      system.notify("Registration failed.");
    } finally {
      system.stopLoading();
    }
  };

  return (
    <main className="auth-page" role="main">
      <div className="auth-hero">
        <h1 className="auth-title">Mapdex</h1>
        {!submitted && (
          <p className="auth-description">
            Create your account to start mapping events and resources.
          </p>
        )}
      </div>

      <section
        className="auth-card"
        aria-labelledby={submitted ? "Account verification" : "Sign up"}
      >
        {!submitted ? (
          <>
            <h2 id="signup-heading">Sign Up</h2>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-form-group">
                <label htmlFor="signup-username">Username</label>
                <input
                  id="signup-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={userName}
                  aria-invalid={!!userNameError}
                  aria-describedby={
                    userNameError ? "signup-username-error" : undefined
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setUserName(val);
                    setUserNameError(validateUserName(val) || "");
                  }}
                  ref={(el) => {
                    if (el) el.__reactSetter = setUserName;
                  }}
                />

                {userNameError && (
                  <div
                    id="signup-username-error"
                    className="form-error"
                    aria-live="polite"
                  >
                    {userNameError}
                  </div>
                )}
              </div>

              <div className="auth-form-group">
                <label htmlFor="signup-email">Email</label>
                <input
                  id="signup-email"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  aria-invalid={!!emailError}
                  aria-describedby={
                    emailError ? "signup-email-error" : undefined
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val);
                    setEmailError(validateEmail(val) || "");

                    if (password) {
                      setPasswordError(validatePassword(password, val) || "");
                    }
                  }}
                  ref={(el) => {
                    if (el) el.__reactSetter = setEmail;
                  }}
                />

                {emailError && (
                  <div
                    id="signup-email-error"
                    className="form-error"
                    aria-live="polite"
                  >
                    {emailError}
                  </div>
                )}
              </div>

              <div className="auth-form-group password-group">
                <label htmlFor="signup-password">Password</label>

                <div className="password-wrapper">
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    aria-invalid={!!passwordError}
                    aria-describedby={
                      passwordError ? "signup-password-error" : undefined
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setPassword(val);
                      setPasswordError(validatePassword(val, email) || "");

                      if (
                        !confirmTouched ||
                        confirmPassword === "" ||
                        confirmPassword === password
                      ) {
                        setConfirmPassword(val);
                      }
                    }}
                    ref={(el) => {
                      if (el) el.__reactSetter = setPassword;
                    }}
                  />

                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {passwordError && (
                  <div
                    id="signup-password-error"
                    className="form-error"
                    aria-live="polite"
                  >
                    {passwordError}
                  </div>
                )}
              </div>

              <div className="auth-form-group password-group">
                <label htmlFor="signup-confirm-password">
                  Confirm Password
                </label>

                <div className="password-wrapper">
                  <input
                    id="signup-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmTouched(true);
                      setConfirmPassword(e.target.value);
                    }}
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
                aria-label="Create account"
              >
                Create Account
              </button>
            </form>

            <p className="auth-switch">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </>
        ) : (
          <>
            <h2>Account Verification</h2>

            <div className="auth-form">
              <p className="verification-message">
                Please check your email for your secure account verification
                link. Emails are sent using an automated service and may appear
                in your spam folder.
              </p>
            </div>

            <p className="auth-switch">
              Once verified, you may{" "}
              <Link aria-label="Sign in" to="/login">
                Sign in
              </Link>
              .
            </p>
          </>
        )}

        <p className="return-home">
          <Link to="/">Home</Link>
        </p>
      </section>
    </main>
  );
}
