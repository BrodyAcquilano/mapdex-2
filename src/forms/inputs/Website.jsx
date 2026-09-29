export function renderWebsiteInput({
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
        type="url"
        value={inputValue || ""}
        maxLength={input.maxLength || 150}
        onChange={(e) =>
          setFormData((prev) => {
            const next = { ...prev };
            next.sections[sectionIndex].inputs[inputIndex].value =
              e.target.value;
            return next;
          })
        }
        placeholder="https://example.com"
      />
    </div>
  );
}

export default renderWebsiteInput;