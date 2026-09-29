import "../../styles/modals.css";
import "../../styles/panels.css";
import "./AgeRange.css";

export function renderAgeRangeInput({
  input,
  stored,
  inputIndex,
  sectionIndex,
  setFormData,
}) {
  const modes = Array.isArray(input.ageModeOptions)
    ? input.ageModeOptions
    : ["All Ages", "Min-Max Range", "Min Only", "Max Only"];

  const mode =
    stored?.mode === ""
      ? ""
      : modes.includes(stored?.mode)
        ? stored.mode
        : input.isRequired
          ? modes[0] || "All Ages"
          : "";

  const min = stored?.min ?? null;
  const max = stored?.max ?? null;

  const showMin = mode === "Min Only" || mode === "Min-Max Range";
  const showMax = mode === "Max Only" || mode === "Min-Max Range";

  function enforceMinMaxOrder({ min, max }, changedField) {
    if (min == null || max == null) return { min, max };

    const nMin = Number(min);
    const nMax = Number(max);

    if (!Number.isFinite(nMin) || !Number.isFinite(nMax)) {
      return { min, max };
    }

    if (changedField === "min" && nMin > nMax) {
      return { min: nMax, max };
    }

    if (changedField === "max" && nMax < nMin) {
      return { min, max: nMin };
    }

    return { min, max };
  }

  function clampAgeStr(raw, { min, max, finalize, finalValue }) {
    if (raw == null || raw === "") {
      return finalize ? String(finalValue) : "";
    }

    let s = String(raw).replace(/\D+/g, "");

    if (s.length > 1) {
      s = s.replace(/^0+/, "");
    }

    if (s === "") {
      return finalize ? String(finalValue) : "";
    }

    let n = Number(s);
    if (!Number.isFinite(n)) {
      return finalize ? String(finalValue) : "";
    }

    n = Math.max(min, Math.min(max, n));
    return String(n);
  }

  return (
    <div key={input.id} className="age-range-form-group">
      <label
        className="age-range-label"
        htmlFor={`input-${input.id}-mode`}
      >
        {input.label}:
      </label>

      <select
        id={`input-${input.id}-mode`}
        value={mode}
        onChange={(e) => {
          const newMode = e.target.value;

          setFormData((prev) => {
            const next = { ...prev };
            const slot = next.sections[sectionIndex].inputs[inputIndex];

            if (newMode === "") {
              slot.mode = "";
              slot.min = null;
              slot.max = null;
            } else if (newMode === "All Ages") {
              slot.mode = "All Ages";
              slot.min = null;
              slot.max = null;
            } else if (newMode === "Min Only") {
              slot.mode = "Min Only";
              slot.min = input.minValue;
              slot.max = null;
            } else if (newMode === "Max Only") {
              slot.mode = "Max Only";
              slot.min = null;
              slot.max = input.maxValue;
            } else if (newMode === "Min-Max Range") {
              slot.mode = "Min-Max Range";
              slot.min = input.minValue;
              slot.max = input.maxValue;
            } else {
              slot.mode = "";
              slot.min = null;
              slot.max = null;
            }

            return next;
          });
        }}
      >
        {!input.isRequired && (
          <option value="">No Mode Selected</option>
        )}

        {modes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {(showMin || showMax) && (
        <div className="age-range-row">
          {showMin && (
            <div className="age-range-field">
              <label
                className="age-range-label"
                htmlFor={`input-${input.id}-min`}
              >
                Min:
              </label>
              <input
                id={`input-${input.id}-min`}
                type="text"
                inputMode="numeric"
                value={min ?? ""}
                onChange={(e) => {
                  const nextMin = clampAgeStr(e.target.value, {
                    min: input.minValue,
                    max: input.maxValue,
                    finalize: false,
                    finalValue: input.minValue,
                  });

                  setFormData((prev) => {
                    const next = { ...prev };
                    const slot =
                      next.sections[sectionIndex].inputs[inputIndex];
                    slot.min = nextMin === "" ? "" : Number(nextMin);
                    return next;
                  });
                }}
                onBlur={() => {
                  setFormData((prev) => {
                    const next = { ...prev };
                    const slot =
                      next.sections[sectionIndex].inputs[inputIndex];

                    const finalMin = Number(
                      clampAgeStr(slot.min, {
                        min: input.minValue,
                        max: input.maxValue,
                        finalize: true,
                        finalValue: input.minValue,
                      }),
                    );

                    slot.min = finalMin;

                    const fixed = enforceMinMaxOrder(slot, "min");
                    slot.min = fixed.min;
                    slot.max = fixed.max;

                    return next;
                  });
                }}
              />
            </div>
          )}

          {showMax && (
            <div className="age-range-field">
              <label
                className="age-range-label"
                htmlFor={`input-${input.id}-max`}
              >
                Max:
              </label>
              <input
                id={`input-${input.id}-max`}
                type="text"
                inputMode="numeric"
                value={max ?? ""}
                onChange={(e) => {
                  const nextMax = clampAgeStr(e.target.value, {
                    min: input.minValue,
                    max: input.maxValue,
                    finalize: false,
                    finalValue: input.maxValue,
                  });

                  setFormData((prev) => {
                    const next = { ...prev };
                    const slot =
                      next.sections[sectionIndex].inputs[inputIndex];
                    slot.max = nextMax === "" ? "" : Number(nextMax);
                    return next;
                  });
                }}
                onBlur={() => {
                  setFormData((prev) => {
                    const next = { ...prev };
                    const slot =
                      next.sections[sectionIndex].inputs[inputIndex];

                    const finalMax = Number(
                      clampAgeStr(slot.max, {
                        min: input.minValue,
                        max: input.maxValue,
                        finalize: true,
                        finalValue: input.maxValue,
                      }),
                    );

                    slot.max = finalMax;

                    const fixed = enforceMinMaxOrder(slot, "max");
                    slot.min = fixed.min;
                    slot.max = fixed.max;
                    return next;
                  });
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}