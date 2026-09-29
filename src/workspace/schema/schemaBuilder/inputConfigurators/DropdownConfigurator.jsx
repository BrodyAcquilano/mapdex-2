import IsRequiredField from "../fieldControls/IsRequiredField.jsx";
import IsFilterField from "../fieldControls/IsFilterField.jsx";
import IsDisplayedField from "../fieldControls/IsDisplayedField.jsx";
import DisplayIfEmptyField from "../fieldControls/DisplayIfEmptyField.jsx";
import EmptyDisplayTextField from "../fieldControls/EmptyDisplayTextField.jsx";
import { DROPDOWN_LIMITS } from "../../../../../shared/validation/validationConstants.js";

function DropdownConfigurator({
  currentInput,
  toggleOption,
  isLockedField,
  handleEmptyDisplayTextChange,
  handleDropdownOptionRename,
  handleDeleteDropdownOption,
  handleAddDropdownOption,
  renderPreviewTextSelect,
}) {
  const options = currentInput.options || [];
  const isOptionsLocked = isLockedField("options");
  const hasReachedMaxOptions =
    options.length >= DROPDOWN_LIMITS.maxOptions.max;
  const disableAdd = isOptionsLocked || hasReachedMaxOptions;

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

      {renderPreviewTextSelect(currentInput.type)}

      <h3 className="input-configurator-subtitle">Dropdown Options</h3>

      <ul className="input-configurator-dropdown-options">
        {options.map((option, idx) => {
          const disableDelete =
            isOptionsLocked ||
            options.length <= DROPDOWN_LIMITS.maxOptions.min;

          return (
            <li key={idx} className="input-configurator-dropdown-option-item">
              <input
                type="text"
                value={option}
                maxLength={DROPDOWN_LIMITS.optionMaxLength.default}
                onChange={(e) => handleDropdownOptionRename(e, idx)}
                disabled={isOptionsLocked}
              />

              <span
                className="input-configurator-delete-option"
                onClick={() =>
                  !disableDelete && handleDeleteDropdownOption(idx)
                }
                title={
                  disableDelete
                    ? "At least one option is required"
                    : "Delete Option"
                }
                style={{
                  pointerEvents: disableDelete ? "none" : "auto",
                  opacity: disableDelete ? 0.5 : 1,
                }}
              >
                &minus;
              </span>
            </li>
          );
        })}
      </ul>

      <button
        className="input-configurator-add-option-button"
        onClick={handleAddDropdownOption}
        disabled={disableAdd}
        title={
          isOptionsLocked
            ? "Options are locked"
            : hasReachedMaxOptions
              ? `Maximum of ${DROPDOWN_LIMITS.maxOptions.max} options reached`
              : "Add Option"
        }
        style={{
          opacity: disableAdd ? 0.6 : 1,
          cursor: disableAdd ? "not-allowed" : "pointer",
        }}
      >
        Add Option ➕
      </button>
    </div>
  );
}

export default DropdownConfigurator;