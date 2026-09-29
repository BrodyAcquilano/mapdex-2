import { useEffect, useMemo, useRef } from "react";
import "./VoiceCommandModal.css";

export default function VoiceCommandModal({ onClose, system }) {
  const commands = system.voice.getCommands();
  const { voiceLanguage, setVoiceLanguage, languageOptions, autoDetectLanguages } =
    system;

  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  const groupedCommands = useMemo(() => {
    const groups = {};

    for (const cmd of commands) {
      const section = cmd.section || "Other";
      if (!groups[section]) groups[section] = [];
      groups[section].push(cmd);
    }

    return Object.entries(groups);
  }, [commands]);

  const showAutoDetectNote =
    voiceLanguage === "auto" && autoDetectLanguages.length > 0;

  useEffect(() => {
    const modal = modalRef.current;
    const previousFocus = document.activeElement;

    closeButtonRef.current?.focus();

    const cleanup = system.trapFocus(modal, onClose);

    return () => {
      cleanup();
      previousFocus?.focus?.();
    };
  }, [system, onClose]);

  const handleLanguageChange = (e) => {
    setVoiceLanguage(e.target.value);
  };

  return (
    <div className="voice-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="voice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          className="voice-modal-close"
          aria-label="Close help"
          onClick={onClose}
        >
          ×
        </button>

        <h2 id="voice-modal-title">Voice Commands</h2>

        <div className="voice-command-groups">
          {groupedCommands.map(([section, items]) => (
            <section key={section} className="voice-command-section">
              <h3 className="voice-command-section-title">{section}</h3>

              <ul className="voice-command-list">
                {items.map((cmd, index) => (
                  <li
                    key={`${section}-${index}`}
                    className="voice-command-item"
                  >
                    {cmd.description}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="voice-language-section">
          <label htmlFor="voice-language">Recognition Language</label>

          <select
            id="voice-language"
            value={voiceLanguage}
            onChange={handleLanguageChange}
            className="voice-language-select"
            aria-describedby={showAutoDetectNote ? "voice-language-note" : undefined}
          >
            {(languageOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {showAutoDetectNote && (
            <p id="voice-language-note" className="voice-language-note">
              Auto detect supports:{" "}
              {autoDetectLanguages.map((lang) => lang.label).join(", ")}.
            </p>
          )}
        </div>

        <button className="voice-modal-bottom-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}