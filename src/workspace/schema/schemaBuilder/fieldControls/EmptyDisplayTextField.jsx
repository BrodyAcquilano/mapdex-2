function EmptyDisplayTextField({ currentInput, onChange, isLockedField }) {
  const isDisabled =
    isLockedField("emptyDisplayText") ||
    currentInput.isDisplayed !== true ||
    currentInput.isRequired === true ||
    currentInput.displayIfEmpty !== true;

  return (
    <label className="input-configurator-notes">
      Text to Display if Empty:
      <input
        type="text"
        value={
          currentInput.isDisplayed === true &&
          currentInput.isRequired !== true &&
          currentInput.displayIfEmpty === true
            ? currentInput.emptyDisplayText ?? ""
            : ""
        }
        onChange={onChange}
        maxLength={40}
        disabled={isDisabled}
      />
    </label>
  );
}

export default EmptyDisplayTextField;