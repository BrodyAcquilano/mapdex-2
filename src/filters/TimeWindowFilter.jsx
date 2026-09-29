import { useState, useRef, useEffect, useMemo } from "react";
import "./TimeWindowFilter.css";
import { DateTime } from "luxon";
import { parseISOToMs } from "../../shared/validation/formValueHelpers.js";

function TimeWindowFilter({
  schema,
  data,
  selectedDataItem,
  setSelectedDataItem,
  viewerTimeZone,
  timeFilterOverride,
  filterState,
  setFilterState,
  filterTimeZone,
  setFilterTimeZone,
  filterTimezoneMode,
  setFilterTimezoneMode,
  TIMEZONE_OPTIONS,
  isMobile,
}) {
  const [hasBounds, setHasBounds] = useState(false);
  const [minTime, setMinTime] = useState(0);
  const [maxTime, setMaxTime] = useState(0);
  const [STEP, setSTEP] = useState(7 * 24 * 60 * 60 * 1000);
  const RESOLUTION = 60 * 1000;

  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);

  const sliderRef = useRef(null);
  const dragRef = useRef(null);

  const totalRange = Math.max(1, maxTime - minTime);
  const leftPct = ((start - minTime) / totalRange) * 100;
  const widthPct = ((end - start) / totalRange) * 100;

  const YEAR = 365 * 24 * 60 * 60 * 1000;

  const TIME_UNITS = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: YEAR,
    year2: 2 * YEAR,
    year5: 5 * YEAR,
    year10: 10 * YEAR,
    year20: 20 * YEAR,
    year50: 50 * YEAR,
    year100: 100 * YEAR,
  };

  const BIN_UNITS = [
    TIME_UNITS.hour,
    TIME_UNITS.day,
    TIME_UNITS.week,
    TIME_UNITS.month,
    TIME_UNITS.year,
    TIME_UNITS.year2,
    TIME_UNITS.year5,
    TIME_UNITS.year10,
    TIME_UNITS.year20,
    TIME_UNITS.year50,
    TIME_UNITS.year100,
  ];

