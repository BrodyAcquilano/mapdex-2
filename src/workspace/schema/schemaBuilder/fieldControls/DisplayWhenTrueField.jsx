function DisplayWhenTrueField({
  currentInput,
  handleDisplayModeChange,
  isLockedField,
}) {
  return (
    <label className="input-configurator-option">
      Display When True:
      <select
        value={currentInput.displayWhenTrue || "labelOnly"}
        onChange={(e) =>
          handleDisplayModeChange("displayWhenTrue", e.target.value)
        }
        disabled={isLockedField("displayWhenTrue")}
      >
        <option value="labelOnly">Label only</option>
        <option value="labelMessage">Label: Message</option>
        <option value="messageOnly">Message only</option>
          <option value="none">No display</option>
      </select>
    </label>
  );
}

export default DisplayWhenTrueField;
