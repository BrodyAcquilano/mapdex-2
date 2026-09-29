import { useEffect, useState } from "react";
import Tooltip from "../../system/notifications/Tooltip";

import "./SettingsToggle.css";

export default function SettingsToggle({
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  isMobile,
  system,
}) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const cleanupVoice = system.registerVoiceCommands("settingsToggle", {
      setIsSettingsModalOpen,
    });

    return () => {
      cleanupVoice();
    };
  }, [system, setIsSettingsModalOpen]);

    useEffect(() => {
    if (isMobile && hovered) {
      setHovered(false);
    }
  }, [isMobile, hovered]);

  const label = "Open Settings";

  return (
    <div className="settings-toggle-container">
      <button
        className="app-settings-button"
        onClick={() => setIsSettingsModalOpen(true)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={isSettingsModalOpen}
        onMouseEnter={!isMobile ? () => setHovered(true) : undefined}
        onMouseLeave={!isMobile ? () => setHovered(false) : undefined}
      >
        ⚙️
      </button>

      {!isMobile && hovered && ( 
        <Tooltip text={label} position="bottom-60" />
        )}
    </div>
  );
}