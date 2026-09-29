// src/workspace/TrackLocationButton/TrackLocationButton.jsx

import { useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import Tooltip from "../../system/notifications/Tooltip";

import "./TrackLocationButton.css";

export default function TrackLocationButton({
  trackLocation,
  hasBottomUI,
  handleTrackLocationToggle,
  isMobile,
  system,
}) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const cleanupVoice = system.registerVoiceCommands("trackLocationButton", {
      handleTrackLocationToggle,
    });

    return () => {
      cleanupVoice();
    };
  }, [system, handleTrackLocationToggle]);

  useEffect(() => {
    if (isMobile && hovered) {
      setHovered(false);
    }
  }, [isMobile, hovered]);

  const label = "Toggle Track Location";

  return (
    <div
      className={`track-location-button-container ${
        hasBottomUI ? "with-bottom-ui" : ""
      }`}
    >
      <button
        className={`track-location-button ${trackLocation ? "active" : ""}`}
        onClick={handleTrackLocationToggle}
        aria-label={label}
        aria-pressed={trackLocation}
        onMouseEnter={!isMobile ? () => setHovered(true) : undefined}
        onMouseLeave={!isMobile ? () => setHovered(false) : undefined}
      >
        <LocateFixed className="locate-icon" />
      </button>

      {!isMobile && hovered && (
        <Tooltip text={label} position="top-60-center" />
      )}
    </div>
  );
}