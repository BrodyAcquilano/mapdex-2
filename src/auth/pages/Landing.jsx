import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import "../styles/Landing.css";

export default function Landing({ system }) {
  const navigate = useNavigate();
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();

    const cleanupVoice = system.registerVoiceCommands("landing", {
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
  }, [system, navigate]);

  return (
    <main className="landing-page" role="main">
      <section className="landing-hero">
        <h1 id="landing-title" className="landing-title" ref={titleRef}>
          Mapdex
        </h1>

        <p className="landing-subtitle">
          Dynamic event and resource mapping for structured geographic data.
        </p>

        <nav className="landing-actions" aria-label="Account access">
          <Link
            to="/login"
            className="landing-btn primary"
            aria-label="Sign in"
          >
            Sign In
          </Link>

          <Link
            to="/register"
            className="landing-btn secondary"
            aria-label="Create account"
          >
            Create Account
          </Link>
        </nav>
      </section>
    </main>
  );
}