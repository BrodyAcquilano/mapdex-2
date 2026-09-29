function parseNum(raw) {
  if (raw === "" || raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function clampAgeFilterStr(raw, { min, max, maxLen }) {
  if (raw == null || raw === "") return "";

  let s = String(raw).replace(/\D+/g, "");

  if (s.length > 1) {
    s = s.replace(/^0+/, "");
  }

  if (maxLen && s.length > maxLen) {
    s = s.slice(0, maxLen);
  }

  if (s === "") return "";

  let n = Number(s);
  if (!Number.isFinite(n)) return "";

  n = Math.max(min, Math.min(max, n));
  return String(n);
}

function enforceAgeOrder(value, changedField) {
  const { youngest, oldest } = value;

  if (youngest === "" || oldest === "") {
    return { youngest, oldest };
  }

  const y = Number(youngest);
  const o = Number(oldest);

  if (!Number.isFinite(y) || !Number.isFinite(o)) {
    return { youngest, oldest };
  }

  if (changedField === "youngest" && y > o) {
    return { youngest: String(o), oldest };
  }

  if (changedField === "oldest" && o < y) {
    return { youngest, oldest: String(y) };
  }

  return { youngest, oldest };
}

function getDataAgeRange(dataInput, schemaMin, schemaMax) {
  if (!dataInput || typeof dataInput !== "object") {
    return { min: schemaMin, max: schemaMax };
  }

  const minN = parseNum(dataInput.min);
  const maxN = parseNum(dataInput.max);

  return {
    min: minN == null ? schemaMin : minN,
    max: maxN == null ? schemaMax : maxN,
  };
}

export function renderAgeRangeFilter(schemaInput, filterValue, setFilterValue) {
  const schemaMin = Number.isFinite(schemaInput?.minValue)
    ? schemaInput.minValue
    : 0;
  const schemaMax = Number.isFinite(schemaInput?.maxValue)
    ? schemaInput.maxValue
    : 120;
  const maxLen = Number.isFinite(schemaInput?.maxLength)
    ? schemaInput.maxLength
    : 3;

  const value =
    filterValue && typeof filterValue === "object"
      ? filterValue
      : { mode: "Any Ages", age: "", youngest: "", oldest: "" };

  const modes = ["Any Ages", "Single Person Age", "Group/Family Age Range"];

  const clamp = (raw) =>
    clampAgeFilterStr(raw, {
      min: schemaMin,
      max: schemaMax,
      maxLen,
    });

  const setMode = (nextMode) => {
    if (nextMode === "Any Ages") {
      setFilterValue({ mode: "Any Ages", age: "", youngest: "", oldest: "" });
      return;
    }

    if (nextMode === "Single Person Age") {
      setFilterValue({
        mode: "Single Person Age",
        age: value.age ?? "",
        youngest: "",
        oldest: "",
      });
      return;
    }

    if (nextMode === "Group/Family Age Range") {
      setFilterValue({
        mode: "Group/Family Age Range",
        age: "",
        youngest: value.youngest ?? "",
        oldest: value.oldest ?? "",
      });
    }
  };

  const showSingle = value.mode === "Single Person Age";
  const showGroup = value.mode === "Group/Family Age Range";

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

      {showSingle && (
        <>
          <label className="label-container">Age:</label>
          <input
            className="value-container"
            type="text"
            inputMode="numeric"
            value={value.age}
            onChange={(e) =>
              setFilterValue({ ...value, age: clamp(e.target.value) })
            }
            placeholder={String(schemaMin)}
          />
        </>
      )}

      {showGroup && (
        <>
          <label className="label-container">Youngest age:</label>
          <input
            type="text"
            inputMode="numeric"
            className="value-container"
            value={value.youngest}
            onChange={(e) =>
              setFilterValue({
                ...value,
                youngest: clamp(e.target.value),
              })
            }
            onBlur={() => {
              const fixed = enforceAgeOrder(value, "youngest");
              setFilterValue({ ...value, ...fixed });
            }}
            placeholder={String(schemaMin)}
          />

          <label className="label-container">Oldest age:</label>
          <input
            type="text"
            inputMode="numeric"
            className="value-container"
            value={value.oldest}
            onChange={(e) =>
              setFilterValue({
                ...value,
                oldest: clamp(e.target.value),
              })
            }
            onBlur={() => {
              const fixed = enforceAgeOrder(value, "oldest");
              setFilterValue({ ...value, ...fixed });
            }}
            placeholder={String(schemaMax)}
          />
        </>
      )}
    </div>
  );
}

export function matchesAgeRangeFilter(schemaInput, filterValue, dataInput) {
  const schemaMin = Number.isFinite(schemaInput?.minValue)
    ? schemaInput.minValue
    : 0;
  const schemaMax = Number.isFinite(schemaInput?.maxValue)
    ? schemaInput.maxValue
    : 120;

  if (!filterValue) return true;

  const mode = filterValue.mode;
  if (mode === "Any Ages") return true;

  const dataAgeRange = getDataAgeRange(dataInput, schemaMin, schemaMax);

  if (mode === "Single Person Age") {
    const ageN = parseNum(filterValue.age);
    if (ageN == null) return true;
    return ageN >= dataAgeRange.min && ageN <= dataAgeRange.max;
  }

  if (mode === "Group/Family Age Range") {
    const yN = parseNum(filterValue.youngest);
    const oN = parseNum(filterValue.oldest);

    if (yN == null && oN == null) return true;

    const a = yN == null ? oN : yN;
    const b = oN == null ? yN : oN;

    if (a == null || b == null) return true;

    const gLo = Math.min(a, b);
    const gHi = Math.max(a, b);
    return gLo >= dataAgeRange.min && gHi <= dataAgeRange.max;
  }

  return true;
}

export function createAgeRangeFilterState() {
  return {
    mode: "Any Ages",
    age: "",
    youngest: "",
    oldest: "",
  };
}

export function isAgeRangeFilterActive(value) {
  if (!value?.mode || value.mode === "Any Ages") return false;

  if (value.mode === "Single Person Age") {
    return value.age != null && value.age !== "";
  }

  if (value.mode === "Group/Family Age Range") {
    return value.youngest != null || value.oldest != null;
  }

  return false;
}