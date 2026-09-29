import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Auth.css";
import { validateEmail, validatePassword } from "../../../shared/auth/auth.js";

export default function Login({ system, authApi }) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unverified, setUnverified] = useState(false);

  useEffect(() => {
    const cleanupVoice = system.registerVoiceCommands("login", { navigate });
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
  }, [system, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    const emailError = validateEmail(trimmedEmail);
    if (emailError) {
      system.notify(emailError);
      return;
    }

    const passwordError = validatePassword(password, trimmedEmail);
    if (passwordError) {
      system.notify(passwordError);
      return;
    }

    system.startLoading("Signing in...");
    setUnverified(false);

    try {
      const { data, message } = await authApi.login(trimmedEmail, password);

      system.notify(message);

      if (!data?.ok && message === "Please verify your email before logging in.") {
        setUnverified(true);
      }

      if (data?.ok === true) {
        navigate("/app");
      }
    } catch (err) {
      system.notify("Login failed.");
    } finally {
      system.stopLoading();
    }
  };

  return (
    <main className="auth-page" role="main">
      <div className="auth-hero">
        <h1 id="signin-title" className="auth-title">
          Mapdex
        </h1>
        <p className="auth-description">
          A dynamic event and resource mapping platform.
        </p>
      </div>

      <section className="auth-card" aria-labelledby="signin-heading">
        <h2 id="signin-heading">Sign In</h2>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-form-group">
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              type="text"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              ref={(el) => {
                if (el) el.__reactSetter = setEmail;
              }}
            />
          </div>

          <div className="auth-form-group password-group">
            <label htmlFor="signin-password">Password</label>

            <div className="password-wrapper">
              <input
                id="signin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          </div>

          <button type="submit" className="primary-btn" aria-label="Sign in">
            Sign In
          </button>
        </form>

        <p className="auth-switch">
          <Link to="/reset-password-request">Forgot your password?</Link>
        </p>

        {unverified && (
          <p className="auth-switch">
            Didn’t receive the verification email?{" "}
            <Link to="/register">Resend verification link</Link>
          </p>
        )}

        <p className="auth-switch">
          Don’t have an account? <Link to="/register">Sign Up</Link>
        </p>

        <p className="return-home">
          <Link to="/">Home</Link>
        </p>
      </section>
    </main>
  );
}