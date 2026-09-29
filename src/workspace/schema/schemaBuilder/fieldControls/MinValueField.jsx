function MinValueField({ currentInput, onChange, isLockedField }) {
  return (
    <label className="input-configurator-option">
      Min Value:
      <input
        type="number"
        value={currentInput.minValue ?? ""}
        onChange={onChange}
        disabled={isLockedField("minValue")}
      />
    </label>
  );
}

export default MinValueField;
