function MaxItemsField({
  currentInput,
  onChange,
  onBlur,
  isLockedField,
  min = 1,
  max = 1000,
}) {
  return (
    <label className="input-configurator-option">
      Max Items:
      <input
        type="number"
        min={min}
        max={max}
        value={currentInput.maxItems ?? ""}
        onChange={onChange}
        onBlur={onBlur}
        disabled={isLockedField("maxItems")}
      />
    </label>
  );
}

export default MaxItemsField;