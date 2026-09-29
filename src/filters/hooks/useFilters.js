// src/filters/hooks/useFilters.js

import { useState, useRef, useMemo, useEffect, useCallback } from "react";

import { reapplyFilterTimezone } from "../time/Time.jsx";
import { buildFilterableInputs } from "../buildFilterableInputs.js";
import { getActiveFilters } from "../filterActivity.js";
import { buildInitialFilterState } from "../initializeFilters.js";
import { matchesAllActiveFilters } from "../matchesFilters.js";

/*
 * The main FilterPanel's own state and the live filtering it drives -
 * lifted out of GlobalRuntime so the filter system is findable in the
 * folder it belongs to rather than buried among dozens of unrelated
 * runtime hooks.
 *
 * Scope note: this is the *shared* filter panel every page reuses. The
 * per-feature filters that live in the engine runtimes - a layer's or
 * an aggregate's own stored filterState, boundary clipping, per-layer
 * visibility - are deliberately not here; they belong to their own
 * features (src/layers/, src/aggregates/, src/boundaries/) and only
 * happen to reuse this module's matching engine.
 *
 * `filteredData` is produced here rather than by the caller because
 * the filtering effect and the filter state are the same concern; the
 * caller supplies `data` and the selected-item pair so a selection that
 * filters out can be cleared in the same pass.
 */
export function useFilters({
  schema,
  data,
  boundaries,
  viewerTimeZone,
  selectedDataItem,
  setSelectedDataItem,
}) {
  const [filteredData, setFilteredData] = useState([]);

  /*
   * The geometry filter's boundary clip stores an id, so matching needs
   * a way back to the polygon. Built once per boundaries change rather
   * than per data item - the filtering effect below runs this across
   * the whole dataset.
   */
  const boundariesById = useMemo(
    () => new Map((boundaries || []).map((boundary) => [String(boundary._id), boundary])),
    [boundaries],
  );

  const [filterTimezoneMode, setFilterTimezoneMode] = useState("Viewer Timezone");
  const [filterTimeZone, setFilterTimeZone] = useState(viewerTimeZone);
  const prevFilterTzRef = useRef(filterTimeZone);
  const [filterState, setFilterState] = useState({});
  const [filterStateReady, setFilterStateReady] = useState(false);
  const [timeFilterOverride, setTimeFilterOverride] = useState(false);

  const TIMEZONE_OPTIONS = useMemo(() => {
    return typeof Intl !== "undefined" && Intl.supportedValuesOf?.("timeZone")
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
  }, []);

  //Use Memo to precompute filterable inputs once on schema change
  //create a map of filterable inputs to skip reiterating over all inputs for each data
  //recompute on schema change
  const filterableInputs = useMemo(() => {
    return buildFilterableInputs(schema);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema?._id, schema?.configUpdatedAt]);

  const blankFilterStateTemplate = useMemo(() => {
    if (!schema) return null;
    return buildInitialFilterState(schema);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema?._id, schema?.configUpdatedAt]);

  //compute active filters when new filters are applied
  const activeFilters = useMemo(() => {
    return getActiveFilters(filterableInputs, filterState, timeFilterOverride);
  }, [filterableInputs, filterState, timeFilterOverride]);

  //use effect to store the previous filter timezone and then apply the new timezone
  // and convert the filter times to preserve the invariant moment in time
  //timezones are reference frames only so to change the reference
  // means the value must also change.
  useEffect(() => {
    const oldTz = prevFilterTzRef.current;
    const newTz = filterTimeZone;

    if (!oldTz || !newTz || oldTz === newTz) return;

    setFilterState((prev) => {
      const next = { ...prev };

      const timeFilter = next.time;
      if (
        timeFilter &&
        typeof timeFilter === "object" &&
        "mode" in timeFilter &&
        ("at" in timeFilter || "start" in timeFilter || "end" in timeFilter)
      ) {
        next.time = reapplyFilterTimezone(timeFilter, oldTz, newTz);
      }

      return next;
    });

    prevFilterTzRef.current = newTz;
  }, [filterTimeZone]);

  //use effect to set filter timezone state when the mode changes to viewer timezone
  useEffect(() => {
    if (filterTimezoneMode === "Viewer Timezone") {
      setFilterTimeZone(viewerTimeZone);
    }
  }, [viewerTimeZone, filterTimezoneMode]);

  const clearFilters = useCallback(() => {
    if (!blankFilterStateTemplate) return;

    setTimeFilterOverride(false);
    setFilterTimezoneMode("Viewer Timezone");
    setFilterTimeZone(viewerTimeZone);
    prevFilterTzRef.current = viewerTimeZone;
    setFilterState(structuredClone(blankFilterStateTemplate));
    setFilterStateReady(true);
  }, [blankFilterStateTemplate, viewerTimeZone]);

  // ─────────────────────────────────────────────
  // ♻️ Reset filter state when schema changes
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!blankFilterStateTemplate) return;

    setTimeFilterOverride(false);
    setFilterTimezoneMode("Viewer Timezone");
    setFilterTimeZone(viewerTimeZone);
    prevFilterTzRef.current = viewerTimeZone;
    setFilterState(structuredClone(blankFilterStateTemplate));
    setFilterStateReady(true);
  }, [blankFilterStateTemplate, viewerTimeZone]);

  // ─────────────────────────────────────────────
  // 🔎 Check Filter Matches and filter data when data/filterState change
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!schema || !filterStateReady) return;
    if (!data || data.length === 0) {
      setFilteredData([]);
      if (selectedDataItem) setSelectedDataItem(null);
      return;
    }
    const filtered =
      activeFilters.length > 0
        ? data.filter((dataItem) =>
            matchesAllActiveFilters({
              dataItem,
              activeFilters,
              filterState,
              schema,
              filterTimeZone,
              boundariesById,
            }),
          )
        : data;
    setFilteredData(filtered);
    if (
      selectedDataItem &&
      !filtered.some((dataItem) => dataItem._id === selectedDataItem._id)
    ) {
      setSelectedDataItem(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data,
    boundariesById,
    filterState,
    filterStateReady,
    schema?._id,
    schema?.configUpdatedAt,
    selectedDataItem,
    activeFilters,
    filterTimeZone,
  ]);

  return {
    filteredData,
    setFilteredData,
    filterState,
    setFilterState,
    filterStateReady,
    setFilterStateReady,
    filterableInputs,
    activeFilters,
    blankFilterStateTemplate,
    clearFilters,
    timeFilterOverride,
    setTimeFilterOverride,
    filterTimezoneMode,
    setFilterTimezoneMode,
    filterTimeZone,
    setFilterTimeZone,
    TIMEZONE_OPTIONS,
  };
}
