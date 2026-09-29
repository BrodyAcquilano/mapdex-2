import IsFilterField from "../fieldControls/IsFilterField.jsx";
import DisplayWhenTrueField from "../fieldControls/DisplayWhenTrueField.jsx";
import DisplayWhenFalseField from "../fieldControls/DisplayWhenFalseField.jsx";
import TrueDisplayTextField from "../fieldControls/TrueDisplayTextField.jsx";
import FalseDisplayTextField from "../fieldControls/FalseDisplayTextField.jsx";
import NotesField from "../fieldControls/NotesField.jsx";
import IsApplicableOptionField from "../fieldControls/isApplicableOptionField.jsx";

function CheckboxConfigurator({
  currentInput,
  toggleOption,
  isLockedField,
  handleDisplayModeChange,
  handleTrueDisplayTextChange,
  handleFalseDisplayTextChange,
  handleNotesChange,
  renderPreviewTextSelect,
}) {
  const canUseApplicableOption =
    (currentInput.displayWhenFalse || "none") !== "none";

  return (
    <div className="input-configurator-group">
      <IsFilterField
        currentInput={currentInput}
        toggleOption={toggleOption}
        isLockedField={isLockedField}
      />

      <DisplayWhenTrueField
        currentInput={currentInput}
        handleDisplayModeChange={handleDisplayModeChange}
        isLockedField={isLockedField}
      />

      <DisplayWhenFalseField
        currentInput={currentInput}
        handleDisplayModeChange={handleDisplayModeChange}
        isLockedField={isLockedField}
      />

      <FalseDisplayTextField
        currentInput={currentInput}
        handleFalseDisplayTextChange={handleFalseDisplayTextChange}
        isLockedField={isLockedField}
      />

      <TrueDisplayTextField
        currentInput={currentInput}
        handleTrueDisplayTextChange={handleTrueDisplayTextChange}
        isLockedField={isLockedField}
      />

      <IsApplicableOptionField
        currentInput={currentInput}
        toggleOption={toggleOption}
        isLockedField={isLockedField}
        disabled={!canUseApplicableOption}
      />

      <NotesField
        currentInput={currentInput}
        handleNotesChange={handleNotesChange}
        isLockedField={isLockedField}
      />

      {renderPreviewTextSelect(currentInput.type)}
    </div>
  );
}

export default CheckboxConfigurator;