const hasFilterableTime = useMemo(() => {
  return (
    (schema?.time?.type === "Event" ||
      schema?.time?.type === "Motion") &&
    schema?.time?.isFilter === true
  );
}, [schema?._id, schema?.configUpdatedAt]);

  const tz = filterTimeZone || viewerTimeZone || "UTC";
  const sharedTime = filterState?.time || {};
  const filterMode = sharedTime.mode || "any";

  const parsedSharedAt = sharedTime.at
    ? DateTime.fromFormat(sharedTime.at, "yyyy-LL-dd'T'HH:mm", { zone: tz })
    : null;

  const parsedSharedStart = sharedTime.start
    ? DateTime.fromFormat(sharedTime.start, "yyyy-LL-dd'T'HH:mm", { zone: tz })
    : null;

  const parsedSharedEnd = sharedTime.end
    ? DateTime.fromFormat(sharedTime.end, "yyyy-LL-dd'T'HH:mm", { zone: tz })
    : null;

  const sharedAtMs = parsedSharedAt?.isValid
    ? parsedSharedAt.toUTC().toMillis()
    : null;

  const sharedStartMs = parsedSharedStart?.isValid
    ? parsedSharedStart.toUTC().toMillis()
    : null;

  const sharedEndMs = parsedSharedEnd?.isValid
    ? parsedSharedEnd.toUTC().toMillis()
    : null;

  const isStartOutOfBounds =
    hasBounds &&
    sharedStartMs != null &&
    (sharedStartMs < minTime || sharedStartMs > maxTime);

  const isEndOutOfBounds =
    hasBounds &&
    sharedEndMs != null &&
    (sharedEndMs < minTime || sharedEndMs > maxTime);

  const isInstantOutOfBounds =
    hasBounds &&
    sharedAtMs != null &&
    (sharedAtMs < minTime || sharedAtMs > maxTime);

  const hideSliderWindow =
    !hasBounds ||
    filterMode === "any" ||
    (filterMode === "instant" && isInstantOutOfBounds) ||
    ((filterMode === "window" || filterMode === "overlap") &&
      (isStartOutOfBounds || isEndOutOfBounds));

  const showSliderWindow =
    !hideSliderWindow &&
    (filterMode === "window" || filterMode === "overlap");

  const showInstantHandle =
    !hideSliderWindow && filterMode === "instant";

  function chooseNiceStep(spanMs) {
    const raw = spanMs / 40;

    if (raw >= TIME_UNITS.year50) return TIME_UNITS.year50;
    if (raw >= TIME_UNITS.year20) return TIME_UNITS.year20;
    if (raw >= TIME_UNITS.year10) return TIME_UNITS.year10;
    if (raw >= TIME_UNITS.year5) return TIME_UNITS.year5;
    if (raw >= TIME_UNITS.year2) return TIME_UNITS.year2;
    if (raw >= TIME_UNITS.year) return TIME_UNITS.year;
    if (raw >= TIME_UNITS.month) return TIME_UNITS.month;
    if (raw >= TIME_UNITS.week) return TIME_UNITS.week;
    if (raw >= TIME_UNITS.day) return TIME_UNITS.day;

    return TIME_UNITS.hour;
  }

  function chooseBinSizeFromData(timesMs) {
    if (timesMs.length < 2) return TIME_UNITS.week;

    const sorted = [...timesMs].sort((a, b) => a - b);
    const gaps = [];

    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i] - sorted[i - 1];
      if (diff > 0) gaps.push(diff);
    }

    if (!gaps.length) return TIME_UNITS.week;

    gaps.sort((a, b) => a - b);
    const medianGap = gaps[Math.floor(gaps.length / 2)];

    let best = BIN_UNITS[0];
    let bestErr = Math.abs(medianGap - best);

    for (const unit of BIN_UNITS) {
      const err = Math.abs(medianGap - unit);
      if (err < bestErr) {
        best = unit;
        bestErr = err;
      }
    }

    return best;
  }

  function floorToStep(v, step) {
    return Math.floor(v / step) * step;
  }

  function ceilToStep(v, step) {
    return Math.ceil(v / step) * step;
  }

  function computeRangeWeightedBounds(ranges, sigma = 3) {
    if (!ranges.length) return null;

    const flatTimes = ranges.flatMap((r) => [r.start, r.end]);
    let binSize = chooseBinSizeFromData(flatTimes);

    const globalMin = Math.min(...ranges.map((r) => r.start));
    const globalMax = Math.max(...ranges.map((r) => r.end));
    const globalSpan = globalMax - globalMin;

    const MAX_TOTAL_BINS = 5000;
    const estimatedBins = globalSpan / binSize;

    if (estimatedBins > MAX_TOTAL_BINS) {
      const factor = Math.ceil(estimatedBins / MAX_TOTAL_BINS);
      binSize *= factor;
    }

    const bins = new Map();

    for (const { start, end } of ranges) {
      const firstBin = Math.floor(start / binSize) * binSize;
      const lastBin = Math.floor(end / binSize) * binSize;

      for (let b = firstBin; b <= lastBin; b += binSize) {
        const binStart = b;
        const binEnd = b + binSize;

        const overlap = Math.max(
          0,
          Math.min(end, binEnd) - Math.max(start, binStart),
        );

        if (overlap > 0) {
          const proportion = overlap / binSize;
          bins.set(b, (bins.get(b) || 0) + proportion);
        }
      }
    }

    const weightedBins = [...bins.entries()].map(([time, weight]) => ({
      time,
      weight: Math.log1p(weight),
    }));

    const totalWeight = weightedBins.reduce((sum, b) => sum + b.weight, 0);
    if (totalWeight === 0) return null;

    const mean =
      weightedBins.reduce((sum, b) => {
        const center = b.time + binSize / 2;
        return sum + center * b.weight;
      }, 0) / totalWeight;

    const variance =
      weightedBins.reduce((sum, b) => {
        const center = b.time + binSize / 2;
        return sum + b.weight * (center - mean) ** 2;
      }, 0) / totalWeight;

    const std = Math.sqrt(variance);

    return {
      lower: mean - sigma * std - 2 * binSize,
      upper: mean + sigma * std + 2 * binSize,
    };
  }

  function toZoned(ms) {
    return DateTime.fromMillis(ms, { zone: "utc" })
      .setZone(tz)
      .toFormat("yyyy-LL-dd'T'HH:mm");
  }

  function buildSharedTimeFilter(nextMode, nextStart, nextEnd) {
    if (nextMode === "any") {
      return {
        mode: "any",
        at: "",
        start: "",
        end: "",
      };
    }

    if (nextMode === "instant") {
      return {
        mode: "instant",
        at: nextStart == null ? "" : toZoned(nextStart),
        start: "",
        end: "",
      };
    }

    return {
      mode: nextMode,
      at: "",
      start: nextStart == null ? "" : toZoned(nextStart),
      end: nextEnd == null ? "" : toZoned(nextEnd),
    };
  }

  function updateSharedTime(nextMode, nextStart, nextEnd) {
    setFilterState((prev) => ({
      ...prev,
      time: buildSharedTimeFilter(nextMode, nextStart, nextEnd),
    }));
  }

  function getPrimaryInputValue() {
    if (filterMode === "instant") {
      if (sharedTime.at) return sharedTime.at;
      if (hasBounds) return toZoned(start);
      return "";
    }

    if (sharedTime.start) return sharedTime.start;
    if (hasBounds) return toZoned(start);
    return "";
  }

  function getSecondaryInputValue() {
    if (sharedTime.end) return sharedTime.end;
    if (hasBounds) return toZoned(end);
    return "";
  }

  useEffect(() => {
    if (!hasFilterableTime) {
      setHasBounds(false);
      setMinTime(0);
      setMaxTime(0);
      setStart(0);
      setEnd(0);
      return;
    }

   const ranges = [];

for (const dataItem of data || []) {
  const dataItemTime = dataItem?.time;

  // ─────────────────────────────────────────────
  // Motion
  // Treat the recording as one finite range from
  // the first sample to the last sample.
  // ─────────────────────────────────────────────
  if (
    dataItemTime?.type === "Motion" ||
    dataItemTime?.mode === "Sampled"
  ) {
    const samples = Array.isArray(dataItemTime?.samples)
      ? dataItemTime.samples
      : [];

    if (!samples.length) continue;

    const startMs = parseISOToMs(samples[0]?.timestampISO);
    const endMs = parseISOToMs(
      samples[samples.length - 1]?.timestampISO,
    );

    if (startMs != null && endMs != null) {
      ranges.push({
        start: startMs,
        end: endMs,
      });
    }

    continue;
  }

  // ─────────────────────────────────────────────
  // Event
  // Preserve existing behavior exactly.
  // ─────────────────────────────────────────────
  const dates = Array.isArray(dataItemTime?.dates)
    ? dataItemTime.dates
    : [];

  dates.forEach((d) => {
    const startMs = parseISOToMs(d?.start);
    const endMs = parseISOToMs(d?.end) ?? startMs;

    if (startMs != null) {
      ranges.push({
        start: startMs,
        end: endMs,
      });
    }
  });
}

const bounds = computeRangeWeightedBounds(ranges);

    if (!bounds) {
      setHasBounds(false);
      setMinTime(0);
      setMaxTime(0);
      setStart(0);
      setEnd(0);
      return;
    }

    const span = bounds.upper - bounds.lower;
    const step = chooseNiceStep(span);

    const snappedMin = floorToStep(bounds.lower, step);
    const snappedMax = ceilToStep(bounds.upper, step);

    setHasBounds(true);
    setSTEP(step);
    setMinTime(snappedMin);
    setMaxTime(snappedMax);

    const currentSharedTime = filterState?.time;

    if (
      !currentSharedTime ||
      !currentSharedTime.mode ||
      currentSharedTime.mode === "any"
    ) {
      setStart(snappedMin);
      setEnd(snappedMax);
    }
  }, [hasFilterableTime, data, filterState]);

  useEffect(() => {
    if (!hasFilterableTime) return;

    if (!hasBounds) {
      if (filterMode === "instant" && sharedAtMs != null) {
        setStart(sharedAtMs);
        setEnd(sharedAtMs);
        return;
      }

      if (filterMode === "window" || filterMode === "overlap") {
        if (sharedStartMs != null) setStart(sharedStartMs);
        if (sharedEndMs != null) setEnd(sharedEndMs);
      }

      return;
    }

    if (filterMode === "any") {
      setStart(minTime);
      setEnd(maxTime);
      return;
    }

    if (filterMode === "instant") {
      if (sharedAtMs != null) {
        setStart(sharedAtMs);
        setEnd(sharedAtMs);
        return;
      }

      const midpoint = Math.round((minTime + maxTime) / 2);
      setStart(midpoint);
      setEnd(midpoint);
      updateSharedTime("instant", midpoint, midpoint);
      return;
    }

    if (filterMode === "window" || filterMode === "overlap") {
      if (sharedStartMs != null && sharedEndMs != null) {
        setStart(sharedStartMs);
        setEnd(sharedEndMs);
        return;
      }

      setStart(minTime);
      setEnd(maxTime);
      updateSharedTime(filterMode, minTime, maxTime);
    }
  }, [
    filterMode,
    sharedAtMs,
    sharedStartMs,
    sharedEndMs,
    hasFilterableTime,
    hasBounds,
    minTime,
    maxTime,
  ]);

  useEffect(() => {
    if (!selectedDataItem || !Array.isArray(data)) return;

    const stillExists = data.some((d) => d._id === selectedDataItem._id);
    if (!stillExists) {
      setSelectedDataItem(null);
    }
  }, [data, selectedDataItem, setSelectedDataItem]);

  function onWindowMouseDown(e) {
    if (timeFilterOverride) return;
    if (filterMode !== "window" && filterMode !== "overlap") return;
    if (hideSliderWindow) return;

    dragRef.current = {
      start0: start,
      end0: end,
      x0: e.clientX,
      widthPx: sliderRef.current.offsetWidth,
    };

    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);
  }

  function onWindowMouseMove(e) {
    if (!dragRef.current) return;

    const { start0, end0, x0, widthPx } = dragRef.current;
    const dx = e.clientX - x0;

    const rawDelta = (dx / widthPx) * totalRange;
    const rawStart = start0 + rawDelta;

    const snappedStart =
      minTime + Math.round((rawStart - minTime) / STEP) * STEP;

    const width = end0 - start0;

    let nextStart = snappedStart;
    let nextEnd = nextStart + width;

    if (nextStart < minTime) {
      nextStart = minTime;
      nextEnd = minTime + width;
    }
    if (nextEnd > maxTime) {
      nextEnd = maxTime;
      nextStart = maxTime - width;
    }

    setStart(nextStart);
    setEnd(nextEnd);
    updateSharedTime(filterMode, nextStart, nextEnd);
  }

  function onWindowMouseUp() {
    dragRef.current = null;
    window.removeEventListener("mousemove", onWindowMouseMove);
    window.removeEventListener("mouseup", onWindowMouseUp);
  }

  if (!hasFilterableTime) return null;

  return (
    <div className="time-window-pill" aria-disabled={timeFilterOverride}>
      <div className="time-window-labels">
        <select
          className="time-mode-select"
          value={filterMode}
          disabled={timeFilterOverride}
          onChange={(e) => {
            const nextMode = e.target.value;

            if (nextMode === "any") {
              updateSharedTime("any", start, end);
              return;
            }

            if (nextMode === "overlap") {
              if (hasBounds) {
                const nextStart = filterMode === "any" ? minTime : start;
                const nextEnd = filterMode === "any" ? maxTime : end;
                setStart(nextStart);
                setEnd(nextEnd);
                updateSharedTime("overlap", nextStart, nextEnd);
              } else {
                updateSharedTime("overlap", null, null);
              }
              return;
            }

            if (nextMode === "window") {
              if (hasBounds) {
                const nextStart = filterMode === "any" ? minTime : start;
                const nextEnd = filterMode === "any" ? maxTime : end;
                setStart(nextStart);
                setEnd(nextEnd);
                updateSharedTime("window", nextStart, nextEnd);
              } else {
                updateSharedTime("window", null, null);
              }
              return;
            }

            if (nextMode === "instant") {
              if (hasBounds) {
                const nextValue =
                  filterMode === "any"
                    ? Math.round((minTime + maxTime) / 2)
                    : Math.round((start + end) / 2);

                setStart(nextValue);
                setEnd(nextValue);
                updateSharedTime("instant", nextValue, nextValue);
              } else {
                updateSharedTime("instant", null, null);
              }
            }
          }}
        >
          <option value="any">Any Time</option>
          <option value="overlap">Overlaps selected time window</option>
          <option value="window">Fully inside selected time window</option>
          <option value="instant">Contains selected instant</option>
        </select>
      </div>

      {filterMode === "any" ? (
        <div className="time-window-labels">
          <div className="label-row-empty"></div>
        </div>
      ) : (
        <div className="time-window-labels">
          <div className="label-row">
            <div className="label-block">
              <label>
                {filterMode === "window" || filterMode === "overlap"
                  ? "Time Window Start"
                  : "Instant"}
              </label>
              <input
                type="datetime-local"
                value={getPrimaryInputValue()}
                disabled={timeFilterOverride}
                onChange={(e) => {
                  if (!e.target.value) {
                    if (filterMode === "instant") {
                      updateSharedTime("instant", null, null);
                    } else {
                      updateSharedTime(filterMode, null, sharedEndMs);
                    }
                    return;
                  }

                  const dt = DateTime.fromFormat(
                    e.target.value,
                    "yyyy-LL-dd'T'HH:mm",
                    { zone: tz },
                  );
                  if (!dt.isValid) return;

                  let valueMs = dt.toUTC().toMillis();

                  if (
                    hasBounds &&
                    !isMobile &&
                    (filterMode === "window" || filterMode === "overlap") &&
                    valueMs > end - STEP
                  ) {
                    valueMs = end - STEP;
                  }

                  setStart(valueMs);

                  if (filterMode === "instant") {
                    setEnd(valueMs);
                    updateSharedTime("instant", valueMs, valueMs);
                  } else {
                    updateSharedTime(filterMode, valueMs, sharedEndMs);
                  }
                }}
              />
            </div>

            {(filterMode === "window" || filterMode === "overlap") && (
              <div className="label-block">
                <label>Time Window End</label>
                <input
                  type="datetime-local"
                  disabled={timeFilterOverride}
                  value={getSecondaryInputValue()}
                  onChange={(e) => {
                    if (!e.target.value) {
                      updateSharedTime(filterMode, sharedStartMs, null);
                      return;
                    }

                    const dt = DateTime.fromFormat(
                      e.target.value,
                      "yyyy-LL-dd'T'HH:mm",
                      { zone: tz },
                    );
                    if (!dt.isValid) return;

                    let valueMs = dt.toUTC().toMillis();

                    if (hasBounds && !isMobile && valueMs < start + STEP) {
                      valueMs = start + STEP;
                    }

                    setEnd(valueMs);
                    updateSharedTime(filterMode, sharedStartMs, valueMs);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {!isMobile && (
  <>
    <div className="time-window-slider" ref={sliderRef}>
      <div className="slider-groove" />

      {hasBounds && showSliderWindow && (
        <>
          <input
            type="range"
            disabled={timeFilterOverride}
            min={minTime}
            max={maxTime}
            step={RESOLUTION}
            value={start}
            onChange={(e) => {
              let valueMs = Number(e.target.value);
              if (valueMs > end - STEP) valueMs = end - STEP;
              setStart(valueMs);
              updateSharedTime(filterMode, valueMs, end);
            }}
            className="handle handle-start"
          />

          <div
            className="window-track"
            style={{
              left: `calc(${leftPct}% - 7px)`,
              width: `calc(${widthPct}% + 0px)`,
            }}
            onMouseDown={onWindowMouseDown}
          />
        </>
      )}

      {hasBounds && showInstantHandle && (
        <input
          type="range"
          disabled={timeFilterOverride}
          min={minTime}
          max={maxTime}
          step={RESOLUTION}
          value={end}
          onChange={(e) => {
            const valueMs = Number(e.target.value);
            setStart(valueMs);
            setEnd(valueMs);
            updateSharedTime("instant", valueMs, valueMs);
          }}
          className="handle handle-end"
        />
      )}

      {hasBounds && showSliderWindow && (
        <input
          type="range"
          disabled={timeFilterOverride}
          min={minTime}
          max={maxTime}
          step={RESOLUTION}
          value={end}
          onChange={(e) => {
            let valueMs = Number(e.target.value);
            if (valueMs < start + STEP) valueMs = start + STEP;
            setEnd(valueMs);
            updateSharedTime(filterMode, start, valueMs);
          }}
          className="handle handle-end"
        />
      )}
    </div>

    <div className="time-window-controls">
      {!hideSliderWindow ? (
        <>
          <button
            className="step-backward"
            disabled={timeFilterOverride}
            onClick={() => {
              if (filterMode === "instant") {
                if (start - STEP < minTime) return;
                const valueMs = start - STEP;
                setStart(valueMs);
                setEnd(valueMs);
                updateSharedTime("instant", valueMs, valueMs);
              } else {
                if (start - STEP < minTime) return;
                const nextStart = start - STEP;
                const nextEnd = end - STEP;
                setStart(nextStart);
                setEnd(nextEnd);
                updateSharedTime(filterMode, nextStart, nextEnd);
              }
            }}
          >
            ◀ Step
          </button>

          <select
            className="time-zone-select"
            value={filterTimeZone}
            onChange={(e) => {
              const nextTz = e.target.value;
              setFilterTimeZone(nextTz);
              setFilterTimezoneMode(
                nextTz === viewerTimeZone
                  ? "Viewer Timezone"
                  : "Override Timezone",
              );
            }}
          >
            {TIMEZONE_OPTIONS.map((tzOption) => (
              <option key={tzOption} value={tzOption}>
                {tzOption}
              </option>
            ))}
          </select>

          <button
            className="step-forward"
            disabled={timeFilterOverride}
            onClick={() => {
              if (filterMode === "instant") {
                if (start + STEP > maxTime) return;
                const valueMs = start + STEP;
                setStart(valueMs);
                setEnd(valueMs);
                updateSharedTime("instant", valueMs, valueMs);
              } else {
                if (end + STEP > maxTime) return;
                const nextStart = start + STEP;
                const nextEnd = end + STEP;
                setStart(nextStart);
                setEnd(nextEnd);
                updateSharedTime(filterMode, nextStart, nextEnd);
              }
            }}
          >
            Step ▶
          </button>
        </>
      ) : (
        <>
          <div className="time-window-controls-empty" />
          <select
            className="time-zone-select"
            value={filterTimeZone}
            onChange={(e) => {
              const nextTz = e.target.value;
              setFilterTimeZone(nextTz);
              setFilterTimezoneMode(
                nextTz === viewerTimeZone
                  ? "Viewer Timezone"
                  : "Override Timezone",
              );
            }}
          >
            {TIMEZONE_OPTIONS.map((tzOption) => (
              <option key={tzOption} value={tzOption}>
                {tzOption}
              </option>
            ))}
          </select>
          <div className="time-window-controls-empty" />
        </>
      )}
    </div>
  </>
)}
    </div>
  );
}

export default TimeWindowFilter;