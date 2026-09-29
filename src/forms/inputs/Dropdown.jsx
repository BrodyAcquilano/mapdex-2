export function renderDropdownInput({
  input,
  inputValue,
  sectionIndex,
  inputIndex,
  setFormData,
}) {
  const isRequired = !!input.isRequired;

  const resolvedValue =
    inputValue ??
    (isRequired ? input.options?.[0] || "" : "");

  return (
    <div key={input.id} className="form-group">
      <label className="label-container" htmlFor={`input-${input.id}`}>
        {input.label}:
      </label>
      <select
        id={`input-${input.id}`}
        value={resolvedValue}
        onChange={(e) =>
          setFormData((prev) => {
            const next = { ...prev };
            next.sections[sectionIndex].inputs[inputIndex].value =
              e.target.value;
            return next;
          })
        }
      >
        {!isRequired && (
          <option value="">No Option Selected</option>
        )}

        {(input.options || []).map((opt, idx) => (
          <option key={idx} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export default renderDropdownInput;