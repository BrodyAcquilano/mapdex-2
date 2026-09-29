import IsRequiredField from "../fieldControls/IsRequiredField.jsx";
import IsFilterField from "../fieldControls/IsFilterField.jsx";
import IsDisplayedField from "../fieldControls/IsDisplayedField.jsx";
import DisplayIfEmptyField from "../fieldControls/DisplayIfEmptyField.jsx";

function HoursConfigurator({
  currentInput,
  toggleOption,
  isLockedField,
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


      {renderPreviewTextSelect(currentInput.type)}

    </div>
  );
}

export default HoursConfigurator;