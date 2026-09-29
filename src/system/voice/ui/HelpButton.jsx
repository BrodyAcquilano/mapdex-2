// system/voice/HelpButton.jsx

import { useState } from "react";
import "./HelpButton.css";
import Tooltip from "../../notifications/Tooltip";

export default function HelpButton({
  onClick,
  position = "auth",
  hasBottomUI = false,
}) {
  const [hovered, setHovered] = useState(false);

  const label = "Voice Help";

  return (
    <div
      className={`help-button-container help-${position} ${
        hasBottomUI ? "with-bottom-ui" : ""
      }`}
    >
      <button
        id="voice-help-button"
        className="voice-help-button"
        aria-label={label}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        ?
      </button>

      {hovered && <Tooltip text={label} position="top-left-50-50" />}
    </div>
  );
}