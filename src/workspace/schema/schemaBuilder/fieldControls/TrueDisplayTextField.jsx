function TrueDisplayTextField({
  currentInput,
  handleTrueDisplayTextChange,
  isLockedField,
}) {
  const usesTrueMessage =
    currentInput.displayWhenTrue === "labelMessage" ||
    currentInput.displayWhenTrue === "messageOnly";

  const isDisabled =
    isLockedField("trueDisplayText") || !usesTrueMessage;

  return (
    <label className="input-configurator-notes">
      Text to Display if Checked:
      <input
        type="text"
        value={usesTrueMessage ? currentInput.trueDisplayText ?? "" : ""}
        onChange={handleTrueDisplayTextChange}
        maxLength={40}
        disabled={isDisabled}
      />
    </label>
  );
}

export default TrueDisplayTextField;