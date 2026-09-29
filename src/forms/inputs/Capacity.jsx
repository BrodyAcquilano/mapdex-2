// src/forms/inputs/Capacity.jsx

import "../../styles/modals.css";
import "../../styles/panels.css";
import "./Quantitative.css";

function clampCapacityStr(raw, { min, max, maxLen, finalize, finalValue }) {
  if (raw == null || raw === "") {
    return finalize ? String(finalValue) : "";
  }

  let s = String(raw).replace(/\D/g, "");

  if (maxLen && s.length > maxLen) {
    s = s.slice(0, maxLen);
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

function enforceCapacityMinMaxOrder({ min, max }, changedField) {
  if (min == null || max == null || min === "" || max === "") {
    return { min, max };
  }

  const nMin = Number(min);
  const nMax = Number(max);

  if (!Number.isFinite(nMin) || !Number.isFinite(nMax)) {
    return { min, max };
  }

  if (changedField === "min" && nMin > nMax) {
    return { min: max, max };
  }

  if (changedField === "max" && nMax < nMin) {
    return { min, max: min };
  }

  return { min, max };
}

export function renderCapacityInput({
  input,
  stored,
  sectionIndex,
  inputIndex,
  setFormData,
}) {
  const modes = Array.isArray(input.modeOptions)
    ? input.modeOptions
    : ["Single Value", "Min-Max Range"];

  const mode =
    stored?.mode === ""
      ? ""
      : modes.includes(stored?.mode)
        ? stored.mode
        : input.isRequired
          ? modes[0] || "Single Value"
          : "";

  const singleValue = stored?.singleValue ?? "";
  const min = stored?.min ?? "";
  const max = stored?.max ?? "";

  const minValue = 0;
  const maxValue =
    typeof input.maxValue === "number" ? input.maxValue : 999999999;
  const maxLen =
    typeof input.maxLength === "number" ? input.maxLength : 9;

  const showSingle = mode === "Single Value";
  const showMin = mode === "Min-Max Range";
  const showMax = mode === "Min-Max Range";

  return (
    <div key={input.id} className="quantitative-form-group">
      <label
        className="quantitative-label"
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
              slot.singleValue = null;
              slot.min = null;
              slot.max = null;
            } else if (newMode === "Single Value") {
              slot.mode = "Single Value";
              slot.singleValue = minValue;
              slot.min = null;
              slot.max = null;
            } else if (newMode === "Min-Max Range") {
              slot.mode = "Min-Max Range";
              slot.singleValue = null;
              slot.min = minValue;
              slot.max = maxValue;
            } else {
              slot.mode = "";
              slot.singleValue = null;
              slot.min = null;
              slot.max = null;
            }

            return next;
          });
        }}
      >
        {!input.isRequired && <option value="">No Option Selected</option>}

        {modes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {showSingle && (
        <div className="quantitative-field">
          <label
            className="quantitative-label"
            htmlFor={`input-${input.id}-singleValue`}
          >
            Value:
          </label>
          <input
            id={`input-${input.id}-singleValue`}
            type="text"
            inputMode="numeric"
            className="value-container"
            value={singleValue}
            onChange={(e) => {
              const nextValue = clampCapacityStr(e.target.value, {
                min: minValue,
                max: maxValue,
                maxLen,
                finalize: false,
                finalValue: minValue,
              });

              setFormData((prev) => {
                const next = { ...prev };
                next.sections[sectionIndex].inputs[inputIndex].singleValue =
                  nextValue;
                return next;
              });
            }}
            onBlur={() => {
              setFormData((prev) => {
                const next = structuredClone(prev);
                const slot = next.sections[sectionIndex].inputs[inputIndex];

                slot.singleValue = Number(
                  clampCapacityStr(slot.singleValue, {
                    min: minValue,
                    max: maxValue,
                    maxLen,
                    finalize: true,
                    finalValue: minValue,
                  }),
                );

                return next;
              });
            }}
          />
        </div>
      )}

      {(showMin || showMax) && (
        <div className="quantitative-row">
          {showMin && (
            <div className="quantitative-field">
              <label
                className="quantitative-label"
                htmlFor={`input-${input.id}-min`}
              >
                Min Value:
              </label>
              <input
                id={`input-${input.id}-min`}
                type="text"
                inputMode="numeric"
                className="value-container"
                value={min}
                onChange={(e) => {
                  const nextMin = clampCapacityStr(e.target.value, {
                    min: minValue,
                    max: maxValue,
                    maxLen,
                    finalize: false,
                    finalValue: minValue,
                  });

                  setFormData((prev) => {
                    const next = { ...prev };
                    next.sections[sectionIndex].inputs[inputIndex].min = nextMin;
                    return next;
                  });
                }}
                onBlur={() => {
                  setFormData((prev) => {
                    const next = structuredClone(prev);
                    const slot = next.sections[sectionIndex].inputs[inputIndex];

                    slot.min = Number(
                      clampCapacityStr(slot.min, {
                        min: minValue,
                        max: maxValue,
                        maxLen,
                        finalize: true,
                        finalValue: minValue,
                      }),
                    );

                    const fixed = enforceCapacityMinMaxOrder(slot, "min");
                    slot.min = fixed.min;
                    slot.max = fixed.max;

                    return next;
                  });
                }}
              />
            </div>
          )}

          {showMax && (
            <div className="quantitative-field">
              <label
                className="quantitative-label"
                htmlFor={`input-${input.id}-max`}
              >
                Max Value:
              </label>
              <input
                id={`input-${input.id}-max`}
                type="text"
                inputMode="numeric"
                className="value-container"
                value={max}
                onChange={(e) => {
                  const nextMax = clampCapacityStr(e.target.value, {
                    min: minValue,
                    max: maxValue,
                    maxLen,
                    finalize: false,
                    finalValue: maxValue,
                  });

                  setFormData((prev) => {
                    const next = { ...prev };
                    next.sections[sectionIndex].inputs[inputIndex].max = nextMax;
                    return next;
                  });
                }}
                onBlur={() => {
                  setFormData((prev) => {
                    const next = structuredClone(prev);
                    const slot = next.sections[sectionIndex].inputs[inputIndex];

                    slot.max = Number(
                      clampCapacityStr(slot.max, {
                        min: minValue,
                        max: maxValue,
                        maxLen,
                        finalize: true,
                        finalValue: maxValue,
                      }),
                    );

                    const fixed = enforceCapacityMinMaxOrder(slot, "max");
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

export default renderCapacityInput;