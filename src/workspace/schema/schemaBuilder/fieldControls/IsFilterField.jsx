function IsFilterField({ currentInput, toggleOption, isLockedField }) {
  return (
    <label className="input-configurator-option">
      <input
        type="checkbox"
        checked={!!currentInput.isFilter}
        onChange={() => toggleOption("isFilter")}
        disabled={isLockedField("isFilter")}
      />
      Show as Filter Option
    </label>
  );
}

export default IsFilterField;
