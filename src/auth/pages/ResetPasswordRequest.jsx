// src/ResetPasswordRequest.jsx

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Auth.css";
import { validateEmail } from "../../../shared/auth/auth.js";

export default function ResetPasswordRequest({ system, authApi }) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const voiceKey = submitted
      ? "resetPasswordRequestSuccess"
      : "resetPasswordRequest";

    const cleanupVoice = system.registerVoiceCommands(voiceKey, {
      navigate,
    });

    const cleanupKeyboard = system.registerKeyboardCommands(
      "authKeyboardCommands",
      {
        navigate,
      }
    );

    return () => {
      cleanupVoice();
      cleanupKeyboard();
    };
  }, [system, navigate, submitted]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    const nextEmailError = validateEmail(trimmedEmail);
    if (nextEmailError) {
      setEmailError(nextEmailError);
      return;
    }

    system.startLoading("Sending reset link...");

    try {
      const { message } = await authApi.requestPasswordReset(trimmedEmail);

      system.notify(
        message || "If an account exists, a reset link has been sent."
      );
      setSubmitted(true);
    } catch {
      system.notify("If an account exists, a reset link has been sent.");
      setSubmitted(true);
    } finally {
      system.stopLoading();
    }
  };

  return (
    <main className="auth-page" role="main">
      <div className="auth-hero">
        <h1 className="auth-title">Mapdex</h1>
      </div>

      <section
        className="auth-card"
        aria-labelledby={submitted ? "reset-success-heading" : "reset-heading"}
      >
        {!submitted ? (
          <>
            <h2 id="reset-heading">Reset Password</h2>

            <p className="auth-description">
              Enter your email address and we will send you a secure link to
              reset your password.
            </p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-form-group">
                <label htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "reset-email-error" : undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val);
                    setEmailError(validateEmail(val) || "");
                  }}
                  ref={(el) => {
                    if (el) el.__reactSetter = setEmail;
                  }}
                />

                {emailError && (
                  <div
                    id="reset-email-error"
                    className="form-error"
                    aria-live="polite"
                  >
                    {emailError}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="primary-btn"
                aria-label="Reset password"
              >
                Reset Password
              </button>
            </form>

              <p className="auth-switch">
             Remembered your password? <Link to="/login">Sign in</Link>
            </p>
          </>
        ) : (
          <>
            <h2 id="reset-success-heading">Reset Link Sent</h2>

            <div className="auth-form">
              <p className="verification-message">
                If an account exists for that email address, a password reset
                link has been sent. Please check your inbox and spam folder.
              </p>

               <p className="auth-switch">
             Once you have reset your password you may <Link aria-label= "Sign in" to="/login">Sign in</Link>.
            </p>
            </div>
          </>
        )}
            
        <p className="return-home">
          <Link to="/">Home</Link>
        </p>
      </section>
    </main>
  );
}