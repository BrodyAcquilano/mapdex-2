import { getUserColorTheme } from "./userColorTheme.js";
import "./UserBadge.css";

function UserBadge({ userName, userColorTheme, onClick, compact = false }) {
  if (!userName) return null;

  const theme = getUserColorTheme(userColorTheme);
  const glyph = userName.trim().charAt(0).toUpperCase() || "?";
  const isClickable = typeof onClick === "function";

  const Tag = isClickable ? "button" : "div";

  return (
    <Tag
      type={isClickable ? "button" : undefined}
      className={`user-badge ${isClickable ? "user-badge-clickable" : ""} ${
        compact ? "user-badge-compact" : ""
      }`}
      onClick={isClickable ? onClick : undefined}
    >
      <span
        className="user-badge-avatar"
        style={{ border: `2px solid ${theme.stroke}`, color: theme.stroke }}
      >
        {glyph}
      </span>
      <span
        className="user-badge-name-pill"
        style={{ background: theme.fill, color: theme.text }}
      >
        {userName}
      </span>
    </Tag>
  );
}

export default UserBadge;
