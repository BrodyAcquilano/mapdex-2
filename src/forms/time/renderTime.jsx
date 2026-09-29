// src/forms/time/renderTime.jsx

import { DateTime } from "luxon";
import { useState } from "react";
import {
  getDefaultDurationMinutes,
  dateTimeLocalToISO,
} from "../../../shared/validation/formValueHelpers.js";

import { getViewerTimeZone } from "../getViewerTimezone.js";

import "../../styles/modals.css";
import "../../styles/panels.css";
import "./time.css";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const RECURRENCE_OFFSETS = {
  "1 Day": DAY,
  "1 Week": WEEK,
  "1 Month": MONTH,
  "1 Year": YEAR,
  "2 Years": 2 * YEAR,
  "5 Years": 5 * YEAR,
  "10 Years": 10 * YEAR,
  "20 Years": 20 * YEAR,
  "50 Years": 50 * YEAR,
  "100 Years": 100 * YEAR,
};

export default function TimeRenderer({ formData, setFormData, schema }) {
  const [recurrence, setRecurrence] = useState("1 Week");

  const timeType = formData?.time?.type;
  const timezone = formData?.time?.timezone || getViewerTimeZone();

  if (!timeType) return null;

  const shouldShowTimezoneOnly =
    timeType !== "Event" ||
    schema?.engineKey === "presence" ||
    schema?.engineKey === "motion";

  if (shouldShowTimezoneOnly) {
    return (
      <div className="section" role="region" aria-labelledby="time-heading">
        <h3 id="time-heading">{schema?.time?.label || "Time"}</h3>
        <div className="notes-cell">Timezone: {timezone}</div>
      </div>
    );
  }

  const allowedModes = Array.isArray(schema?.time?.modes)
    ? schema.time.modes
    : ["Range", "Instant", "Ongoing"];

  const modes = allowedModes.length > 0 ? allowedModes : ["Range"];

  const mode = modes.includes(formData.time?.mode)
    ? formData.time.mode
    : modes[0];

  const dates = Array.isArray(formData.time?.dates) ? formData.time.dates : [];
  const eventTz = timezone;
  const recurrenceMs = RECURRENCE_OFFSETS[recurrence] || WEEK;

  const createDefaultDateRow = (nextMode) => {
    const startMs = Date.now();
    const durationMin = getDefaultDurationMinutes(schema.time);
    const durationMs = durationMin * 60000;

    if (nextMode === "Instant") {
      return {
        start: new Date(startMs).toISOString(),
        end: new Date(startMs).toISOString(),
      };
    }

    if (nextMode === "Ongoing") {
      return {
        start: new Date(startMs).toISOString(),
        end: null,
      };
    }

    return {
      start: new Date(startMs).toISOString(),
      end: new Date(startMs + durationMs).toISOString(),
    };
  };

  const clampDatesChain = (rows, currentMode) => {
    const next = rows.map((d) => ({ ...d }));
    let prevEndMs = null;

    for (let i = 0; i < next.length; i++) {
      const row = next[i];

      let startMs = row.start ? Date.parse(row.start) : null;
      let endMs =
        currentMode === "Ongoing" || row.end == null
          ? null
          : Date.parse(row.end);

      if (prevEndMs != null && startMs != null && startMs < prevEndMs) {
        startMs = prevEndMs;
        row.start = new Date(startMs).toISOString();
      }

      if (currentMode !== "Ongoing") {
        if (endMs != null && startMs != null && endMs < startMs) {
          endMs = startMs;
          row.end = new Date(endMs).toISOString();
        }
      } else {
        row.end = null;
        endMs = null;
      }

      prevEndMs = currentMode === "Ongoing" ? startMs : (endMs ?? startMs);
    }

    return next;
  };

  const updateDates = (updater) => {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const time = next.time;

      const rawDates =
        typeof updater === "function" ? updater(time.dates || []) : updater;

      time.dates = clampDatesChain(rawDates, time.mode);
      return next;
    });
  };

  const updateDate = (idx, patch) => {
    updateDates((rows) => {
      const next = [...rows];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addDate = () => {
    const durationMin = getDefaultDurationMinutes(schema.time);
    const durationMs = durationMin * 60000;

    updateDates((rows) => {
      let startMs;

      if (rows.length === 0) {
        startMs = Date.now();
      } else {
        const prev = rows[rows.length - 1];
        const prevStartMs = Date.parse(prev.start);
        startMs = prevStartMs + recurrenceMs;
      }

      let endMs = null;

      if (mode === "Instant") {
        endMs = startMs;
      } else if (mode === "Range") {
        endMs = startMs + durationMs;
      } else if (mode === "Ongoing") {
        endMs = null;
      }

      return [
        ...rows,
        {
          start: new Date(startMs).toISOString(),
          end: endMs != null ? new Date(endMs).toISOString() : null,
        },
      ];
    });
  };

  const deleteDate = (idx) => {
    if (mode === "Ongoing") return;

    updateDates((rows) => {
      if (rows.length === 1) return rows;
      const next = [...rows];
      next.splice(idx, 1);
      return next;
    });
  };

  return (
    <div className="section" role="region" aria-labelledby="time-heading">
      <h3 id="time-heading">{schema?.time?.label || "Time"}</h3>

      <div className="datetime-range-form-group">
        <div className="notes-cell">Timezone: {eventTz}</div>

        <label className="datetime-range-label">Event Mode:</label>
        <select
          value={mode}
          className="datetime-range-value"
          onChange={(e) => {
            const newMode = e.target.value;

            setFormData((prev) => {
              const next = structuredClone(prev);
              const time = next.time;

              let nextDates = [...(time.dates || [])];

              if (nextDates.length === 0) {
                nextDates = [createDefaultDateRow(newMode)];
              } else if (newMode === "Instant") {
                nextDates = nextDates.map((d) => ({
                  ...d,
                  end: d.start,
                }));
              } else if (newMode === "Ongoing") {
                nextDates = nextDates.length
                  ? [{ ...nextDates[0], end: null }]
                  : [];
              }

              if (
                time.mode === "Ongoing" &&
                newMode === "Range" &&
                nextDates[0]
              ) {
                const d = nextDates[0];
                const startMs = Date.parse(d.start);
                const durationMin = getDefaultDurationMinutes(schema.time);
                d.end = new Date(startMs + durationMin * 60000).toISOString();
              }

              if (newMode === "Range") {
                nextDates = nextDates.map((d) => {
                  const startMs = Date.parse(d.start);

                  if (!d.end && Number.isFinite(startMs)) {
                    const durationMin = getDefaultDurationMinutes(schema.time);
                    return {
                      ...d,
                      end: new Date(
                        startMs + durationMin * 60000,
                      ).toISOString(),
                    };
                  }

                  return d;
                });
              }

              time.mode = newMode;
              time.dates = clampDatesChain(nextDates, newMode);

              return next;
            });
          }}
        >
          {modes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {mode !== "Ongoing" && (
          <>
            <label className="datetime-range-label">Recurrence Offset:</label>
            <select
              value={recurrence}
              className="datetime-range-value"
              onChange={(e) => setRecurrence(e.target.value)}
            >
              {Object.keys(RECURRENCE_OFFSETS).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </>
        )}

        {dates.map((row, idx) => {
          const startLocal = row.start
            ? DateTime.fromISO(row.start, { zone: eventTz }).toFormat(
                "yyyy-LL-dd'T'HH:mm",
              )
            : "";

          const endLocal = row.end
            ? DateTime.fromISO(row.end, { zone: eventTz }).toFormat(
                "yyyy-LL-dd'T'HH:mm",
              )
            : "";

          return (
            <div key={idx} className="datetime-range-form-group">
              {dates.length > 1 && <h5>Occurrence {idx + 1}</h5>}

              <div className="datetime-range-row">
                <div className="datetime-range-field">
                  <label className="datetime-range-label">
                    {mode === "Instant" ? "Time:" : "Start Time:"}
                  </label>
                  <input
                    type="datetime-local"
                    value={startLocal}
                    onChange={(e) =>
                      updateDate(idx, {
                        start: dateTimeLocalToISO(e.target.value, eventTz),
                        end:
                          mode === "Instant"
                            ? dateTimeLocalToISO(e.target.value, eventTz)
                            : row.end,
                      })
                    }
                    onBlur={() => updateDates((d) => d)}
                  />
                </div>

                {mode === "Range" && (
                  <div className="datetime-range-field">
                    <label className="datetime-range-label">End Time:</label>
                    <input
                      type="datetime-local"
                      value={endLocal}
                      onChange={(e) =>
                        updateDate(idx, {
                          end: dateTimeLocalToISO(e.target.value, eventTz),
                        })
                      }
                      onBlur={() => updateDates((d) => d)}
                    />
                  </div>
                )}

                {mode !== "Ongoing" && dates.length > 1 && (
                  <div className="buttons-container-two">
                    <button
                      type="button"
                      className="form-delete-button"
                      onClick={() => deleteDate(idx)}
                      aria-label={`Delete occurrence ${idx + 1}`}
                    >
                      −
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {mode !== "Ongoing" && (
          <div className="buttons-container-two">
            <button type="button" className="form-add-button" onClick={addDate}>
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
