import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Header.css";

function Header({
  pagesConfig = [],
  hasAdminClearance = false,
  authApi,
  system,
  engineApi,
  schema,
  draftUser,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (!authApi) return;

    if (
      schema?.engineKey === "presence" &&
      engineApi &&
      draftUser?._id &&
      schema?._id
    ) {
      const { message } = await engineApi.remove(
        draftUser._id,
        schema._id,
      );

      if (message) {
        system.notify(message);
      }
    }

    const { data, message } = await authApi.logout();

    system.notify(message);
    system.setVoicePlan("free");

    setMenuOpen(false);

    if (data) {
      navigate("/");
    }
  };

  return (
    <header className="app-header">
      <h1 className="site-title">Mapdex</h1>

      <button
        className="menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="navigation"
        aria-label="Toggle navigation menu"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        ☰
      </button>

      <nav
        id="navigation"
        className={`nav-links ${menuOpen ? "open" : ""}`}
        aria-label="navigation"
      >
        <Link to="/app/projects" onClick={() => setMenuOpen(false)}>
          Projects
        </Link>

        <Link to="/app/community" onClick={() => setMenuOpen(false)}>
          Community
        </Link>

        {pagesConfig.map(({ key, path, label }) => (
          <Link
            key={key}
            to={`/app/${path}`}
            onClick={() => setMenuOpen(false)}
          >
            {label}
          </Link>
        ))}

        {hasAdminClearance && (
          <Link to="/app/schema" onClick={() => setMenuOpen(false)}>
            Schema
          </Link>
        )}

        <Link to="/app/profile" onClick={() => setMenuOpen(false)}>
          Profile
        </Link>

        <Link to="/app/account" onClick={() => setMenuOpen(false)}>
          Account
        </Link>

        <button
          type="button"
          className="logout-link"
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </nav>
    </header>
  );
}

export default Header;