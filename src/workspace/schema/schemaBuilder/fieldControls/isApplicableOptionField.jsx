function IsApplicableOptionField({
  currentInput,
  toggleOption,
  isLockedField,
  disabled = false,
}) {
  const isDisabled = disabled || isLockedField("isApplicableOption");

  return (
    <label className="input-configurator-option">
      <input
        type="checkbox"
        checked={currentInput.isApplicableOption === true}
        onChange={() => !isDisabled && toggleOption("isApplicableOption")}
        disabled={isDisabled}
      />
      Enable "Not Applicable" option for when false display mode is not "No display"
    </label>
  );
}

export default IsApplicableOptionField;