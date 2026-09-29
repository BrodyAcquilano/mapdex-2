import IsRequiredField from "../fieldControls/IsRequiredField.jsx";
import IsDisplayedField from "../fieldControls/IsDisplayedField.jsx";
import DisplayIfEmptyField from "../fieldControls/DisplayIfEmptyField.jsx";
import MaxLengthField from "../fieldControls/MaxLengthField.jsx";
import EmptyDisplayTextField from "../fieldControls/EmptyDisplayTextField.jsx";
import { PHONE_NUMBER_LIMITS } from "../../../../../shared/validation/validationConstants.js";

function PhoneConfigurator({
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
        min={PHONE_NUMBER_LIMITS.maxLength.min}
        max={PHONE_NUMBER_LIMITS.maxLength.max}
      />

      {renderPreviewTextSelect(currentInput.type)}
    </div>
  );
}

export default PhoneConfigurator;