function DisplayIfEmptyField({ currentInput, toggleOption, isLockedField }) {
  const isDisabled =
    isLockedField("displayIfEmpty") ||
    currentInput.isDisplayed !== true ||
    currentInput.isRequired === true;

  return (
    <label className="input-configurator-option">
      <input
        type="checkbox"
        checked={
          currentInput.isDisplayed === true &&
          currentInput.isRequired !== true &&
          !!currentInput.displayIfEmpty
        }
        onChange={() => toggleOption("displayIfEmpty")}
        disabled={isDisabled}
      />
      Display in Info Panel if Empty
    </label>
  );
}

export default DisplayIfEmptyField;