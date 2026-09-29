import IsRequiredField from "../fieldControls/IsRequiredField.jsx";
import IsFilterField from "../fieldControls/IsFilterField.jsx";
import IsDisplayedField from "../fieldControls/IsDisplayedField.jsx";
import MaxLengthField from "../fieldControls/MaxLengthField.jsx";
import DisplayIfEmptyField from "../fieldControls/DisplayIfEmptyField.jsx";
import EmptyDisplayTextField from "../fieldControls/EmptyDisplayTextField.jsx";
import { AGE_RANGE_LIMITS } from "../../../../../shared/validation/validationConstants.js";

function sortAgeModes(modes) {
  return AGE_RANGE_LIMITS.modeOptions.filter((mode) => modes.includes(mode));
}

function AgeRangeConfigurator({
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
  handleAddAgeModeOption,
  handleDeleteAgeModeOption,
  renderPreviewTextSelect,
}) {
  const rawModes = Array.isArray(currentInput.ageModeOptions)
    ? currentInput.ageModeOptions
    : [];

  const ageModes = (() => {
    const sorted = sortAgeModes(rawModes);
    return sorted.length > 0 ? sorted : [AGE_RANGE_LIMITS.modeOptions[0]];
  })();

  const addableAgeModes = AGE_RANGE_LIMITS.modeOptions.filter(
    (mode) => !ageModes.includes(mode),
  );

  const isModesLocked = isLockedField("ageModeOptions");

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
        min={AGE_RANGE_LIMITS.maxLength.min}
        max={AGE_RANGE_LIMITS.maxLength.max}
      />

      <label className="input-configurator-option">
        Min Age:
        <input
          type="number"
          min={AGE_RANGE_LIMITS.minValue}
          max={AGE_RANGE_LIMITS.maxValue}
          value={currentInput.minValue ?? ""}
          onChange={handleMinValueChange}
          onBlur={handleMinValueBlur}
          disabled={isLockedField("minValue")}
        />
      </label>

      <label className="input-configurator-option">
        Max Age:
        <input
          type="number"
          min={AGE_RANGE_LIMITS.minValue}
          max={AGE_RANGE_LIMITS.maxValue}
          value={currentInput.maxValue ?? ""}
          onChange={handleMaxValueChange}
          onBlur={handleMaxValueBlur}
          disabled={isLockedField("maxValue")}
        />
      </label>

      {renderPreviewTextSelect(currentInput.type)}

      <h3 className="input-configurator-subtitle">Allowed Age Modes</h3>

      <ul className="input-configurator-static-list">
        {ageModes.map((mode) => (
          <li key={mode} className="input-configurator-static-item">
            <span className="input-configurator-static-list-label">
              - {mode}
            </span>

            <span
              className="input-configurator-delete-option"
              onClick={() => {
                if (isModesLocked) return;
                if (ageModes.length <= 1) return;
                handleDeleteAgeModeOption(mode);
              }}
              title={
                ageModes.length <= 1
                  ? "At least one mode is required."
                  : "Delete Mode"
              }
              style={{
                pointerEvents:
                  isModesLocked || ageModes.length <= 1 ? "none" : "auto",
                opacity:
                  isModesLocked || ageModes.length <= 1 ? 0.5 : 1,
              }}
            >
              &minus;
            </span>
          </li>
        ))}
      </ul>

      {addableAgeModes.length > 0 && (
        <label className="input-configurator-option">
          Add Mode:
          <select
            value=""
            onChange={(e) => {
              const nextMode = e.target.value;
              if (!nextMode || isModesLocked) return;
              handleAddAgeModeOption(nextMode);
            }}
            disabled={isModesLocked}
          >
            <option value="">Select mode...</option>
            {addableAgeModes.map((mode) => (
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

export default AgeRangeConfigurator;