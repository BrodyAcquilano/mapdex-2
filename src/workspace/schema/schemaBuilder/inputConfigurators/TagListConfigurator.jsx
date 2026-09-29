import MaxLengthField from "../fieldControls/MaxLengthField.jsx";
import MaxItemsField from "../fieldControls/MaxItemsField.jsx";
import IsFilterField from "../fieldControls/IsFilterField.jsx";
import IsDisplayedField from "../fieldControls/IsDisplayedField.jsx";
import DisplayIfEmptyField from "../fieldControls/DisplayIfEmptyField.jsx";
import EmptyDisplayTextField from "../fieldControls/EmptyDisplayTextField.jsx";
import { TAG_LIST_LIMITS } from "../../../../../shared/validation/validationConstants.js";

function TagListConfigurator({
  currentInput,
  toggleOption,
  isLockedField,
  handleMaxLengthChange,
  handleMaxLengthBlur,
  handleMaxItemsChange,
  handleMaxItemsBlur,
  handleEmptyDisplayTextChange,
  handleAddDefaultTag,
  handleRenameDefaultTag,
  handleDefaultTagBlur,
  handleDeleteDefaultTag,
  renderPreviewTextSelect,
  engineKey,
}) {
  const defaultTags = Array.isArray(currentInput.defaultTags)
    ? currentInput.defaultTags
    : [];

  const isPresenceEngine = engineKey === "presence";

  const isDefaultTagsLocked = isLockedField("defaultTags");

  const hasReachedMaxDefaultTags =
    defaultTags.length >= TAG_LIST_LIMITS.maxItems.max;

  const disableAddDefaultTag =
    isDefaultTagsLocked || hasReachedMaxDefaultTags;

  const disableAllowCustomTags =
    isPresenceEngine || isLockedField("allowCustomTags");

  return (
    <div className="input-configurator-group">
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
        min={TAG_LIST_LIMITS.maxLength.min}
        max={TAG_LIST_LIMITS.maxLength.max}
      />

      <MaxItemsField
        currentInput={currentInput}
        onChange={handleMaxItemsChange}
        onBlur={handleMaxItemsBlur}
        isLockedField={isLockedField}
        min={TAG_LIST_LIMITS.maxItems.min}
        max={TAG_LIST_LIMITS.maxItems.max}
      />

      <label
        className="input-configurator-option"
        title={
          isPresenceEngine
            ? "Custom tags are disabled for presence projects."
            : ""
        }
      >
        Allow Custom Tags:
        <input
          type="checkbox"
          checked={
            isPresenceEngine ? false : currentInput.allowCustomTags === true
          }
          onChange={() => {
            if (disableAllowCustomTags) return;
            toggleOption("allowCustomTags");
          }}
          disabled={disableAllowCustomTags}
        />
      </label>

      {renderPreviewTextSelect(currentInput.type)}

      <h3 className="input-configurator-subtitle">Default Tags</h3>

      <ul className="input-configurator-dropdown-options">
        {defaultTags.map((tag, idx) => (
          <li key={idx} className="input-configurator-dropdown-option-item">
            <input
              type="text"
              value={tag}
              maxLength={TAG_LIST_LIMITS.maxLength.default}
              onChange={(e) => handleRenameDefaultTag(e, idx)}
              onBlur={() => handleDefaultTagBlur(idx)}
              disabled={isDefaultTagsLocked}
            />

            <span
              className="input-configurator-delete-option"
              onClick={() =>
                !isDefaultTagsLocked && handleDeleteDefaultTag(idx)
              }
              title={
                isDefaultTagsLocked ? "Default tags are locked" : "Delete Tag"
              }
              style={{
                pointerEvents: isDefaultTagsLocked ? "none" : "auto",
                opacity: isDefaultTagsLocked ? 0.5 : 1,
              }}
            >
              &minus;
            </span>
          </li>
        ))}
      </ul>

      <button
        className="input-configurator-add-option-button"
        onClick={handleAddDefaultTag}
        disabled={disableAddDefaultTag}
        title={
          isDefaultTagsLocked
            ? "Default tags are locked"
            : hasReachedMaxDefaultTags
              ? `Maximum of ${TAG_LIST_LIMITS.maxItems.max} default tags reached`
              : "Add Tag"
        }
        style={{
          opacity: disableAddDefaultTag ? 0.6 : 1,
          cursor: disableAddDefaultTag ? "not-allowed" : "pointer",
        }}
      >
        Add Tag ➕
      </button>
    </div>
  );
}

export default TagListConfigurator;