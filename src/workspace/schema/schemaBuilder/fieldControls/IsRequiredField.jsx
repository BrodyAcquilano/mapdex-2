// schemaBuilder/fieldControls/IsRequiredField.jsx

function IsRequiredField({ currentInput, toggleOption, isLockedField }) {
  return (
    <label className="input-configurator-option">
      <input
        type="checkbox"
        checked={!!currentInput.isRequired}
        onChange={() => toggleOption("isRequired")}
        disabled={isLockedField("isRequired")}
      />
      Required Input (Validate in Add/Edit)
    </label>
  );
}

export default IsRequiredField;
