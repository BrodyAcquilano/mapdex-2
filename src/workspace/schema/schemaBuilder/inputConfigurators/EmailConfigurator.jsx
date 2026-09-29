import IsRequiredField from "../fieldControls/IsRequiredField.jsx";
import IsDisplayedField from "../fieldControls/IsDisplayedField.jsx";
import DisplayIfEmptyField from "../fieldControls/DisplayIfEmptyField.jsx";
import MaxLengthField from "../fieldControls/MaxLengthField.jsx";
import EmptyDisplayTextField from "../fieldControls/EmptyDisplayTextField.jsx";
import { EMAIL_LIMITS } from "../../../../../shared/validation/validationConstants.js";

function EmailConfigurator({
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
        min={EMAIL_LIMITS.maxLength.min}
        max={EMAIL_LIMITS.maxLength.max}
      />

      {renderPreviewTextSelect(currentInput.type)}
    </div>
  );
}

export default EmailConfigurator;