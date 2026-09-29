function FalseDisplayTextField({
  currentInput,
  handleFalseDisplayTextChange,
  isLockedField,
}) {
  const usesFalseMessage =
    currentInput.displayWhenFalse === "labelMessage" ||
    currentInput.displayWhenFalse === "messageOnly";

  const isDisabled =
    isLockedField("falseDisplayText") || !usesFalseMessage;

  return (
    <label className="input-configurator-notes">
      Text to Display if Unchecked:
      <input
        type="text"
        value={usesFalseMessage ? currentInput.falseDisplayText ?? "" : ""}
        onChange={handleFalseDisplayTextChange}
        maxLength={40}
        disabled={isDisabled}
      />
    </label>
  );
}

export default FalseDisplayTextField;