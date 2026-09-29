export function normalizePriceLabel(value) {
  if (typeof value !== "string") return "";

  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";

  return collapsed
    .split(" ")
    .map((word) => {
      if (!word) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function uniqueNormalizedStrings(values) {
  const result = [];
  const seen = new Set();

  for (const raw of safeArray(values)) {
    const normalized = normalizePriceLabel(raw);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function buildProjectPriceInputMap(projectSections) {
  const map = new Map();

  for (const section of projectSections || []) {
    for (const input of section.inputs || []) {
      if (input?.type !== "priceRangeArray") continue;
      map.set(String(input.id), input);
    }
  }

  return map;
}

function buildDataPriceInputMap(dataSections) {
  const map = new Map();

  for (const section of dataSections || []) {
    for (const input of section.inputs || []) {
      if (!input?.id) continue;
      map.set(String(input.id), input);
    }
  }

  return map;
}

function getDefaultCategorySet(schemaInput) {
  return new Set(
    uniqueNormalizedStrings(schemaInput?.defaultCategoryOptions).map((value) =>
      value.toLowerCase(),
    ),
  );
}

function getDefaultUnitsByCategory(schemaInput) {
  const rawMap = isPlainObject(schemaInput?.defaultPriceUnitOptionsByCategory)
    ? schemaInput.defaultPriceUnitOptionsByCategory
    : {};

  const result = {};

  for (const [rawCategory, rawUnits] of Object.entries(rawMap)) {
    const category = normalizePriceLabel(rawCategory);
    if (!category) continue;

    result[category] = uniqueNormalizedStrings(rawUnits);
  }

  return result;
}

function getCustomCategorySet(schemaInput) {
  return new Set(
    uniqueNormalizedStrings(schemaInput?.customCategoryOptions).map((value) =>
      value.toLowerCase(),
    ),
  );
}

function getCustomUnitsByCategory(schemaInput) {
  const rawMap = isPlainObject(schemaInput?.customUnitOptionsByCategory)
    ? schemaInput.customUnitOptionsByCategory
    : {};

  const result = {};

  for (const [rawCategory, rawUnits] of Object.entries(rawMap)) {
    const category = normalizePriceLabel(rawCategory);
    if (!category) continue;

    result[category] = uniqueNormalizedStrings(rawUnits);
  }

  return result;
}

function getNormalizedCategoriesFromInput(input) {
  const rawCategories = isPlainObject(input?.categories)
    ? input.categories
    : {};

  const result = {};

  for (const [rawCategory, rawRows] of Object.entries(rawCategories)) {
    const category = normalizePriceLabel(rawCategory);
    if (!category) continue;
    if (!Array.isArray(rawRows)) continue;

    if (!result[category]) {
      result[category] = [];
    }

    for (const rawRow of rawRows) {
      if (!rawRow || typeof rawRow !== "object") continue;

      result[category].push({
        label: normalizePriceLabel(rawRow.label),
        unit: normalizePriceLabel(rawRow.unit),
        priceMode:
          typeof rawRow.priceMode === "string" ? rawRow.priceMode : "",
        min: rawRow.min ?? null,
        max: rawRow.max ?? null,
        fixedPrice: rawRow.fixedPrice ?? null,
      });
    }
  }

  return result;
}

function getUnitMapFromNormalizedCategories(normalizedCategories) {
  const result = {};

  for (const [category, rows] of Object.entries(normalizedCategories || {})) {
    result[category] = uniqueNormalizedStrings(
      safeArray(rows).map((row) => row?.unit),
    );
  }

  return result;
}

function formatCategoryChanges(changeMap) {
  return Array.from(changeMap.entries())
    .map(([inputId, categories]) => ({
      inputId,
      categories: [...categories],
    }))
    .filter((entry) => entry.categories.length > 0);
}

function formatUnitChanges(changeMap) {
  return Array.from(changeMap.entries())
    .map(([inputId, unitsByCategory]) => ({
      inputId,
      unitsByCategory: Object.fromEntries(
        Object.entries(unitsByCategory).filter(([, units]) => units.length > 0),
      ),
    }))
    .filter((entry) => Object.keys(entry.unitsByCategory).length > 0);
}

function makePriceError(message, schemaInput, code) {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  error.inputId = String(schemaInput?.id || "");
  error.inputLabel = schemaInput?.label || "";
  return error;
}

function assertDefaultPriceOptionsOnly({
  schemaInput,
  category,
  unit,
  defaultCategorySet,
  defaultUnitsByCategory,
}) {
  if (schemaInput?.allowCustomCategoriesAndUnits !== false) return;

  if (!defaultCategorySet.has(category.toLowerCase())) {
    throw makePriceError(
      `Custom price categories are not allowed for input ${schemaInput.label || schemaInput.id}.`,
      schemaInput,
      "PRICE_RANGE_CUSTOM_CATEGORIES_NOT_ALLOWED",
    );
  }

  if (unit) {
    const defaultUnits = uniqueNormalizedStrings(defaultUnitsByCategory[category]);
    const defaultUnitSet = new Set(
      defaultUnits.map((value) => value.toLowerCase()),
    );

    if (!defaultUnitSet.has(unit.toLowerCase())) {
      throw makePriceError(
        `Custom price units are not allowed for input ${schemaInput.label || schemaInput.id}.`,
        schemaInput,
        "PRICE_RANGE_CUSTOM_UNITS_NOT_ALLOWED",
      );
    }
  }
}

function addCategoriesToChangeMap(changeMap, inputId, categories) {
  const normalizedCategories = uniqueNormalizedStrings(categories);
  if (normalizedCategories.length === 0) return;

  const key = String(inputId);
  const existingCategories = changeMap.get(key) || [];
  const existingSet = new Set(
    existingCategories.map((category) => category.toLowerCase()),
  );

  for (const category of normalizedCategories) {
    const categoryKey = category.toLowerCase();
    if (existingSet.has(categoryKey)) continue;

    existingSet.add(categoryKey);
    existingCategories.push(category);
  }

  changeMap.set(key, existingCategories);
}

function addUnitsToChangeMap(changeMap, inputId, category, units) {
  const normalizedCategory = normalizePriceLabel(category);
  if (!normalizedCategory) return;

  const normalizedUnits = uniqueNormalizedStrings(units);
  if (normalizedUnits.length === 0) return;

  const key = String(inputId);
  const unitsByCategory = changeMap.get(key) || {};
  const existingUnits = unitsByCategory[normalizedCategory] || [];
  const existingSet = new Set(existingUnits.map((unit) => unit.toLowerCase()));

  for (const unit of normalizedUnits) {
    const unitKey = unit.toLowerCase();
    if (existingSet.has(unitKey)) continue;

    existingSet.add(unitKey);
    existingUnits.push(unit);
  }

  unitsByCategory[normalizedCategory] = existingUnits;
  changeMap.set(key, unitsByCategory);
}

function countCategoryChangeMapItems(changeMap) {
  let count = 0;

  for (const categories of changeMap.values()) {
    count += categories.length;
  }

  return count;
}

function countUnitChangeMapItems(changeMap) {
  let count = 0;

  for (const unitsByCategory of changeMap.values()) {
    for (const units of Object.values(unitsByCategory || {})) {
      count += units.length;
    }
  }

  return count;
}

function removeCategoryFromChangeMap(changeMap, inputId, categoryToRemove) {
  const key = String(inputId);
  const categories = changeMap.get(key) || [];
  const removeKey = normalizePriceLabel(categoryToRemove).toLowerCase();

  const nextCategories = categories.filter(
    (category) => category.toLowerCase() !== removeKey,
  );

  if (nextCategories.length === 0) {
    changeMap.delete(key);
  } else {
    changeMap.set(key, nextCategories);
  }
}

function removeUnitFromChangeMap(changeMap, inputId, category, unitToRemove) {
  const key = String(inputId);
  const unitsByCategory = changeMap.get(key);
  if (!unitsByCategory) return;

  const normalizedCategory = normalizePriceLabel(category);
  const units = unitsByCategory[normalizedCategory] || [];
  const removeKey = normalizePriceLabel(unitToRemove).toLowerCase();

  const nextUnits = units.filter((unit) => unit.toLowerCase() !== removeKey);

  if (nextUnits.length === 0) {
    delete unitsByCategory[normalizedCategory];
  } else {
    unitsByCategory[normalizedCategory] = nextUnits;
  }

  if (Object.keys(unitsByCategory).length === 0) {
    changeMap.delete(key);
  } else {
    changeMap.set(key, unitsByCategory);
  }
}

export function normalizePriceRangeSections(projectSections, dataSections) {
  const priceInputMap = buildProjectPriceInputMap(projectSections);
  const nextSections = structuredClone(
    Array.isArray(dataSections) ? dataSections : [],
  );

  for (const section of nextSections) {
    for (const input of section.inputs || []) {
      const schemaInput = priceInputMap.get(String(input?.id));
      if (!schemaInput) continue;

      input.categories = getNormalizedCategoriesFromInput(input);
      delete input.unitsPerCategory;
    }
  }

  return nextSections;
}

export function collectRemovedCustomPriceOptionsForDataItemUpdate(
  projectSections,
  oldDataSections,
  newDataSections,
) {
  const schemaInputMap = buildProjectPriceInputMap(projectSections);
  const oldInputMap = buildDataPriceInputMap(oldDataSections);
  const newInputMap = buildDataPriceInputMap(newDataSections);

  const removedCustomCategoriesMap = new Map();
  const removedCustomUnitsMap = new Map();

  for (const [inputId, schemaInput] of schemaInputMap.entries()) {
    if (schemaInput.allowCustomCategoriesAndUnits === false) continue;

    const customCategorySet = getCustomCategorySet(schemaInput);
    const customUnitsByCategory = getCustomUnitsByCategory(schemaInput);

    const oldInput = oldInputMap.get(inputId);
    if (!oldInput) continue;

    const newInput = newInputMap.get(inputId);

    const oldCategories = getNormalizedCategoriesFromInput(oldInput);
    const newCategories = getNormalizedCategoriesFromInput(newInput);

    const oldCategoryNames = Object.keys(oldCategories);
    const newCategorySet = new Set(
      Object.keys(newCategories).map((category) => category.toLowerCase()),
    );

    const removedCustomCategories = oldCategoryNames.filter((category) => {
      const key = category.toLowerCase();
      return customCategorySet.has(key) && !newCategorySet.has(key);
    });

    addCategoriesToChangeMap(
      removedCustomCategoriesMap,
      inputId,
      removedCustomCategories,
    );

    const oldUnitsByCategory = getUnitMapFromNormalizedCategories(oldCategories);
    const newUnitsByCategory = getUnitMapFromNormalizedCategories(newCategories);

    for (const [category, oldUnits] of Object.entries(oldUnitsByCategory)) {
      const customUnits = uniqueNormalizedStrings(
        customUnitsByCategory[category],
      );
      if (customUnits.length === 0) continue;

      const customUnitSet = new Set(
        customUnits.map((unit) => unit.toLowerCase()),
      );

      const newUnits = uniqueNormalizedStrings(newUnitsByCategory[category]);
      const newUnitSet = new Set(newUnits.map((unit) => unit.toLowerCase()));

      const removedCustomUnits = oldUnits.filter((unit) => {
        const key = unit.toLowerCase();
        return customUnitSet.has(key) && !newUnitSet.has(key);
      });

      addUnitsToChangeMap(
        removedCustomUnitsMap,
        inputId,
        category,
        removedCustomUnits,
      );
    }
  }

  return {
    removedCustomCategories: formatCategoryChanges(removedCustomCategoriesMap),
    removedCustomUnits: formatUnitChanges(removedCustomUnitsMap),
  };
}

function removePriceOptionsFoundInDataItem({
  orphanedCategoriesMap,
  orphanedUnitsMap,
  dataItem,
  schemaInputMap,
}) {
  if (
    countCategoryChangeMapItems(orphanedCategoriesMap) === 0 &&
    countUnitChangeMapItems(orphanedUnitsMap) === 0
  ) {
    return;
  }

  for (const section of dataItem?.sections || []) {
    for (const input of section.inputs || []) {
      const inputId = String(input?.id || "");
      const schemaInput = schemaInputMap.get(inputId);

      if (!schemaInput) continue;

      if (schemaInput.allowCustomCategoriesAndUnits === false) {
        orphanedCategoriesMap.delete(inputId);
        orphanedUnitsMap.delete(inputId);
        continue;
      }

      const normalizedCategories = getNormalizedCategoriesFromInput(input);
      const categorySet = new Set(
        Object.keys(normalizedCategories).map((category) =>
          category.toLowerCase(),
        ),
      );

      const candidateCategories = orphanedCategoriesMap.get(inputId) || [];

      for (const category of candidateCategories) {
        if (categorySet.has(category.toLowerCase())) {
          removeCategoryFromChangeMap(
            orphanedCategoriesMap,
            inputId,
            category,
          );
        }
      }

      const candidateUnitsByCategory = orphanedUnitsMap.get(inputId) || {};
      const unitsByCategory =
        getUnitMapFromNormalizedCategories(normalizedCategories);

      for (const [category, candidateUnits] of Object.entries(
        candidateUnitsByCategory,
      )) {
        const usedUnits = uniqueNormalizedStrings(unitsByCategory[category]);
        const usedUnitSet = new Set(
          usedUnits.map((unit) => unit.toLowerCase()),
        );

        for (const unit of candidateUnits) {
          if (usedUnitSet.has(unit.toLowerCase())) {
            removeUnitFromChangeMap(
              orphanedUnitsMap,
              inputId,
              category,
              unit,
            );
          }
        }
      }
    }
  }
}

function pruneCustomPriceOptionsFromProjectSections({
  projectSections,
  orphanedCategoriesMap,
  orphanedUnitsMap,
}) {
  const nextSections = structuredClone(
    Array.isArray(projectSections) ? projectSections : [],
  );

  const priceInputMap = buildProjectPriceInputMap(nextSections);
  const removedCustomCategoriesMap = new Map();
  const removedCustomUnitsMap = new Map();

  for (const [inputId, schemaInput] of priceInputMap.entries()) {
    if (schemaInput.allowCustomCategoriesAndUnits === false) continue;

    const categoriesToRemove = orphanedCategoriesMap.get(inputId) || [];
    const categoryRemoveSet = new Set(
      uniqueNormalizedStrings(categoriesToRemove).map((category) =>
        category.toLowerCase(),
      ),
    );

    const customCategories = uniqueNormalizedStrings(
      schemaInput?.customCategoryOptions,
    );

    const nextCustomCategories = [];
    const removedCategoriesHere = [];

    for (const category of customCategories) {
      if (categoryRemoveSet.has(category.toLowerCase())) {
        removedCategoriesHere.push(category);
      } else {
        nextCustomCategories.push(category);
      }
    }

    schemaInput.customCategoryOptions = nextCustomCategories;

    if (removedCategoriesHere.length > 0) {
      removedCustomCategoriesMap.set(inputId, removedCategoriesHere);
    }

    const customUnitsByCategory = getCustomUnitsByCategory(schemaInput);
    const nextCustomUnitsByCategory = {};
    const removedUnitsByCategory = {};

    const unitsToRemoveByCategory = orphanedUnitsMap.get(inputId) || {};

    for (const [category, customUnits] of Object.entries(
      customUnitsByCategory,
    )) {
      if (categoryRemoveSet.has(category.toLowerCase())) {
        if (customUnits.length > 0) {
          removedUnitsByCategory[category] = customUnits;
        }
        continue;
      }

      const unitsToRemove = uniqueNormalizedStrings(
        unitsToRemoveByCategory[category],
      );
      const unitRemoveSet = new Set(
        unitsToRemove.map((unit) => unit.toLowerCase()),
      );

      const nextUnits = [];
      const removedUnitsHere = [];

      for (const unit of customUnits) {
        if (unitRemoveSet.has(unit.toLowerCase())) {
          removedUnitsHere.push(unit);
        } else {
          nextUnits.push(unit);
        }
      }

      if (nextUnits.length > 0) {
        nextCustomUnitsByCategory[category] = nextUnits;
      }

      if (removedUnitsHere.length > 0) {
        removedUnitsByCategory[category] = removedUnitsHere;
      }
    }

    schemaInput.customUnitOptionsByCategory = nextCustomUnitsByCategory;

    if (Object.keys(removedUnitsByCategory).length > 0) {
      removedCustomUnitsMap.set(inputId, removedUnitsByCategory);
    }
  }

  return {
    nextSections,
    removedCustomCategories: formatCategoryChanges(removedCustomCategoriesMap),
    removedCustomUnits: formatUnitChanges(removedCustomUnitsMap),
  };
}

export function removeUnusedCustomPriceOptionsAfterDataItemUpdate(
  projectSections,
  oldDataSections,
  newDataSections,
  otherDataItems,
) {
  const {
    removedCustomCategories,
    removedCustomUnits,
  } = collectRemovedCustomPriceOptionsForDataItemUpdate(
    projectSections,
    oldDataSections,
    newDataSections,
  );

  if (
    removedCustomCategories.length === 0 &&
    removedCustomUnits.length === 0
  ) {
    return {
      nextSections: structuredClone(
        Array.isArray(projectSections) ? projectSections : [],
      ),
      removedCustomCategories: [],
      removedCustomUnits: [],
    };
  }

  const orphanedCategoriesMap = new Map();
  const orphanedUnitsMap = new Map();

  for (const change of removedCustomCategories) {
    addCategoriesToChangeMap(
      orphanedCategoriesMap,
      change.inputId,
      change.categories,
    );
  }

  for (const change of removedCustomUnits) {
    for (const [category, units] of Object.entries(
      change.unitsByCategory || {},
    )) {
      addUnitsToChangeMap(
        orphanedUnitsMap,
        change.inputId,
        category,
        units,
      );
    }
  }

  const schemaInputMap = buildProjectPriceInputMap(projectSections);

  for (const dataItem of otherDataItems || []) {
    if (
      countCategoryChangeMapItems(orphanedCategoriesMap) === 0 &&
      countUnitChangeMapItems(orphanedUnitsMap) === 0
    ) {
      break;
    }

    removePriceOptionsFoundInDataItem({
      orphanedCategoriesMap,
      orphanedUnitsMap,
      dataItem,
      schemaInputMap,
    });
  }

  return pruneCustomPriceOptionsFromProjectSections({
    projectSections,
    orphanedCategoriesMap,
    orphanedUnitsMap,
  });
}

export function recomputeProjectPriceSections(projectSections, dataItems) {
  const nextSections = structuredClone(
    Array.isArray(projectSections) ? projectSections : [],
  );

  const priceInputMap = buildProjectPriceInputMap(nextSections);

  const oldCustomCategoriesByInput = new Map();
  const oldCustomUnitsByInput = new Map();

  for (const [inputId, schemaInput] of priceInputMap.entries()) {
    oldCustomCategoriesByInput.set(
      inputId,
      uniqueNormalizedStrings(schemaInput?.customCategoryOptions),
    );

    const oldUnitMap = isPlainObject(schemaInput?.customUnitOptionsByCategory)
      ? schemaInput.customUnitOptionsByCategory
      : {};

    const normalizedOldUnitMap = {};

    for (const [rawCategory, rawUnits] of Object.entries(oldUnitMap)) {
      const category = normalizePriceLabel(rawCategory);
      if (!category) continue;

      normalizedOldUnitMap[category] = uniqueNormalizedStrings(rawUnits);
    }

    oldCustomUnitsByInput.set(inputId, normalizedOldUnitMap);

    schemaInput.customCategoryOptions = [];
    schemaInput.customUnitOptionsByCategory = {};
  }

  const aggregateByInput = new Map();

  for (const [inputId, schemaInput] of priceInputMap.entries()) {
    aggregateByInput.set(inputId, {
      schemaInput,
      totalPriceItems: 0,
      categoryOrder: [],
      categorySeen: new Set(),
      unitsByCategory: {},
    });
  }

  for (const dataItem of dataItems || []) {
    for (const section of dataItem.sections || []) {
      for (const input of section.inputs || []) {
        const aggregate = aggregateByInput.get(String(input?.id));
        if (!aggregate) continue;

        const schemaInput = aggregate.schemaInput;
        const defaultCategorySet = getDefaultCategorySet(schemaInput);
        const defaultUnitsByCategory = getDefaultUnitsByCategory(schemaInput);

        const rawCategories = isPlainObject(input?.categories)
          ? input.categories
          : {};

        const normalizedCategoryEntries = [];
        const localSeenCategories = new Set();

        for (const [rawCategory, rawRows] of Object.entries(rawCategories)) {
          const category = normalizePriceLabel(rawCategory);

          if (!category) {
            throw makePriceError(
              `Invalid price category on input ${schemaInput.label || schemaInput.id}.`,
              schemaInput,
              "PRICE_RANGE_INVALID_CATEGORY",
            );
          }

          if (!Array.isArray(rawRows)) {
            throw makePriceError(
              `Price category "${category}" must contain an array of price rows.`,
              schemaInput,
              "PRICE_RANGE_CATEGORY_ROWS_INVALID",
            );
          }

          assertDefaultPriceOptionsOnly({
            schemaInput,
            category,
            unit: null,
            defaultCategorySet,
            defaultUnitsByCategory,
          });

          const categoryKey = category.toLowerCase();

          if (localSeenCategories.has(categoryKey)) {
            throw makePriceError(
              `Duplicate normalized price category "${category}" on input ${schemaInput.label || schemaInput.id}.`,
              schemaInput,
              "PRICE_RANGE_DUPLICATE_CATEGORY",
            );
          }

          localSeenCategories.add(categoryKey);
          normalizedCategoryEntries.push([category, rawRows]);
        }

        for (const [category, rows] of normalizedCategoryEntries) {
          if (rows.length === 0) {
            throw makePriceError(
              `Price category "${category}" must contain at least one price row.`,
              schemaInput,
              "PRICE_RANGE_EMPTY_CATEGORY",
            );
          }

          if (rows.length > (schemaInput.maxItemsPerCategory ?? 50)) {
            throw makePriceError(
              `Price row limit exceeded for category "${category}" on input ${schemaInput.label || schemaInput.id}.`,
              schemaInput,
              "PRICE_RANGE_MAX_ITEMS_PER_CATEGORY_EXCEEDED",
            );
          }

          if (!aggregate.categorySeen.has(category.toLowerCase())) {
            aggregate.categorySeen.add(category.toLowerCase());
            aggregate.categoryOrder.push(category);
          }

          aggregate.unitsByCategory[category] =
            aggregate.unitsByCategory[category] || [];

          const unitSeen = new Set(
            aggregate.unitsByCategory[category].map((unit) =>
              unit.toLowerCase(),
            ),
          );

          for (const row of rows) {
            if (!row || typeof row !== "object") {
              throw makePriceError(
                `Invalid price row in category "${category}" on input ${schemaInput.label || schemaInput.id}.`,
                schemaInput,
                "PRICE_RANGE_INVALID_ROW",
              );
            }

            const normalizedLabel = normalizePriceLabel(row.label);
            const normalizedUnit = normalizePriceLabel(row.unit);

            if (!normalizedLabel) {
              throw makePriceError(
                `Price rows in category "${category}" must have a label.`,
                schemaInput,
                "PRICE_RANGE_ROW_LABEL_REQUIRED",
              );
            }

            if (!normalizedUnit) {
              throw makePriceError(
                `Price rows in category "${category}" must have a unit.`,
                schemaInput,
                "PRICE_RANGE_ROW_UNIT_REQUIRED",
              );
            }

            if ((schemaInput.maxLength ?? 30) < normalizedLabel.length) {
              throw makePriceError(
                `Price label "${normalizedLabel}" exceeds maxLength for input ${schemaInput.label || schemaInput.id}.`,
                schemaInput,
                "PRICE_RANGE_LABEL_MAX_LENGTH_EXCEEDED",
              );
            }

            if ((schemaInput.maxLength ?? 30) < normalizedUnit.length) {
              throw makePriceError(
                `Price unit "${normalizedUnit}" exceeds maxLength for input ${schemaInput.label || schemaInput.id}.`,
                schemaInput,
                "PRICE_RANGE_UNIT_MAX_LENGTH_EXCEEDED",
              );
            }

            assertDefaultPriceOptionsOnly({
              schemaInput,
              category,
              unit: normalizedUnit,
              defaultCategorySet,
              defaultUnitsByCategory,
            });

            const unitKey = normalizedUnit.toLowerCase();

            if (!unitSeen.has(unitKey)) {
              unitSeen.add(unitKey);
              aggregate.unitsByCategory[category].push(normalizedUnit);
            }
          }

          aggregate.totalPriceItems += rows.length;
        }
      }
    }
  }

  const addedCustomCategoriesMap = new Map();
  const removedCustomCategoriesMap = new Map();
  const addedCustomUnitsMap = new Map();
  const removedCustomUnitsMap = new Map();

  for (const [inputId, aggregate] of aggregateByInput.entries()) {
    const schemaInput = aggregate.schemaInput;
    const defaultCategorySet = getDefaultCategorySet(schemaInput);
    const defaultUnitsByCategory = getDefaultUnitsByCategory(schemaInput);

    if (aggregate.totalPriceItems > (schemaInput.maxTotalPriceItems ?? 1000)) {
      throw makePriceError(
        `Project price item limit exceeded for input ${schemaInput.label || schemaInput.id}.`,
        schemaInput,
        "PRICE_RANGE_MAX_TOTAL_ITEMS_EXCEEDED",
      );
    }

    const mergedCategoryCount = new Set([
      ...Array.from(defaultCategorySet),
      ...aggregate.categoryOrder.map((category) => category.toLowerCase()),
    ]).size;

    if (mergedCategoryCount > (schemaInput.maxCategories ?? 20)) {
      throw makePriceError(
        `Project category limit exceeded for input ${schemaInput.label || schemaInput.id}.`,
        schemaInput,
        "PRICE_RANGE_MAX_CATEGORIES_EXCEEDED",
      );
    }

    const nextCustomCategories =
      schemaInput?.allowCustomCategoriesAndUnits === false
        ? []
        : aggregate.categoryOrder.filter(
            (category) => !defaultCategorySet.has(category.toLowerCase()),
          );

    const nextCustomUnitsByCategory = {};

    if (schemaInput?.allowCustomCategoriesAndUnits !== false) {
      for (const category of aggregate.categoryOrder) {
        const projectUnits = uniqueNormalizedStrings(
          aggregate.unitsByCategory[category],
        );

        const defaultUnits = uniqueNormalizedStrings(
          defaultUnitsByCategory[category],
        );
        const defaultUnitSet = new Set(
          defaultUnits.map((unit) => unit.toLowerCase()),
        );

        const mergedUnitsCount = new Set([
          ...defaultUnits.map((unit) => unit.toLowerCase()),
          ...projectUnits.map((unit) => unit.toLowerCase()),
        ]).size;

        if (mergedUnitsCount > (schemaInput.maxUnitsPerCategory ?? 10)) {
          throw makePriceError(
            `Project unit limit exceeded for category "${category}" on input ${schemaInput.label || schemaInput.id}.`,
            schemaInput,
            "PRICE_RANGE_MAX_UNITS_EXCEEDED",
          );
        }

        const customUnits = projectUnits.filter(
          (unit) => !defaultUnitSet.has(unit.toLowerCase()),
        );

        if (customUnits.length > 0) {
          nextCustomUnitsByCategory[category] = customUnits;
        }
      }
    } else {
      for (const category of aggregate.categoryOrder) {
        const projectUnits = uniqueNormalizedStrings(
          aggregate.unitsByCategory[category],
        );

        const defaultUnits = uniqueNormalizedStrings(
          defaultUnitsByCategory[category],
        );

        const mergedUnitsCount = new Set([
          ...defaultUnits.map((unit) => unit.toLowerCase()),
          ...projectUnits.map((unit) => unit.toLowerCase()),
        ]).size;

        if (mergedUnitsCount > (schemaInput.maxUnitsPerCategory ?? 10)) {
          throw makePriceError(
            `Project unit limit exceeded for category "${category}" on input ${schemaInput.label || schemaInput.id}.`,
            schemaInput,
            "PRICE_RANGE_MAX_UNITS_EXCEEDED",
          );
        }
      }
    }

    schemaInput.customCategoryOptions = nextCustomCategories;
    schemaInput.customUnitOptionsByCategory = nextCustomUnitsByCategory;

    const oldCustomCategories = oldCustomCategoriesByInput.get(inputId) || [];
    const oldCategorySet = new Set(
      oldCustomCategories.map((category) => category.toLowerCase()),
    );
    const nextCategorySet = new Set(
      nextCustomCategories.map((category) => category.toLowerCase()),
    );

    const addedCategories = nextCustomCategories.filter(
      (category) => !oldCategorySet.has(category.toLowerCase()),
    );
    const removedCategories = oldCustomCategories.filter(
      (category) => !nextCategorySet.has(category.toLowerCase()),
    );

    if (addedCategories.length > 0) {
      addedCustomCategoriesMap.set(inputId, addedCategories);
    }

    if (removedCategories.length > 0) {
      removedCustomCategoriesMap.set(inputId, removedCategories);
    }

    const oldCustomUnits = oldCustomUnitsByInput.get(inputId) || {};
    const unitCategoryNames = new Set([
      ...Object.keys(oldCustomUnits),
      ...Object.keys(nextCustomUnitsByCategory),
    ]);

    const addedUnitsByCategory = {};
    const removedUnitsByCategory = {};

    for (const category of unitCategoryNames) {
      const oldUnits = uniqueNormalizedStrings(oldCustomUnits[category]);
      const nextUnits = uniqueNormalizedStrings(
        nextCustomUnitsByCategory[category],
      );

      const oldSet = new Set(oldUnits.map((unit) => unit.toLowerCase()));
      const nextSet = new Set(nextUnits.map((unit) => unit.toLowerCase()));

      const addedUnits = nextUnits.filter(
        (unit) => !oldSet.has(unit.toLowerCase()),
      );
      const removedUnits = oldUnits.filter(
        (unit) => !nextSet.has(unit.toLowerCase()),
      );

      if (addedUnits.length > 0) {
        addedUnitsByCategory[category] = addedUnits;
      }

      if (removedUnits.length > 0) {
        removedUnitsByCategory[category] = removedUnits;
      }
    }

    if (Object.keys(addedUnitsByCategory).length > 0) {
      addedCustomUnitsMap.set(inputId, addedUnitsByCategory);
    }

    if (Object.keys(removedUnitsByCategory).length > 0) {
      removedCustomUnitsMap.set(inputId, removedUnitsByCategory);
    }
  }

  return {
    nextSections,
    addedCustomCategories: formatCategoryChanges(addedCustomCategoriesMap),
    removedCustomCategories: formatCategoryChanges(removedCustomCategoriesMap),
    addedCustomUnits: formatUnitChanges(addedCustomUnitsMap),
    removedCustomUnits: formatUnitChanges(removedCustomUnitsMap),
  };
}