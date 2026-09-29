import { TIME_LIMITS } from "../../../../../shared/validation/validationConstants.js";

function sortEventModes(modes) {
  return TIME_LIMITS.eventModeOptions.filter((mode) => modes.includes(mode));
}

function TimeConfigurator({ time, setDraftSchema, lockedFields = [] }) {
  function isLockedField(fieldName) {
    return lockedFields.includes(fieldName);
  }

  function update(field, value) {
    if (isLockedField(field)) return;

    setDraftSchema((prev) => ({
      ...prev,
      time: {
        ...prev.time,
        [field]: value,
      },
    }));
  }

  const timeType = time?.type || "None";
  const rawModes = Array.isArray(time?.modes) ? time.modes : [];
  const modes =
    timeType === "Event"
      ? (() => {
          const sorted = sortEventModes(rawModes);
          return sorted.length > 0
            ? sorted
            : [TIME_LIMITS.eventModeOptions[0]];
        })()
      : sortEventModes(rawModes);

  const addableEventModes = TIME_LIMITS.eventModeOptions.filter(
    (mode) => !modes.includes(mode),
  );

  return (
    <div className="input-configurator-group">
      <label className="input-configurator-option">
        Time Type:
        <select
          value={timeType}
          onChange={(e) => {
            const nextType = e.target.value;

            if (isLockedField("type")) return;

            setDraftSchema((prev) => {
              const nextTime = {
                ...prev.time,
                type: nextType,
              };

              if (nextType === "Event") {
                const existingModes = sortEventModes(
                  Array.isArray(prev.time?.modes) ? prev.time.modes : [],
                );

                nextTime.modes =
                  existingModes.length > 0
                    ? existingModes
                    : [TIME_LIMITS.eventModeOptions[0]];
              }

              return {
                ...prev,
                time: nextTime,
              };
            });
          }}
          disabled={isLockedField("type")}
        >
          {TIME_LIMITS.typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="input-configurator-option">
        <input
          type="checkbox"
          checked={!!time?.isFilter}
          onChange={(e) => update("isFilter", e.target.checked)}
          disabled={isLockedField("isFilter")}
        />
        Show as Filter Option
      </label>

      <label className="input-configurator-option">
        <input
          type="checkbox"
          checked={!!time?.isDisplayed}
          onChange={(e) => update("isDisplayed", e.target.checked)}
          disabled={isLockedField("isDisplayed")}
        />
        Display in Info Panel
      </label>

      {timeType === "Event" && (
        <>
          <label className="input-configurator-option">
            Default Duration (minutes):
            <input
              type="number"
              min={TIME_LIMITS.defaultDurationMinutes.min}
              max={TIME_LIMITS.defaultDurationMinutes.max}
              step={TIME_LIMITS.defaultDurationMinutes.step}
              value={
                time?.defaultDurationMinutes ??
                TIME_LIMITS.defaultDurationMinutes.default
              }
              onChange={(e) =>
                update("defaultDurationMinutes", Number(e.target.value))
              }
              disabled={isLockedField("defaultDurationMinutes")}
            />
          </label>

          <h3 className="input-configurator-subtitle">Allowed Modes</h3>

          <ul className="input-configurator-static-list">
            {modes.map((mode) => (
              <li key={mode} className="input-configurator-static-item">
                <span className="input-configurator-static-list-label">
                  - {mode}
                </span>

                <span
                  className="input-configurator-delete-option"
                  onClick={() => {
                    if (isLockedField("modes")) return;
                    if (modes.length <= 1) return;

                    const updatedModes = sortEventModes(
                      modes.filter((m) => m !== mode),
                    );
                    update("modes", updatedModes);
                  }}
                  title={
                    modes.length <= 1
                      ? "At least one mode is required."
                      : "Delete Mode"
                  }
                  style={{
                    pointerEvents:
                      isLockedField("modes") || modes.length <= 1
                        ? "none"
                        : "auto",
                    opacity:
                      isLockedField("modes") || modes.length <= 1 ? 0.5 : 1,
                  }}
                >
                  &minus;
                </span>
              </li>
            ))}
          </ul>

          {addableEventModes.length > 0 && (
            <label className="input-configurator-option">
              Add Mode:
              <select
                value=""
                onChange={(e) => {
                  const nextMode = e.target.value;
                  if (!nextMode || isLockedField("modes")) return;

                  update("modes", sortEventModes([...modes, nextMode]));
                }}
                disabled={isLockedField("modes")}
              >
                <option value="">Select mode...</option>
                {addableEventModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
    </div>
  );
}

export default TimeConfigurator;