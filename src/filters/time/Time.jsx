import { DateTime } from "luxon";
import { parseISOToMs, parseDatetimeLocalToMs } from "../../../shared/validation/formValueHelpers.js";

const DEFAULT_TIME_FILTER = {
  mode: "any",
  at: "",
  start: "",
  end: "",
};

const TIME_FILTER_MODES = [
  {
    value: "overlap",
    label: "Overlaps selected time window",
  },
  {
    value: "window",
    label: "Fully inside selected time window",
  },
  {
    value: "instant",
    label: "Contains selected instant",
  },
];


function normalizeTimeFilterValue(filterValue) {
  return filterValue && typeof filterValue === "object"
    ? filterValue
    : DEFAULT_TIME_FILTER;
}

function clampTimeRange(next) {
  if (next.start && next.end && next.start > next.end) {
    return { ...next, end: next.start };
  }
  return next;
}

function buildClearedTimeFilter() {
  return {
    mode: "any",
    at: "",
    start: "",
    end: "",
  };
}

function buildTimeFilterForMode(nextMode, value) {
  if (nextMode === "any") {
    return buildClearedTimeFilter();
  }

  if (nextMode === "instant") {
    return {
      mode: "instant",
      at: value.at ?? "",
      start: "",
      end: "",
    };
  }

  return {
    mode: nextMode,
    at: "",
    start: value.start ?? "",
    end: value.end ?? "",
  };
}

