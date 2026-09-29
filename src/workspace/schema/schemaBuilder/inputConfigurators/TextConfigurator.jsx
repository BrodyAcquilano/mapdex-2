import IsRequiredField from "../fieldControls/IsRequiredField.jsx";
import MaxLengthField from "../fieldControls/MaxLengthField.jsx";
import IsFilterField from "../fieldControls/IsFilterField.jsx";
import IsDisplayedField from "../fieldControls/IsDisplayedField.jsx";
import DisplayIfEmptyField from "../fieldControls/DisplayIfEmptyField.jsx";
import EmptyDisplayTextField from "../fieldControls/EmptyDisplayTextField.jsx";
import { TEXT_LIMITS } from "../../../../../shared/validation/validationConstants.js";

function TextConfigurator({
  currentInput,
  toggleOption,
  isLockedField,
  handleMaxLengthChange,
  handleMaxLengthBlur,
  handleEmptyDisplayTextChange,
  renderPreviewTextSelect,
}) {
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
        min={TEXT_LIMITS.maxLength.min}
        max={TEXT_LIMITS.maxLength.max}
      />

      {renderPreviewTextSelect(currentInput.type)}
    </div>
  );
}

export default TextConfigurator;