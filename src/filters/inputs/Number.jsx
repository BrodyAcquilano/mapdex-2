function parseNum(raw) {
  if (raw === "" || raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function clampNumberFilterStr(raw, { min, max, maxLen }) {
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

  if (s.length > maxLen) {
    s = s.slice(0, maxLen);
  }

  if (s === "" || s === "-" || s === "." || s === "-.") {
    return "";
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return "";

  const clamped = Math.max(min, Math.min(max, n));
  return String(clamped);
}

function enforceNumberOrder(value, changedField) {
  const { min, max } = value;

  if (min === "" || max === "") {
    return { ...value };
  }

  const minN = Number(min);
  const maxN = Number(max);

  if (!Number.isFinite(minN) || !Number.isFinite(maxN)) {
    return { ...value };
  }

  if (changedField === "min" && minN > maxN) {
    return { ...value, min: String(maxN) };
  }

  if (changedField === "max" && maxN < minN) {
    return { ...value, max: String(minN) };
  }

  return { ...value };
}

function getDataNumberRange(dataInput, schemaMin, schemaMax) {
  if (!dataInput || typeof dataInput !== "object") {
    return { lo: null, hi: null, ok: false };
  }

  const mode = dataInput.mode;
  const singleN = parseNum(dataInput.singleValue);
  const minN = parseNum(dataInput.min);
  const maxN = parseNum(dataInput.max);

  switch (mode) {
    case "Single Value":
      return singleN == null
        ? { lo: null, hi: null, ok: false }
        : { lo: singleN, hi: singleN, ok: true };

    case "Min-Max Range":
      if (minN == null && maxN == null) {
        return { lo: null, hi: null, ok: false };
      }
      return {
        lo: minN == null ? schemaMin : minN,
        hi: maxN == null ? schemaMax : maxN,
        ok: true,
      };

    case "Min Only":
      return minN == null
        ? { lo: null, hi: null, ok: false }
        : { lo: minN, hi: schemaMax, ok: true };

    case "Max Only":
      return maxN == null
        ? { lo: null, hi: null, ok: false }
        : { lo: schemaMin, hi: maxN, ok: true };

    default:
      return { lo: null, hi: null, ok: false };
  }
}

export function renderNumberFilter(schemaInput, filterValue, setFilterValue) {
  const schemaMin = Number.isFinite(schemaInput?.minValue)
    ? schemaInput.minValue
    : -5000000000;

  const schemaMax = Number.isFinite(schemaInput?.maxValue)
    ? schemaInput.maxValue
    : 5000000000;

  const maxLen = Number.isFinite(schemaInput?.maxLength)
    ? schemaInput.maxLength
    : 20;

  const value =
    filterValue && typeof filterValue === "object"
      ? filterValue
      : { mode: "Any", exactValue: "", min: "", max: "" };

  const modes = ["Any", "Exact Value", "Range"];

  const clamp = (raw) =>
    clampNumberFilterStr(raw, {
      min: schemaMin,
      max: schemaMax,
      maxLen,
    });

  const setMode = (nextMode) => {
    if (nextMode === "Any") {
      setFilterValue({
        mode: "Any",
        exactValue: "",
        min: "",
        max: "",
      });
      return;
    }

    if (nextMode === "Exact Value") {
      setFilterValue({
        mode: "Exact Value",
        exactValue: value.exactValue ?? "",
        min: "",
        max: "",
      });
      return;
    }

    if (nextMode === "Range") {
      setFilterValue({
        mode: "Range",
        exactValue: "",
        min: value.min ?? "",
        max: value.max ?? "",
      });
    }
  };

  const showExact = value.mode === "Exact Value";
  const showRange = value.mode === "Range";

  return (
    <div key={schemaInput.id} className="form-group">
      <label className="label-container">{schemaInput.label}:</label>

      <select
        className="value-container"
        value={value.mode}
        onChange={(e) => setMode(e.target.value)}
      >
        {modes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {showExact && (
        <>
          <label
            className="label-container"
            htmlFor={`filter-${schemaInput.id}-exact`}
          >
            Exact value:
          </label>
          <input
            id={`filter-${schemaInput.id}-exact`}
            className="value-container"
            type="text"
            inputMode="decimal"
            value={value.exactValue}
            onChange={(e) =>
              setFilterValue({
                ...value,
                exactValue: clamp(e.target.value),
              })
            }
            placeholder={String(schemaMin)}
          />
        </>
      )}

      {showRange && (
        <>
          <label
            className="label-container"
            htmlFor={`filter-${schemaInput.id}-min`}
          >
            Min value:
          </label>
          <input
            id={`filter-${schemaInput.id}-min`}
            className="value-container"
            type="text"
            inputMode="decimal"
            value={value.min}
            onChange={(e) =>
              setFilterValue({
                ...value,
                min: clamp(e.target.value),
              })
            }
            onBlur={() => {
              const fixed = enforceNumberOrder(value, "min");
              setFilterValue(fixed);
            }}
            placeholder={String(schemaMin)}
          />

          <label
            className="label-container"
            htmlFor={`filter-${schemaInput.id}-max`}
          >
            Max value:
          </label>
          <input
            id={`filter-${schemaInput.id}-max`}
            className="value-container"
            type="text"
            inputMode="decimal"
            value={value.max}
            onChange={(e) =>
              setFilterValue({
                ...value,
                max: clamp(e.target.value),
              })
            }
            onBlur={() => {
              const fixed = enforceNumberOrder(value, "max");
              setFilterValue(fixed);
            }}
            placeholder={String(schemaMax)}
          />
        </>
      )}
    </div>
  );
}

export function matchesNumberFilter(schemaInput, filterValue, dataInput) {
  const schemaMin = Number.isFinite(schemaInput?.minValue)
    ? schemaInput.minValue
    : -5000000000;

  const schemaMax = Number.isFinite(schemaInput?.maxValue)
    ? schemaInput.maxValue
    : 5000000000;

  if (!filterValue) return true;

  const mode = filterValue.mode;
  if (!mode || mode === "Any") return true;

  const dataRange = getDataNumberRange(dataInput, schemaMin, schemaMax);
  if (!dataRange.ok) return false;

  if (mode === "Exact Value") {
    const exactN = parseNum(filterValue.exactValue);
    if (exactN == null) return true;
    return exactN >= dataRange.lo && exactN <= dataRange.hi;
  }

  if (mode === "Range") {
    const minN = parseNum(filterValue.min);
    const maxN = parseNum(filterValue.max);

    if (minN == null && maxN == null) return true;

    const lo = minN == null ? schemaMin : minN;
    const hi = maxN == null ? schemaMax : maxN;

    const filterLo = Math.min(lo, hi);
    const filterHi = Math.max(lo, hi);

    return dataRange.lo <= filterHi && dataRange.hi >= filterLo;
  }

  return true;
}

export function createNumberFilterState() {
  return {
    mode: "Any",
    exactValue: "",
    min: "",
    max: "",
  };
}

export function isNumberFilterActive(value) {
  if (!value?.mode || value.mode === "Any") return false;

  if (value.mode === "Exact Value") {
    return value.exactValue != null && value.exactValue !== "";
  }

  if (value.mode === "Range") {
    return (
      (value.min != null && value.min !== "") ||
      (value.max != null && value.max !== "")
    );
  }

  return false;
}