export function renderTimeFilterSection({
  schema,
  filterState,
  setFilterState,
  filterTimeZone,
  setFilterTimeZone,
  filterTimezoneMode,
  setFilterTimezoneMode,
  viewerTimeZone,
  timeFilterOverride,
  setTimeFilterOverride,
  TIMEZONE_OPTIONS,
}) {
  if (!schema) return null;

const hasTimeFilter =
  (schema?.time?.type === "Event" ||
    schema?.time?.type === "Motion") &&
  schema?.time?.isFilter === true;

if (!hasTimeFilter) return null;

  const schemaTime = schema.time || {};
  const filterValue = normalizeTimeFilterValue(filterState?.time);

  const setFilterValue = (newValue) =>
    setFilterState((prev) => ({
      ...prev,
      time: newValue,
    }));

  const modeId = "filter-time-mode";
  const atId = "filter-time-at";
  const startId = "filter-time-start";
  const endId = "filter-time-end";

  const showOverrideTimezoneSelect =
    filterTimezoneMode === "Override Timezone";

  const firstOverrideTimezone =
    TIMEZONE_OPTIONS.find((tz) => tz !== viewerTimeZone) ||
    TIMEZONE_OPTIONS[0] ||
    viewerTimeZone;

  const showAt = filterValue.mode === "instant";
  const showRange =
    filterValue.mode === "window" || filterValue.mode === "overlap";

  return (
    <div
      className="section"
      role="region"
      aria-labelledby="section-title-time-filter"
    >
      <h3 id="section-title-time-filter">{schemaTime.label || "Time"}</h3>

      <div className="form-group">
        <div className="form-subgroup">
          <div className="inline-checkbox-row">
            <div className="checkbox-container">
              <input
                type="checkbox"
                id="time-override-filter"
                checked={timeFilterOverride}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setTimeFilterOverride(checked);

                  if (!checked) {
                    setFilterValue(buildClearedTimeFilter());
                  }
                }}
              />
            </div>
            <label
              className="label-container-long"
              htmlFor="time-override-filter"
            >
              Hide Time Window Filter
            </label>
          </div>

          <div className="form-group">
            <label className="label-container">Filter Timezone:</label>
            <select
              className="value-container"
              value={filterTimezoneMode}
              onChange={(e) => {
                const nextMode = e.target.value;

                if (nextMode === "Viewer Timezone") {
                  setFilterTimezoneMode("Viewer Timezone");
                  setFilterTimeZone(viewerTimeZone);
                  return;
                }

                setFilterTimezoneMode("Override Timezone");
                setFilterTimeZone(firstOverrideTimezone);
              }}
            >
              <option value="Viewer Timezone">
                Your Timezone ({viewerTimeZone})
              </option>
              <option value="Override Timezone">Override Timezone</option>
            </select>
          </div>

          {showOverrideTimezoneSelect && (
            <div className="form-group">
              <label className="label-container">Override Timezone:</label>
              <select
                className="value-container"
                value={filterTimeZone}
                onChange={(e) => {
                  const nextTz = e.target.value;

                  if (nextTz === viewerTimeZone) {
                    setFilterTimezoneMode("Viewer Timezone");
                    setFilterTimeZone(viewerTimeZone);
                    return;
                  }

                  setFilterTimezoneMode("Override Timezone");
                  setFilterTimeZone(nextTz);
                }}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

          <div className="form-subgroup">
            <div className="form-group">
              <label className="label-container" htmlFor={modeId}>
                {schemaTime.label || "Time"}:
              </label>
              <select
                id={modeId}
                className="value-container"
                value={filterValue.mode}
                onChange={(e) =>
                  setFilterValue(
                    buildTimeFilterForMode(e.target.value, filterValue),
                  )
                }
              >
                <option value="any">Any Time</option>
                {TIME_FILTER_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {showAt && (
              <div className="form-group">
                <label className="label-container" htmlFor={atId}>
                  Instant:
                </label>
                <input
                  id={atId}
                  type="datetime-local"
                  className="datetime-range-field"
                  value={filterValue.at || ""}
                  onChange={(e) =>
                    setFilterValue({ ...filterValue, at: e.target.value })
                  }
                />
              </div>
            )}

            {showRange && (
              <>
                <div className="form-group">
                  <label className="label-container" htmlFor={startId}>
                    Time window start:
                  </label>
                  <input
                    id={startId}
                    type="datetime-local"
                    className="datetime-range-field"
                    value={filterValue.start || ""}
                    onChange={(e) =>
                      setFilterValue(
                        clampTimeRange({
                          ...filterValue,
                          start: e.target.value,
                        }),
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="label-container" htmlFor={endId}>
                    Time window end:
                  </label>
                  <input
                    id={endId}
                    type="datetime-local"
                    className="datetime-range-field"
                    value={filterValue.end || ""}
                    onChange={(e) =>
                      setFilterValue(
                        clampTimeRange({
                          ...filterValue,
                          end: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
              </>
            )}
          </div>
        
      </div>
    </div>
  );
}

// helper to convert filter date time strings when timezone changes
export function reapplyFilterTimezone(filterValue, oldTz, newTz) {
  if (!filterValue || typeof filterValue !== "object") return filterValue;

  const convert = (localStr) => {
    if (!localStr) return localStr;

    const dt = DateTime.fromFormat(localStr, "yyyy-LL-dd'T'HH:mm", {
      zone: oldTz,
    });

    if (!dt.isValid) return localStr;

    return dt.setZone(newTz).toFormat("yyyy-LL-dd'T'HH:mm");
  };

  return {
    ...filterValue,
    at: convert(filterValue.at),
    start: convert(filterValue.start),
    end: convert(filterValue.end),
  };
}

export function getDataTimeRanges(dataItemTime) {
  if (!dataItemTime) return [];

  // ─────────────────────────────────────────────
  // Motion
  // ─────────────────────────────────────────────
  if (
    dataItemTime.type === "Motion" ||
    dataItemTime.mode === "Sampled"
  ) {
    const samples = Array.isArray(dataItemTime.samples)
      ? dataItemTime.samples
      : [];

    if (!samples.length) return [];

    const firstSample = samples[0];
    const lastSample = samples[samples.length - 1];

    const startMs = parseISOToMs(firstSample?.timestampISO);
    const endMs = parseISOToMs(lastSample?.timestampISO);

    if (startMs == null || endMs == null) {
      return [];
    }

    return [
      {
        dataStart: startMs,
        dataEnd: endMs,
      },
    ];
  }

  // ─────────────────────────────────────────────
  // Event
  // ─────────────────────────────────────────────
  const mode = dataItemTime.mode;
  const dates = Array.isArray(dataItemTime.dates)
    ? dataItemTime.dates
    : [];

  return dates
    .map((d) => {
      const startMs = parseISOToMs(d?.start);
      if (startMs == null) return null;

      let endMs;

      if (mode === "Ongoing") {
        endMs = Infinity;
      } else {
        const parsedEnd = parseISOToMs(d?.end);
        if (parsedEnd == null) return null;
        endMs = parsedEnd;
      }

      return {
        dataStart: startMs,
        dataEnd: endMs,
      };
    })
    .filter(Boolean);
}

// Datetime range filter logic (panel override)
// Modes:
// - any
// - overlap
// - window
// - instant
export function matchesTimeFilter(filterValue, dataItemTime, tz) {
  if (!filterValue) return true;

  const mode = filterValue.mode ?? "any";
  if (mode === "any") return true;

  const ranges = getDataTimeRanges(dataItemTime);
  if (!ranges.length) return false;

  // ── Instant ─────────────────────────────────
  if (mode === "instant") {
    const atMs = parseDatetimeLocalToMs(filterValue.at, tz);
    if (atMs == null) return true;

    return ranges.some(
      ({ dataStart, dataEnd }) => atMs >= dataStart && atMs <= dataEnd,
    );
  }

  const startMs = parseDatetimeLocalToMs(filterValue.start, tz);
  const endMs = parseDatetimeLocalToMs(filterValue.end, tz);

  const windowStart = startMs ?? -Infinity;
  const windowEnd = endMs ?? Infinity;

  // ── Window (data fully contained) ──────────
  if (mode === "window") {
    return ranges.some(
      ({ dataStart, dataEnd }) =>
        dataStart >= windowStart && dataEnd <= windowEnd,
    );
  }

  // ── Overlap (ANY overlap) ───────────────────
  if (mode === "overlap") {
    return ranges.some(
      ({ dataStart, dataEnd }) =>
        windowStart <= dataEnd && dataStart <= windowEnd,
    );
  }

  return true;
}

export function createTimeFilterState() {
  return {
    mode: "any",
    at: "",
    start: "",
    end: "",
  };
}

export function isTimeFilterActive(value) {
  if (!value?.mode || value.mode === "any") return false;
  if (value.mode === "instant") return !!value.at;
  if (value.mode === "window" || value.mode === "overlap") {
    return !!value.start || !!value.end;
  }
  return false;
}