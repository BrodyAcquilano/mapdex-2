function MaxValueField({ currentInput, onChange, isLockedField }) {
  return (
    <label className="input-configurator-option">
      Max Value:
      <input
        type="number"
        value={currentInput.maxValue ?? ""}
        onChange={onChange}
        disabled={isLockedField("maxValue")}
      />
    </label>
  );
}

export default MaxValueField;
