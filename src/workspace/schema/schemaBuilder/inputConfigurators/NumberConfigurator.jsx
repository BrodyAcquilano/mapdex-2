import IsRequiredField from "../fieldControls/IsRequiredField.jsx";
import IsFilterField from "../fieldControls/IsFilterField.jsx";
import IsDisplayedField from "../fieldControls/IsDisplayedField.jsx";
import MaxLengthField from "../fieldControls/MaxLengthField.jsx";
import DisplayIfEmptyField from "../fieldControls/DisplayIfEmptyField.jsx";
import EmptyDisplayTextField from "../fieldControls/EmptyDisplayTextField.jsx";
import { NUMBER_LIMITS } from "../../../../../shared/validation/validationConstants.js";

function sortQuantitativeModes(modes) {
  return NUMBER_LIMITS.modeOptions.filter((mode) => modes.includes(mode));
}

function NumberConfigurator({
  currentInput,
  toggleOption,
  isLockedField,
  handleMinValueChange,
  handleMinValueBlur,
  handleMaxValueChange,
  handleMaxValueBlur,
  handleMaxLengthChange,
  handleMaxLengthBlur,
  handleEmptyDisplayTextChange,
  handleAddModeOption,
  handleDeleteModeOption,
  renderPreviewTextSelect,
}) {
  const rawModes = Array.isArray(currentInput.modeOptions)
    ? currentInput.modeOptions
    : [];

  const modes = (() => {
    const sorted = sortQuantitativeModes(rawModes);
    return sorted.length > 0 ? sorted : [NUMBER_LIMITS.modeOptions[0]];
  })();

  const addableModes = NUMBER_LIMITS.modeOptions.filter(
    (mode) => !modes.includes(mode),
  );

  const isModesLocked = isLockedField("modeOptions");

  return (
    <div className="input-configurator-group">
      <IsRequiredField
        currentInput={currentInput}
        toggleOption={toggleOption}
        isLockedField={isLockedField}
      />

      <IsFilterField
        currentInput={currentInput}
        toggleOption={toggleOption}
        isLockedField={isLockedField}
      />

      <IsDisplayedField
        currentInput={currentInput}
        toggleOption={toggleOption}
        isLockedField={isLockedField}
      />

      <DisplayIfEmptyField
        currentInput={currentInput}
        toggleOption={toggleOption}
        isLockedField={isLockedField}
      />

      <EmptyDisplayTextField
        currentInput={currentInput}
        onChange={handleEmptyDisplayTextChange}
        isLockedField={isLockedField}
      />

      <MaxLengthField
        currentInput={currentInput}
        onChange={handleMaxLengthChange}
        onBlur={handleMaxLengthBlur}
        isLockedField={isLockedField}
        min={NUMBER_LIMITS.maxLength.min}
        max={NUMBER_LIMITS.maxLength.max}
      />

      <label className="input-configurator-option">
        Min Value:
        <input
          type="number"
          min={NUMBER_LIMITS.minValue}
          max={NUMBER_LIMITS.maxValue}
          value={currentInput.minValue ?? ""}
          onChange={handleMinValueChange}
          onBlur={handleMinValueBlur}
          disabled={isLockedField("minValue")}
        />
      </label>

      <label className="input-configurator-option">
        Max Value:
        <input
          type="number"
          min={NUMBER_LIMITS.minValue}
          max={NUMBER_LIMITS.maxValue}
          value={currentInput.maxValue ?? ""}
          onChange={handleMaxValueChange}
          onBlur={handleMaxValueBlur}
          disabled={isLockedField("maxValue")}
        />
      </label>

      {renderPreviewTextSelect(currentInput.type)}

      <h3 className="input-configurator-subtitle">Allowed Number Modes</h3>

      <ul className="input-configurator-static-list">
        {modes.map((mode) => (
          <li key={mode} className="input-configurator-static-item">
            <span className="input-configurator-static-list-label">
              - {mode}
            </span>

            <span
              className="input-configurator-delete-option"
              onClick={() => {
                if (isModesLocked) return;
                if (modes.length <= 1) return;
                handleDeleteModeOption(mode);
              }}
              title={
                modes.length <= 1
                  ? "At least one mode is required."
                  : "Delete Mode"
              }
              style={{
                pointerEvents:
                  isModesLocked || modes.length <= 1 ? "none" : "auto",
                opacity: isModesLocked || modes.length <= 1 ? 0.5 : 1,
              }}
            >
              &minus;
            </span>
          </li>
        ))}
      </ul>

      {addableModes.length > 0 && (
        <label className="input-configurator-option">
          Add Mode:
          <select
            value=""
            onChange={(e) => {
              const nextMode = e.target.value;
              if (!nextMode || isModesLocked) return;
              handleAddModeOption(nextMode);
            }}
            disabled={isModesLocked}
          >
            <option value="">Select mode...</option>
            {addableModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export default NumberConfigurator;