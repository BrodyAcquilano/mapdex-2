export function renderCheckboxInput({
  input,
  stored,
  sectionIndex,
  inputIndex,
  setFormData,
}) {
  const supportsApplicability = input.isApplicableOption === true;

  const isApplicable = supportsApplicability
    ? stored?.isApplicable !== false
    : true;

  const inputValue = stored?.value ?? false;

  if (!supportsApplicability) {
    return (
      <div key={input.id} className="inline-checkbox-row">
        <div className="checkbox-container">
          <input
            id={`input-${input.id}`}
            type="checkbox"
            checked={!!inputValue}
            onChange={(e) => {
              const checked = e.target.checked;

              setFormData((prev) => {
                const next = {
                  ...prev,
                };

                next.sections[sectionIndex].inputs[inputIndex] = {
                  ...next.sections[sectionIndex].inputs[inputIndex],

                  value: checked,
                };

                return next;
              });
            }}
          />
        </div>

        <label htmlFor={`input-${input.id}`} className="label-container">
          {input.label}
        </label>
      </div>
    );
  }

  return (
    <div key={input.id} className="quantitative-form-group">
      <label
        className="quantitative-label"
        htmlFor={`input-${input.id}-applicable`}
      >
        {input.label}:
      </label>

      <select
        id={`input-${input.id}-applicable`}
        value={isApplicable ? "applicable" : "notApplicable"}
        onChange={(e) => {
          const nextIsApplicable = e.target.value === "applicable";

          setFormData((prev) => {
            const next = {
              ...prev,
            };

            next.sections[sectionIndex].inputs[inputIndex] = {
              ...next.sections[sectionIndex].inputs[inputIndex],

              isApplicable: nextIsApplicable,

              value: nextIsApplicable
                ? !!next.sections[sectionIndex].inputs[inputIndex].value
                : false,
            };

            return next;
          });
        }}
      >
        <option value="applicable">Is Applicable</option>

        <option value="notApplicable">Is Not Applicable</option>
      </select>

      {isApplicable && (
        <div className="inline-checkbox-row">
          <div className="checkbox-container">
            <input
              id={`input-${input.id}`}
              type="checkbox"
              checked={!!inputValue}
              onChange={(e) => {
                const checked = e.target.checked;

                setFormData((prev) => {
                  const next = {
                    ...prev,
                  };

                  next.sections[sectionIndex].inputs[inputIndex] = {
                    ...next.sections[sectionIndex].inputs[inputIndex],

                    value: checked,
                  };

                  return next;
                });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default renderCheckboxInput;
