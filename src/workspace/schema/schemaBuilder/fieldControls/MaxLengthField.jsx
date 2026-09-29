function MaxLengthField({
  currentInput,
  onChange,
  onBlur,
  isLockedField,
  min = 1,
  max = 500,
}) {
  return (
    <label className="input-configurator-option">
      Max Length:
      <input
        type="number"
        min={min}
        max={max}
        value={currentInput.maxLength ?? ""}
        onChange={onChange}
        onBlur={onBlur}
        disabled={isLockedField("maxLength")}
      />
    </label>
  );
}

export default MaxLengthField;