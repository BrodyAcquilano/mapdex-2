import IsFilterField from "../fieldControls/IsFilterField.jsx";
import IsDisplayedField from "../fieldControls/IsDisplayedField.jsx";
import MaxLengthField from "../fieldControls/MaxLengthField.jsx";
import DisplayIfEmptyField from "../fieldControls/DisplayIfEmptyField.jsx";
import EmptyDisplayTextField from "../fieldControls/EmptyDisplayTextField.jsx";
import { PRICE_RANGE_ARRAY_LIMITS } from "../../../../../shared/validation/validationConstants.js";

function sortPriceModes(modes) {
  return PRICE_RANGE_ARRAY_LIMITS.modeOptions.filter((mode) =>
    modes.includes(mode),
  );
}

function PriceRangeConfigurator({
  currentInput,
  toggleOption,
  isLockedField,
  handlePriceMinValueChange,
  handlePriceMinValueBlur,
  handlePriceMaxValueChange,
  handlePriceMaxValueBlur,
  handleMaxLengthChange,
  handleMaxLengthBlur,
  handleEmptyDisplayTextChange,
  handleAddPriceCategory,
  handleRenamePriceCategory,
  handlePriceCategoryBlur,
  handleDeletePriceCategory,
  handleAddPriceMode,
  handleDeletePriceMode,
  handleAddUnit,
  handleRenameUnit,
  handleUnitBlur,
  handleDeleteUnit,
  safeArr,
  renderPreviewTextSelect,
  engineKey,
}) {
  const categories = safeArr(currentInput.defaultCategoryOptions);

  const isPresenceEngine = engineKey === "presence";

  const rawModes = Array.isArray(currentInput.priceModeOptions)
    ? currentInput.priceModeOptions
    : [];

  const modes = (() => {
    const sorted = sortPriceModes(rawModes);
    return sorted.length > 0
      ? sorted
      : [PRICE_RANGE_ARRAY_LIMITS.modeOptions[0]];
  })();

  const addablePriceModes = PRICE_RANGE_ARRAY_LIMITS.modeOptions.filter(
    (mode) => !modes.includes(mode),
  );

  const isCategoryLocked = isLockedField("defaultCategoryOptions");
  const isModeLocked = isLockedField("priceModeOptions");
  const isUnitLocked = isLockedField("defaultPriceUnitOptionsByCategory");

  const hasReachedMaxCategories =
    categories.length >= PRICE_RANGE_ARRAY_LIMITS.maxCategories.max;

  const disableAllowCustomCategoriesAndUnits =
    isPresenceEngine || isLockedField("allowCustomCategoriesAndUnits");

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
        min={PRICE_RANGE_ARRAY_LIMITS.maxLength.min}
        max={PRICE_RANGE_ARRAY_LIMITS.maxLength.max}
      />

      <label className="input-configurator-option">
        Min Value:
        <input
          type="text"
          value={currentInput.minValue ?? ""}
          onChange={handlePriceMinValueChange}
          onBlur={handlePriceMinValueBlur}
          disabled={isLockedField("minValue")}
        />
      </label>

      <label className="input-configurator-option">
        Max Value:
        <input
          type="text"
          value={currentInput.maxValue ?? ""}
          onChange={handlePriceMaxValueChange}
          onBlur={handlePriceMaxValueBlur}
          disabled={isLockedField("maxValue")}
        />
      </label>

      <label
        className="input-configurator-option"
        title={
          isPresenceEngine
            ? "Custom price categories and units are disabled for presence projects."
            : ""
        }
      >
        Allow Custom Categories/Units:
        <input
          type="checkbox"
          checked={
            isPresenceEngine
              ? false
              : currentInput.allowCustomCategoriesAndUnits === true
          }
          onChange={() => {
            if (disableAllowCustomCategoriesAndUnits) return;
            toggleOption("allowCustomCategoriesAndUnits");
          }}
          disabled={disableAllowCustomCategoriesAndUnits}
        />
      </label>

      {renderPreviewTextSelect(currentInput.type)}

      <h3 className="input-configurator-subtitle">Price Categories</h3>

      <ul className="input-configurator-dropdown-options">
        {categories.map((cat, catIdx) => {
          const disableDelete =
            isCategoryLocked ||
            categories.length <= PRICE_RANGE_ARRAY_LIMITS.maxCategories.min;

          return (
            <li
              key={catIdx}
              className="input-configurator-dropdown-option-item"
            >
              <input
                type="text"
                value={cat}
                maxLength={PRICE_RANGE_ARRAY_LIMITS.maxLength.max}
                onChange={(e) => handleRenamePriceCategory(e, catIdx)}
                onBlur={() => handlePriceCategoryBlur(catIdx)}
                disabled={isCategoryLocked}
              />

              <span
                className="input-configurator-delete-option"
                onClick={() =>
                  !disableDelete && handleDeletePriceCategory(catIdx)
                }
                title={
                  disableDelete
                    ? "At least one category is required"
                    : "Delete Category"
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
        onClick={handleAddPriceCategory}
        disabled={isCategoryLocked || hasReachedMaxCategories}
        title={
          isCategoryLocked
            ? "Categories are locked"
            : hasReachedMaxCategories
              ? `Maximum of ${PRICE_RANGE_ARRAY_LIMITS.maxCategories.max} categories reached`
              : "Add Category"
        }
        style={{
          opacity: isCategoryLocked || hasReachedMaxCategories ? 0.6 : 1,
          cursor:
            isCategoryLocked || hasReachedMaxCategories
              ? "not-allowed"
              : "pointer",
        }}
      >
        Add Category ➕
      </button>

      <h3 className="input-configurator-subtitle">Price Modes</h3>

      <ul className="input-configurator-static-list">
        {modes.map((mode) => (
          <li key={mode} className="input-configurator-static-item">
            <span className="input-configurator-static-list-label">
              - {mode}
            </span>

            <span
              className="input-configurator-delete-option"
              onClick={() => {
                if (isModeLocked) return;
                if (modes.length <= 1) return;
                handleDeletePriceMode(mode);
              }}
              title={
                modes.length <= 1
                  ? "At least one mode is required."
                  : "Delete Mode"
              }
              style={{
                pointerEvents:
                  isModeLocked || modes.length <= 1 ? "none" : "auto",
                opacity: isModeLocked || modes.length <= 1 ? 0.5 : 1,
              }}
            >
              &minus;
            </span>
          </li>
        ))}
      </ul>

      {addablePriceModes.length > 0 && (
        <label className="input-configurator-option">
          Add Mode:
          <select
            value=""
            onChange={(e) => {
              const nextMode = e.target.value;
              if (!nextMode || isModeLocked) return;
              handleAddPriceMode(nextMode);
            }}
            disabled={isModeLocked}
          >
            <option value="">Select mode...</option>
            {addablePriceModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
      )}

      <h3 className="input-configurator-subtitle">Units per Category</h3>

      {categories.map((cat, catIdx) => {
        const units = safeArr(
          currentInput.defaultPriceUnitOptionsByCategory?.[cat],
        );
        const hasReachedMaxUnits =
          units.length >= PRICE_RANGE_ARRAY_LIMITS.maxUnitsPerCategory.max;

        return (
          <div key={catIdx} style={{ marginBottom: 14 }}>
            <div
              className="input-configurator-toolbar"
              style={{
                margin: "8px 0 6px",
                padding: "6px 8px",
                borderRadius: 8,
                background: "rgba(48,46,46,1)",
              }}
            >
              <span className="input-configurator-toolbar-title">
                {cat} Units
              </span>
            </div>

            <ul className="input-configurator-dropdown-options">
              {units.map((unit, unitIdx) => {
                const disableDelete =
                  isUnitLocked ||
                  units.length <=
                    PRICE_RANGE_ARRAY_LIMITS.maxUnitsPerCategory.min;

                return (
                  <li
                    key={unitIdx}
                    className="input-configurator-dropdown-option-item"
                  >
                    <input
                      type="text"
                      value={unit}
                      maxLength={PRICE_RANGE_ARRAY_LIMITS.maxLength.max}
                      onChange={(e) =>
                        handleRenameUnit(cat, unitIdx, e.target.value)
                      }
                      onBlur={() => handleUnitBlur(cat, unitIdx)}
                      disabled={isUnitLocked}
                    />

                    <span
                      className="input-configurator-delete-option"
                      onClick={() =>
                        !disableDelete && handleDeleteUnit(cat, unitIdx)
                      }
                      title={
                        disableDelete
                          ? "At least one unit is required"
                          : "Delete Unit"
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
              onClick={() => handleAddUnit(cat)}
              disabled={isUnitLocked || hasReachedMaxUnits}
              title={
                isUnitLocked
                  ? "Units are locked"
                  : hasReachedMaxUnits
                    ? `Maximum of ${PRICE_RANGE_ARRAY_LIMITS.maxUnitsPerCategory.max} units reached`
                    : "Add Unit"
              }
              style={{
                opacity: isUnitLocked || hasReachedMaxUnits ? 0.6 : 1,
                cursor:
                  isUnitLocked || hasReachedMaxUnits
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              Add Unit ➕
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default PriceRangeConfigurator;