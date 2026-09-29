import {
  AGE_RANGE_LIMITS,
  NUMBER_LIMITS,
  PERCENTAGE_LIMITS,
  PRICE_RANGE_ARRAY_LIMITS,
  CAPACITY_LIMITS,
  DROPDOWN_LIMITS,
  TAG_LIST_LIMITS,
  TEXT_LIMITS,
  NOTES_LIMITS,
  WEBSITE_LIMITS,
  PHONE_NUMBER_LIMITS,
  EMAIL_LIMITS,
} from "../../../../../shared/validation/validationConstants.js";

function sortAgeModes(modes) {
  return AGE_RANGE_LIMITS.modeOptions.filter((mode) => modes.includes(mode));
}

function sortQuantitativeModes(modes) {
  return NUMBER_LIMITS.modeOptions.filter((mode) => modes.includes(mode));
}

function sortPriceModes(modes) {
  return PRICE_RANGE_ARRAY_LIMITS.modeOptions.filter((mode) =>
    modes.includes(mode),
  );
}

function sortCapacityModes(modes) {
  return CAPACITY_LIMITS.modeOptions.filter((mode) => modes.includes(mode));
}

export function createSchemaMutators({
  schema,
  setSchema,
  selectedSectionIndex,
  selectedInputIndex,
  isLockedField,
  safeArr,
}) {
  const isInputSelected =
    selectedSectionIndex !== null && selectedInputIndex !== null;

  function getSelectedInput(updatedSchema = schema) {
    if (!isInputSelected) return null;

    return (
      updatedSchema.sections?.[selectedSectionIndex]?.inputs?.[
        selectedInputIndex
      ] ?? null
    );
  }

  function getMaxLengthLimitsForInputType(inputType) {
    switch (inputType) {
      case "text":
        return TEXT_LIMITS.maxLength;
      case "notes":
        return NOTES_LIMITS.maxLength;
      case "website":
        return WEBSITE_LIMITS.maxLength;
      case "phoneNumber":
        return PHONE_NUMBER_LIMITS.maxLength;
      case "email":
        return EMAIL_LIMITS.maxLength;
      case "number":
        return NUMBER_LIMITS.maxLength;
      case "percentage":
        return PERCENTAGE_LIMITS.maxLength;
      case "capacity":
        return CAPACITY_LIMITS.maxLength;
      case "ageRange":
        return AGE_RANGE_LIMITS.maxLength;
      case "priceRangeArray":
        return PRICE_RANGE_ARRAY_LIMITS.maxLength;
      case "tagList":
        return TAG_LIST_LIMITS.maxLength;
      default:
        return TEXT_LIMITS.maxLength;
    }
  }

  function getMaxItemsLimitsForInputType(inputType) {
    switch (inputType) {
      case "tagList":
        return TAG_LIST_LIMITS.maxItems;
      default:
        return TAG_LIST_LIMITS.maxItems;
    }
  }

  function getValueLimitsForInputType(inputType) {
    switch (inputType) {
      case "number":
        return {
          min: NUMBER_LIMITS.minValue,
          max: NUMBER_LIMITS.maxValue,
        };
      case "percentage":
        return {
          min: PERCENTAGE_LIMITS.minValue,
          max: PERCENTAGE_LIMITS.maxValue,
        };
      case "capacity":
        return {
          min: CAPACITY_LIMITS.minValue,
          max: CAPACITY_LIMITS.maxValue,
        };
      case "ageRange":
        return {
          min: AGE_RANGE_LIMITS.minValue,
          max: AGE_RANGE_LIMITS.maxValue,
        };
      default:
        return {
          min: NUMBER_LIMITS.minValue,
          max: NUMBER_LIMITS.maxValue,
        };
    }
  }

  function normalizeSelectedInputState(input) {
    if (!input || typeof input !== "object") return;

    const supportsDisplayIfEmpty =
      input.type === "text" ||
      input.type === "notes" ||
      input.type === "website" ||
      input.type === "phoneNumber" ||
      input.type === "email" ||
      input.type === "number" ||
      input.type === "percentage" ||
      input.type === "dropdown" ||
      input.type === "capacity" ||
      input.type === "ageRange" ||
      input.type === "hours" ||
      input.type === "priceRangeArray" ||
      input.type === "tagList";

    const supportsEmptyDisplayText =
      input.type === "text" ||
      input.type === "notes" ||
      input.type === "website" ||
      input.type === "phoneNumber" ||
      input.type === "email" ||
      input.type === "number" ||
      input.type === "percentage" ||
      input.type === "dropdown" ||
      input.type === "capacity" ||
      input.type === "ageRange" ||
      input.type === "priceRangeArray" ||
      input.type === "tagList";

    if (supportsDisplayIfEmpty) {
      if (input.isDisplayed !== true || input.isRequired === true) {
        input.displayIfEmpty = false;
      }
    }

    if (supportsEmptyDisplayText) {
      if (input.isDisplayed !== true || input.isRequired === true) {
        input.emptyDisplayText = "";
      }
    }

    if (input.type === "checkbox") {
      const usesTrueMessage =
        input.displayWhenTrue === "labelMessage" ||
        input.displayWhenTrue === "messageOnly";

      const usesFalseMessage =
        input.displayWhenFalse === "labelMessage" ||
        input.displayWhenFalse === "messageOnly";

      if (!usesTrueMessage) {
        input.trueDisplayText = "";
      }

      if (!usesFalseMessage) {
        input.falseDisplayText = "";
      }

      if (input.displayWhenFalse === "none") {
        input.isApplicableOption = false;
      }
    }
  }

  function setField(field, value) {
    if (!isInputSelected) return;
    if (isLockedField(field)) return;

    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) return;

    input[field] = value;
    normalizeSelectedInputState(input);

    setSchema(updatedSchema);
  }

  function toggleOption(option) {
    if (!isInputSelected) return;
    if (isLockedField(option)) return;

    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) return;

    input[option] = !input[option];
    normalizeSelectedInputState(input);

    setSchema(updatedSchema);
  }

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function requiredNumberLength(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 1;

    return String(num).length;
  }

  function getRequiredMaxLengthForNumericInput(input) {
    if (!input || typeof input !== "object") return 1;

    const lengths = [];

    if (Number.isFinite(Number(input.minValue))) {
      lengths.push(requiredNumberLength(input.minValue));
    }

    if (Number.isFinite(Number(input.maxValue))) {
      lengths.push(requiredNumberLength(input.maxValue));
    }

    if (lengths.length === 0) return 1;

    return Math.max(...lengths);
  }

  function normalizeNumericInputBoundsAndLength(input) {
    if (!input || typeof input !== "object") return;

    const numericTypes = ["number", "percentage", "capacity", "ageRange"];

    if (!numericTypes.includes(input.type)) return;

    const valueLimits = getValueLimitsForInputType(input.type);
    const maxLengthLimits = getMaxLengthLimitsForInputType(input.type);

    const minLimit = valueLimits?.min ?? NUMBER_LIMITS.minValue;
    const maxLimit = valueLimits?.max ?? NUMBER_LIMITS.maxValue;

    if (Number.isFinite(Number(input.minValue))) {
      input.minValue = clampNumber(Number(input.minValue), minLimit, maxLimit);
    }

    if (Number.isFinite(Number(input.maxValue))) {
      input.maxValue = clampNumber(Number(input.maxValue), minLimit, maxLimit);
    }

    if (
      Number.isFinite(Number(input.minValue)) &&
      Number.isFinite(Number(input.maxValue)) &&
      Number(input.maxValue) < Number(input.minValue)
    ) {
      input.maxValue = input.minValue;
    }

    const baseMaxLength = Number.isFinite(Number(input.maxLength))
      ? Number(input.maxLength)
      : maxLengthLimits.default;

    const requiredMaxLength = getRequiredMaxLengthForNumericInput(input);

    input.maxLength = clampNumber(
      Math.max(baseMaxLength, requiredMaxLength),
      maxLengthLimits.min,
      maxLengthLimits.max,
    );
  }

  function finalizeNumericField(field, raw, getLimitsForInputType) {
    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) return;

    const limits = getLimitsForInputType(input?.type);
    const min = limits?.min ?? 1;
    const max = limits?.max ?? 1000;

    const parsed = raw === "" ? min : parseInt(raw, 10);

    input[field] = Number.isNaN(parsed)
      ? min
      : clampNumber(parsed, min, max);

    normalizeNumericInputBoundsAndLength(input);
    normalizeSelectedInputState(input);

    setSchema(updatedSchema);
  }

  function finalizeValueField(field, raw, getLimitsForInputType) {
    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) return;

    const limits = getLimitsForInputType(input?.type);
    const min = limits?.min ?? NUMBER_LIMITS.minValue;
    const max = limits?.max ?? NUMBER_LIMITS.maxValue;

    const parsed = raw === "" ? min : parseFloat(raw);

    input[field] = Number.isNaN(parsed)
      ? min
      : clampNumber(parsed, min, max);

    normalizeNumericInputBoundsAndLength(input);
    normalizeSelectedInputState(input);

    setSchema(updatedSchema);
  }

  function createNumericFieldHandlers(field, getLimitsForInputType) {
    function handleChange(e) {
      if (!isInputSelected) return;
      if (isLockedField(field)) return;

      const raw = e.target.value;

      if (raw === "") {
        setField(field, "");
        return;
      }

      const parsed = parseInt(raw, 10);
      if (Number.isNaN(parsed)) return;

      setField(field, parsed);
    }

    function handleBlur(e) {
      if (!isInputSelected) return;
      if (isLockedField(field)) return;

      finalizeNumericField(field, e.target.value, getLimitsForInputType);
    }

    return { handleChange, handleBlur };
  }

  function createValueFieldHandlers(field, getLimitsForInputType) {
    function handleChange(e) {
      if (!isInputSelected) return;
      if (isLockedField(field)) return;

      const raw = e.target.value;

      if (raw === "") {
        setField(field, "");
        return;
      }

      const parsed = parseFloat(raw);
      if (Number.isNaN(parsed)) return;

      setField(field, parsed);
    }

    function handleBlur(e) {
      if (!isInputSelected) return;
      if (isLockedField(field)) return;

      finalizeValueField(field, e.target.value, getLimitsForInputType);
    }

    return { handleChange, handleBlur };
  }

  function clampPriceString(rawValue, minString, maxString) {
    const parsed = Number(rawValue);
    const min = Number(minString);
    const max = Number(maxString);

    if (!Number.isFinite(parsed)) {
      return min.toFixed(2);
    }

    const clamped = Math.min(Math.max(parsed, min), max);
    return clamped.toFixed(2);
  }

  function createPriceFieldHandlers(field) {
    function handleChange(e) {
      if (!isInputSelected) return;
      if (isLockedField(field)) return;

      const raw = e.target.value;

      if (raw === "") {
        setField(field, "");
        return;
      }

      if (!/^\d*\.?\d*$/.test(raw)) return;

      setField(field, raw);
    }

    function handleBlur(e) {
      if (!isInputSelected) return;
      if (isLockedField(field)) return;

      const raw = e.target.value;

      if (raw === "") {
        setField(field, PRICE_RANGE_ARRAY_LIMITS.minValue);
        return;
      }

      setField(
        field,
        clampPriceString(
          raw,
          PRICE_RANGE_ARRAY_LIMITS.minValue,
          PRICE_RANGE_ARRAY_LIMITS.maxValue,
        ),
      );
    }

    return { handleChange, handleBlur };
  }

  const {
    handleChange: handleMaxLengthChange,
    handleBlur: handleMaxLengthBlur,
  } = createNumericFieldHandlers("maxLength", getMaxLengthLimitsForInputType);

  const { handleChange: handleMaxItemsChange, handleBlur: handleMaxItemsBlur } =
    createNumericFieldHandlers("maxItems", getMaxItemsLimitsForInputType);

  const { handleChange: handleMinValueChange, handleBlur: handleMinValueBlur } =
    createValueFieldHandlers("minValue", getValueLimitsForInputType);

  const { handleChange: handleMaxValueChange, handleBlur: handleMaxValueBlur } =
    createValueFieldHandlers("maxValue", getValueLimitsForInputType);

  const {
    handleChange: handlePriceMinValueChange,
    handleBlur: handlePriceMinValueBlur,
  } = createPriceFieldHandlers("minValue");

  const {
    handleChange: handlePriceMaxValueChange,
    handleBlur: handlePriceMaxValueBlur,
  } = createPriceFieldHandlers("maxValue");

  function handleEmptyDisplayTextChange(e) {
    setField("emptyDisplayText", e.target.value);
  }

  function handleNotesChange(e) {
    setField("notes", e.target.value);
  }

  function handleDisplayModeChange(field, value) {
    setField(field, value);
  }

  function handleFalseDisplayTextChange(e) {
    setField("falseDisplayText", e.target.value);
  }

  function handleTrueDisplayTextChange(e) {
    setField("trueDisplayText", e.target.value);
  }

  function handleAddDropdownOption() {
    if (!isInputSelected) return;
    if (isLockedField("options")) return;

    const updatedSchema = { ...schema };
    const dropdown = getSelectedInput(updatedSchema);

    if (!dropdown) return;

    dropdown.options = dropdown.options || [];

    if (dropdown.options.length >= DROPDOWN_LIMITS.maxOptions.max) {
      return;
    }

    dropdown.options.push(`Option ${dropdown.options.length + 1}`);

    normalizeSelectedInputState(dropdown);
    setSchema(updatedSchema);
  }

  function handleDropdownOptionRename(e, idx) {
    if (!isInputSelected) return;
    if (isLockedField("options")) return;

    const updatedSchema = { ...schema };
    const dropdown = getSelectedInput(updatedSchema);

    if (!dropdown) return;

    dropdown.options = dropdown.options || [];
    dropdown.options[idx] = e.target.value;

    normalizeSelectedInputState(dropdown);
    setSchema(updatedSchema);
  }

  function handleDeleteDropdownOption(idx) {
    if (!isInputSelected) return;
    if (isLockedField("options")) return;

    const updatedSchema = { ...schema };
    const dropdown = getSelectedInput(updatedSchema);

    if (!dropdown) return;

    dropdown.options = dropdown.options || [];

    if (dropdown.options.length <= DROPDOWN_LIMITS.maxOptions.min) {
      return;
    }

    dropdown.options.splice(idx, 1);

    normalizeSelectedInputState(dropdown);
    setSchema(updatedSchema);
  }

  function handleAddAgeModeOption(nextMode) {
    if (!isInputSelected) return;
    if (isLockedField("ageModeOptions")) return;
    if (!nextMode) return;

    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) return;

    const existingModes = sortAgeModes(
      Array.isArray(input.ageModeOptions) ? input.ageModeOptions : [],
    );

    input.ageModeOptions = sortAgeModes([...existingModes, nextMode]);

    normalizeSelectedInputState(input);
    setSchema(updatedSchema);
  }

  function handleDeleteAgeModeOption(modeToDelete) {
    if (!isInputSelected) return;
    if (isLockedField("ageModeOptions")) return;

    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) return;

    const existingModes = sortAgeModes(
      Array.isArray(input.ageModeOptions) ? input.ageModeOptions : [],
    );

    if (existingModes.length <= 1) return;

    const nextModes = sortAgeModes(
      existingModes.filter((mode) => mode !== modeToDelete),
    );

    input.ageModeOptions =
      nextModes.length > 0 ? nextModes : [AGE_RANGE_LIMITS.modeOptions[0]];

    normalizeSelectedInputState(input);
    setSchema(updatedSchema);
  }

  function handleAddModeOption(nextMode) {
    if (!isInputSelected) return;
    if (isLockedField("modeOptions")) return;
    if (!nextMode) return;

    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) return;

    const existingModes = sortQuantitativeModes(
      Array.isArray(input.modeOptions) ? input.modeOptions : [],
    );

    input.modeOptions = sortQuantitativeModes([...existingModes, nextMode]);

    normalizeSelectedInputState(input);
    setSchema(updatedSchema);
  }

  function handleAddCapacityModeOption(nextMode) {
    if (!isInputSelected) return;
    if (isLockedField("modeOptions")) return;
    if (!nextMode) return;

    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) return;

    const existingModes = sortCapacityModes(
      Array.isArray(input.modeOptions) ? input.modeOptions : [],
    );

    input.modeOptions = sortCapacityModes([...existingModes, nextMode]);

    normalizeSelectedInputState(input);
    setSchema(updatedSchema);
  }

  function handleDeleteCapacityModeOption(modeToDelete) {
    if (!isInputSelected) return;
    if (isLockedField("modeOptions")) return;

    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) return;

    const existingModes = sortCapacityModes(
      Array.isArray(input.modeOptions) ? input.modeOptions : [],
    );

    if (existingModes.length <= 1) return;

    const nextModes = sortCapacityModes(
      existingModes.filter((mode) => mode !== modeToDelete),
    );

    input.modeOptions =
      nextModes.length > 0 ? nextModes : [CAPACITY_LIMITS.modeOptions[0]];

    normalizeSelectedInputState(input);
    setSchema(updatedSchema);
  }

  function handleDeleteModeOption(modeToDelete) {
    if (!isInputSelected) return;
    if (isLockedField("modeOptions")) return;

    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) return;

    const existingModes = sortQuantitativeModes(
      Array.isArray(input.modeOptions) ? input.modeOptions : [],
    );

    if (existingModes.length <= 1) return;

    const nextModes = sortQuantitativeModes(
      existingModes.filter((mode) => mode !== modeToDelete),
    );

    input.modeOptions =
      nextModes.length > 0 ? nextModes : [NUMBER_LIMITS.modeOptions[0]];

    normalizeSelectedInputState(input);
    setSchema(updatedSchema);
  }

  function getDefaultCategoryName(idx) {
    return `Category ${idx + 1}`;
  }

  function getDefaultUnitName(idx) {
    return `Unit ${idx + 1}`;
  }

  function getPriceInputClone() {
    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) {
      return { updatedSchema, input: null };
    }

    input.defaultCategoryOptions = safeArr(input.defaultCategoryOptions);
    input.priceModeOptions = safeArr(input.priceModeOptions);
    input.defaultPriceUnitOptionsByCategory =
      input.defaultPriceUnitOptionsByCategory || {};

    const cleanedCategories = [];
    const cleanedUnitMap = {};

    input.defaultCategoryOptions.forEach((category, idx) => {
      const normalizedCategory =
        typeof category === "string" ? category : String(category ?? "");

      const fallbackCategory =
        normalizedCategory.trim() === ""
          ? getDefaultCategoryName(idx)
          : normalizedCategory;

      cleanedCategories.push(fallbackCategory);
      cleanedUnitMap[fallbackCategory] = safeArr(
        input.defaultPriceUnitOptionsByCategory[category] ??
          input.defaultPriceUnitOptionsByCategory[fallbackCategory],
      ).map((unit, unitIdx) => {
        const normalizedUnit =
          typeof unit === "string" ? unit : String(unit ?? "");
        return normalizedUnit.trim() === ""
          ? getDefaultUnitName(unitIdx)
          : normalizedUnit;
      });

      if (cleanedUnitMap[fallbackCategory].length === 0) {
        cleanedUnitMap[fallbackCategory] = [getDefaultUnitName(0)];
      }
    });

    input.defaultCategoryOptions = cleanedCategories;
    input.defaultPriceUnitOptionsByCategory = cleanedUnitMap;

    return { updatedSchema, input };
  }

  function handleAddPriceCategory() {
    if (!isInputSelected) return;
    if (isLockedField("defaultCategoryOptions")) return;

    const { updatedSchema, input } = getPriceInputClone();
    if (!input) return;

    if (
      input.defaultCategoryOptions.length >=
      PRICE_RANGE_ARRAY_LIMITS.maxCategories.max
    ) {
      return;
    }

    const nextName = getDefaultCategoryName(
      input.defaultCategoryOptions.length,
    );

    input.defaultCategoryOptions.push(nextName);

    if (!input.defaultPriceUnitOptionsByCategory[nextName]) {
      input.defaultPriceUnitOptionsByCategory[nextName] = [
        getDefaultUnitName(0),
      ];
    }

    setSchema(updatedSchema);
  }

  function handleRenamePriceCategory(e, idx) {
    if (!isInputSelected) return;
    if (isLockedField("defaultCategoryOptions")) return;

    const rawName = e.target.value;
    const { updatedSchema, input } = getPriceInputClone();
    if (!input) return;

    input.defaultCategoryOptions[idx] = rawName;
    setSchema(updatedSchema);
  }

  function handlePriceCategoryBlur(idx) {
    if (!isInputSelected) return;
    if (isLockedField("defaultCategoryOptions")) return;

    const { updatedSchema, input } = getPriceInputClone();
    if (!input) return;

    const oldName = input.defaultCategoryOptions[idx];
    const trimmedName =
      typeof oldName === "string"
        ? oldName.trim()
        : String(oldName ?? "").trim();

    const finalName =
      trimmedName === "" ? getDefaultCategoryName(idx) : trimmedName;

    const existingUnits = safeArr(
      input.defaultPriceUnitOptionsByCategory[oldName],
    );

    const fallbackUnits = safeArr(
      input.defaultPriceUnitOptionsByCategory[finalName],
    );

    input.defaultCategoryOptions[idx] = finalName;

    if (oldName !== finalName) {
      input.defaultPriceUnitOptionsByCategory[finalName] = fallbackUnits.length
        ? [
            ...fallbackUnits,
            ...existingUnits.filter((unit) => !fallbackUnits.includes(unit)),
          ]
        : existingUnits.length
          ? existingUnits
          : [getDefaultUnitName(0)];

      delete input.defaultPriceUnitOptionsByCategory[oldName];
    } else if (!input.defaultPriceUnitOptionsByCategory[finalName]) {
      input.defaultPriceUnitOptionsByCategory[finalName] = [
        getDefaultUnitName(0),
      ];
    }

    setSchema(updatedSchema);
  }

  function handleDeletePriceCategory(idx) {
    if (!isInputSelected) return;
    if (isLockedField("defaultCategoryOptions")) return;

    const { updatedSchema, input } = getPriceInputClone();
    if (!input) return;

    if (
      input.defaultCategoryOptions.length <=
      PRICE_RANGE_ARRAY_LIMITS.maxCategories.min
    ) {
      return;
    }

    const category = input.defaultCategoryOptions[idx];

    input.defaultCategoryOptions.splice(idx, 1);

    if (category && input.defaultPriceUnitOptionsByCategory?.[category]) {
      delete input.defaultPriceUnitOptionsByCategory[category];
    }

    setSchema(updatedSchema);
  }

  function handleAddPriceMode(nextMode) {
    if (!isInputSelected) return;
    if (isLockedField("priceModeOptions")) return;
    if (!nextMode) return;

    const { updatedSchema, input } = getPriceInputClone();
    if (!input) return;

    const existingModes = sortPriceModes(
      Array.isArray(input.priceModeOptions) ? input.priceModeOptions : [],
    );

    input.priceModeOptions = sortPriceModes([...existingModes, nextMode]);

    setSchema(updatedSchema);
  }

  function handleDeletePriceMode(modeToDelete) {
    if (!isInputSelected) return;
    if (isLockedField("priceModeOptions")) return;

    const { updatedSchema, input } = getPriceInputClone();
    if (!input) return;

    const existingModes = sortPriceModes(
      Array.isArray(input.priceModeOptions) ? input.priceModeOptions : [],
    );

    if (existingModes.length <= 1) return;

    const nextModes = sortPriceModes(
      existingModes.filter((mode) => mode !== modeToDelete),
    );

    input.priceModeOptions =
      nextModes.length > 0
        ? nextModes
        : [PRICE_RANGE_ARRAY_LIMITS.modeOptions[0]];

    setSchema(updatedSchema);
  }

  function ensureUnitsFor(category) {
    const { updatedSchema, input } = getPriceInputClone();
    if (!input) {
      return { updatedSchema, input: null };
    }

    input.defaultPriceUnitOptionsByCategory[category] = safeArr(
      input.defaultPriceUnitOptionsByCategory[category],
    ).map((unit, unitIdx) => {
      const normalizedUnit =
        typeof unit === "string" ? unit : String(unit ?? "");
      return normalizedUnit.trim() === ""
        ? getDefaultUnitName(unitIdx)
        : normalizedUnit;
    });

    if (input.defaultPriceUnitOptionsByCategory[category].length === 0) {
      input.defaultPriceUnitOptionsByCategory[category] = [
        getDefaultUnitName(0),
      ];
    }

    return { updatedSchema, input };
  }

  function handleAddUnit(category) {
    if (!isInputSelected) return;
    if (isLockedField("defaultPriceUnitOptionsByCategory")) {
      return;
    }

    const { updatedSchema, input } = ensureUnitsFor(category);
    if (!input) return;

    if (
      input.defaultPriceUnitOptionsByCategory[category].length >=
      PRICE_RANGE_ARRAY_LIMITS.maxUnitsPerCategory.max
    ) {
      return;
    }

    input.defaultPriceUnitOptionsByCategory[category].push(
      getDefaultUnitName(
        input.defaultPriceUnitOptionsByCategory[category].length,
      ),
    );

    setSchema(updatedSchema);
  }

  function handleRenameUnit(category, idx, value) {
    if (!isInputSelected) return;
    if (isLockedField("defaultPriceUnitOptionsByCategory")) {
      return;
    }

    const { updatedSchema, input } = ensureUnitsFor(category);
    if (!input) return;

    input.defaultPriceUnitOptionsByCategory[category][idx] = value;

    setSchema(updatedSchema);
  }

  function handleUnitBlur(category, idx) {
    if (!isInputSelected) return;
    if (isLockedField("defaultPriceUnitOptionsByCategory")) return;

    const { updatedSchema, input } = ensureUnitsFor(category);
    if (!input) return;

    const currentValue = input.defaultPriceUnitOptionsByCategory[category][idx];

    const trimmedValue =
      typeof currentValue === "string"
        ? currentValue.trim()
        : String(currentValue ?? "").trim();

    input.defaultPriceUnitOptionsByCategory[category][idx] =
      trimmedValue === "" ? getDefaultUnitName(idx) : trimmedValue;

    setSchema(updatedSchema);
  }

  function handleDeleteUnit(category, idx) {
    if (!isInputSelected) return;
    if (isLockedField("defaultPriceUnitOptionsByCategory")) return;

    const { updatedSchema, input } = ensureUnitsFor(category);
    if (!input) return;

    if (
      input.defaultPriceUnitOptionsByCategory[category].length <=
      PRICE_RANGE_ARRAY_LIMITS.maxUnitsPerCategory.min
    ) {
      return;
    }

    input.defaultPriceUnitOptionsByCategory[category].splice(idx, 1);

    setSchema(updatedSchema);
  }

  function getDefaultTagName(idx) {
    return `Tag ${idx + 1}`;
  }

  function getTagInputClone() {
    const updatedSchema = { ...schema };
    const input = getSelectedInput(updatedSchema);

    if (!input) {
      return { updatedSchema, input: null };
    }

    input.defaultTags = safeArr(input.defaultTags);

    return { updatedSchema, input };
  }

  function handleAddDefaultTag() {
    if (!isInputSelected) return;
    if (isLockedField("defaultTags")) return;

    const { updatedSchema, input } = getTagInputClone();
    if (!input) return;

    if (input.defaultTags.length >= TAG_LIST_LIMITS.maxItems.max) {
      return;
    }

    input.defaultTags.push(getDefaultTagName(input.defaultTags.length));
    setSchema(updatedSchema);
  }

  function handleRenameDefaultTag(e, idx) {
    if (!isInputSelected) return;
    if (isLockedField("defaultTags")) return;

    const { updatedSchema, input } = getTagInputClone();
    if (!input) return;

    input.defaultTags[idx] = e.target.value;
    setSchema(updatedSchema);
  }

  function handleDefaultTagBlur(idx) {
    if (!isInputSelected) return;
    if (isLockedField("defaultTags")) return;

    const { updatedSchema, input } = getTagInputClone();
    if (!input) return;

    const currentValue = input.defaultTags[idx];

    const trimmedValue =
      typeof currentValue === "string"
        ? currentValue.trim()
        : String(currentValue ?? "").trim();

    input.defaultTags[idx] =
      trimmedValue === "" ? getDefaultTagName(idx) : trimmedValue;

    setSchema(updatedSchema);
  }

  function handleDeleteDefaultTag(idx) {
    if (!isInputSelected) return;
    if (isLockedField("defaultTags")) return;

    const { updatedSchema, input } = getTagInputClone();
    if (!input) return;

    input.defaultTags.splice(idx, 1);
    setSchema(updatedSchema);
  }

  return {
    setField,
    toggleOption,
    handleEmptyDisplayTextChange,
    handleMaxLengthChange,
    handleMaxLengthBlur,
    handleMaxItemsChange,
    handleMaxItemsBlur,
    handleMinValueChange,
    handleMinValueBlur,
    handleMaxValueChange,
    handleMaxValueBlur,
    handlePriceMinValueChange,
    handlePriceMinValueBlur,
    handlePriceMaxValueChange,
    handlePriceMaxValueBlur,
    handleNotesChange,
    handleDisplayModeChange,
    handleFalseDisplayTextChange,
    handleTrueDisplayTextChange,
    handleAddDropdownOption,
    handleDropdownOptionRename,
    handleDeleteDropdownOption,
    handleAddAgeModeOption,
    handleDeleteAgeModeOption,
    handleAddModeOption,
    handleDeleteModeOption,
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
    handleAddCapacityModeOption,
    handleDeleteCapacityModeOption,
    handleAddDefaultTag,
    handleRenameDefaultTag,
    handleDefaultTagBlur,
    handleDeleteDefaultTag,
  };
}