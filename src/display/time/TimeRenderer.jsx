import { DateTime } from "luxon";

export default function TimeRenderer({
  selectedDataItem,
  schema,
  viewerTimeZone,
  displayTimeMode,
  setDisplayTimeMode,
  overrideTimeZone,
  setOverrideTimeZone,
}) {
  const timeSchema = schema?.time;
  const timeData = selectedDataItem?.time;

  if (!timeSchema) return null;
  if (!timeData?.timezone) return null;

  const hasDates = Array.isArray(timeData.dates) && timeData.dates.length > 0;

  const shouldShowControls =
    timeSchema.type === "Event" && hasDates;

  return (
    <div className="section" key="time-section">
      <h3>{timeSchema.label || "Time"}</h3>

      <div className="notes-cell">Source Timezone: {timeData.timezone}</div>
      <br />

      {shouldShowControls && (
        <DisplayTimezoneControls
          viewerTimeZone={viewerTimeZone}
          displayTimeMode={displayTimeMode}
          setDisplayTimeMode={setDisplayTimeMode}
          overrideTimeZone={overrideTimeZone}
          setOverrideTimeZone={setOverrideTimeZone}
          sourceTimeZone={timeData.timezone}
        />
      )}

      {timeSchema.type === "Event" && hasDates && timeSchema.isDisplayed && (
        renderEventTime(
          timeData,
          viewerTimeZone,
          shouldShowControls ? displayTimeMode : "source",
          shouldShowControls ? overrideTimeZone : timeData.timezone,
        )
      )}
    </div>
  );
}

function renderEventTime(
  timeData,
  viewerTimeZone,
  displayTimeMode,
  overrideTimeZone,
) {
  const mode = timeData.mode;
  const timezone = timeData.timezone;
  const dates = Array.isArray(timeData.dates) ? timeData.dates : [];

  if (!dates.length || !timezone) return null;

  const fmt = "ccc, LLL d, yyyy • h:mm a";
  const showOccurrenceHeader = dates.length > 1;

  return (
    <div role="group" aria-label="Time">
      {dates.map((row, i) => {
        const startISO = row?.start;
        const endISO = row?.end;

        if (!startISO) return null;

        const targetTz =
          displayTimeMode === "override"
            ? overrideTimeZone
            : displayTimeMode === "viewer"
              ? viewerTimeZone
              : timezone;

        const start = DateTime.fromISO(startISO, { zone: "utc" }).setZone(
          targetTz,
        );

        const end =
          endISO != null
            ? DateTime.fromISO(endISO, { zone: "utc" }).setZone(targetTz)
            : null;

        return (
          <div key={i}>
            {showOccurrenceHeader && <h5>Occurrence {i + 1}</h5>}

            {mode === "Range" && (
              <>
                <div className="inline-row">
                  <span className="label-container">Start:</span>
                  <span className="value-container">{start.toFormat(fmt)}</span>
                </div>

                {end && (
                  <div className="inline-row">
                    <span className="label-container">End:</span>
                    <span className="value-container">{end.toFormat(fmt)}</span>
                  </div>
                )}
              </>
            )}

            {mode === "Instant" && (
              <div className="inline-row">
                <span className="label-container">Time:</span>
                <span className="value-container">{start.toFormat(fmt)}</span>
              </div>
            )}

            {mode === "Ongoing" && (
              <div className="inline-row">
                <span className="label-container">Since:</span>
                <span className="value-container">{start.toFormat(fmt)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DisplayTimezoneControls({
  viewerTimeZone,
  displayTimeMode,
  setDisplayTimeMode,
  overrideTimeZone,
  setOverrideTimeZone,
  sourceTimeZone,
}) {
  const TIMEZONE_OPTIONS =
    typeof Intl !== "undefined" && Intl.supportedValuesOf?.("timeZone")
      ? Intl.supportedValuesOf("timeZone")
      : [
          "UTC",
          "America/Toronto",
          "America/New_York",
          "America/Chicago",
          "America/Denver",
          "America/Los_Angeles",
          "Europe/London",
          "Europe/Paris",
        ];

  return (
    <div className="form-subgroup">
      <div className="form-group">
        <label className="label-container">Display Time As:</label>
        <select
          className="value-container"
          value={displayTimeMode}
          onChange={(e) => setDisplayTimeMode(e.target.value)}
        >
          <option value="source">Source Timezone</option>
          <option value="viewer">Your Timezone ({viewerTimeZone})</option>
          <option value="override">Override Timezone</option>
        </select>
      </div>

      {displayTimeMode === "override" && (
        <div className="form-group">
          <label className="label-container">Override Timezone:</label>
          <select
            className="value-container"
            value={overrideTimeZone}
            onChange={(e) => setOverrideTimeZone(e.target.value)}
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="notes-cell">
        Using Timezone:{" "}
        {displayTimeMode === "override"
          ? overrideTimeZone
          : displayTimeMode === "viewer"
            ? viewerTimeZone
            : sourceTimeZone || "Source Timezone"}
      </div>
      <br />
    </div>
  );
}