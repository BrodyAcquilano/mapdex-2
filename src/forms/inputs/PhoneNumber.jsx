export function renderPhoneNumberInput({
  input,
  inputValue,
  sectionIndex,
  inputIndex,
  setFormData,
}) {
  return (
    <div key={input.id} className="form-group">
      <label className="label-container" htmlFor={`input-${input.id}`}>
        {input.label}:
      </label>
      <input
        className="value-container"
        id={`input-${input.id}`}
        type="text"
        value={inputValue || ""}
        maxLength={input.maxLength || 25}
        onChange={(e) =>
          setFormData((prev) => {
            const next = { ...prev };
            next.sections[sectionIndex].inputs[inputIndex].value =
              e.target.value;
            return next;
          })
        }
      />
    </div>
  );
}

export default renderPhoneNumberInput;