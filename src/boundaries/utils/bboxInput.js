// src/boundaries/utils/bboxInput.js

/*
 * The text-input machinery behind a bounding box's min/max lat/lng
 * fields - clamping partial input as it's typed, finalising it on
 * blur, and keeping min <= max.
 *
 * Moved out of src/filters/geometry/Geometry.jsx when the bounding box
 * moved into BoundaryPickerPanel alongside the boundary list: the
 * filter panel now only displays the box, so the code that edits it
 * belongs with the panel that does.
 */

export function clampCoordStr(raw, { min, max, maxLen, finalize = false }) {
  if (raw == null || raw === "") return "";

  let s = String(raw).replace(/[^\d.-]/g, "");

  const minusIndex = s.indexOf("-");
  if (minusIndex > 0) {
    s = s.replace(/-/g, "");
  } else if (minusIndex === 0) {
    s = `-${s.slice(1).replace(/-/g, "")}`;
  }

  const dotIndex = s.indexOf(".");
  if (dotIndex !== -1) {
    s = s.slice(0, dotIndex + 1) + s.slice(dotIndex + 1).replace(/\./g, "");
  }

  if (maxLen && s.length > maxLen) {
    s = s.slice(0, maxLen);
  }

  if (!finalize && (s === "" || s === "-" || s === "." || s === "-.")) {
    return s;
  }

  if (s === "" || s === "-" || s === "." || s === "-.") {
    return "";
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return "";

  if (!finalize) {
    return s;
  }

  const clamped = Math.max(min, Math.min(max, n));
  return String(clamped);
}

export function enforceCoordOrder(value, axis, changedField) {
  const axisValue = value?.[axis] || { min: "", max: "" };
  const { min, max } = axisValue;

  if (min === "" || max === "") {
    return value;
  }

  const minN = Number(min);
  const maxN = Number(max);

  if (!Number.isFinite(minN) || !Number.isFinite(maxN)) {
    return value;
  }

  if (changedField === "min" && minN > maxN) {
    return {
      ...value,
      [axis]: {
        ...axisValue,
        min: String(maxN),
      },
    };
  }

  if (changedField === "max" && maxN < minN) {
    return {
      ...value,
      [axis]: {
        ...axisValue,
        max: String(minN),
      },
    };
  }

  return value;
}

export function finalizeCoordFilterValue(value, axis, field, limits) {
  const axisValue = value?.[axis] || { min: "", max: "" };

  const finalized = clampCoordStr(axisValue[field], {
    ...limits,
    finalize: true,
  });

  const nextValue = {
    ...value,
    [axis]: {
      ...axisValue,
      [field]: finalized,
    },
  };

  return enforceCoordOrder(nextValue, axis, field);
}