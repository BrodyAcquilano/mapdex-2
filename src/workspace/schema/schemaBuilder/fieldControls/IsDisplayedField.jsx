function IsDisplayedField({ currentInput, toggleOption, isLockedField }) {
  return (
    <label className="input-configurator-option">
      <input
        type="checkbox"
        checked={!!currentInput.isDisplayed}
        onChange={() => toggleOption("isDisplayed")}
        disabled={isLockedField("isDisplayed")}
      />
      Display in Info Panel
    </label>
  );
}

export default IsDisplayedField;
