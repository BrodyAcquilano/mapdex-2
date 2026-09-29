// system/voice/VoiceButton.jsx

import { useEffect, useState } from "react";
import "./VoiceButton.css";
import Tooltip from "../../notifications/Tooltip";

/*
 * Replaces the old microphone emoji: a simple person's head/shoulders
 * with a few nested sound-wave arcs by the mouth, reading as "person
 * speaking" rather than "recording device." Deliberately plain
 * line-art (matching the tool-wheel's own hand-drawn icon style, see
 * src/map/tools/GeometryToolWheel.jsx) rather than an icon-font glyph,
 * so its color can follow the button's own idle/listening state via
 * plain CSS instead of needing separate light/dark icon assets.
 */
function SpeakingPersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="voice-icon" aria-hidden="true">
      <circle cx="9" cy="7.2" r="3.4" className="voice-icon-figure" />

      <path
        d="M3.2 20c0-3.9 2.6-6.6 5.8-6.6s5.8 2.7 5.8 6.6"
        className="voice-icon-figure"
      />

      <path d="M15 7.6c1 .8 1 3.4 0 4.2" className="voice-icon-wave voice-icon-wave-1" />
      <path d="M17.4 5.6c2 1.8 2 6.8 0 8.6" className="voice-icon-wave voice-icon-wave-2" />
      <path d="M19.8 3.6c3 2.8 3 10.6 0 13.4" className="voice-icon-wave voice-icon-wave-3" />
    </svg>
  );
}

export default function VoiceButton({
  system,
  position = "auth",
  hasBottomUI = false,
}) {
  const voice = system.voice;

  const [listening, setListening] = useState(voice.isListening());
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const unsubscribe = voice.subscribe(setListening);
    return unsubscribe;
  }, [voice]);

  const label = "Toggle Voice";

  return (
    <div
      className={`voice-button-container voice-${position} ${
        hasBottomUI ? "with-bottom-ui" : ""
      }`}
    >
      <button
        id="voice-button"
        className={`voice-button ${listening ? "listening" : ""}`}
        aria-label={label}
        aria-pressed={listening}
        onClick={() => voice.toggle()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <SpeakingPersonIcon />
      </button>

      {hovered && <Tooltip text={label} position="top-left-60-60" />}
    </div>
  );
}