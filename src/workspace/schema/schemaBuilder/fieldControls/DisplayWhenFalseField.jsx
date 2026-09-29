function DisplayWhenFalseField({
  currentInput,
  handleDisplayModeChange,
  isLockedField,
}) {
  return (
    <label className="input-configurator-option">
      Display When False:
      <select
        value={currentInput.displayWhenFalse || "none"}
        onChange={(e) =>
          handleDisplayModeChange("displayWhenFalse", e.target.value)
        }
        disabled={isLockedField("displayWhenFalse")}
      >
        <option value="none">No display</option>
        <option value="labelMessage">Label: message</option>
        <option value="messageOnly">Message only</option>
      </select>
    </label>
  );
}

export default DisplayWhenFalseField;
