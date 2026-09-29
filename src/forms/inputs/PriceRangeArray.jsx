import "../../styles/modals.css";
import "../../styles/panels.css";
import "./PriceRangeArray.css";

function getDraftKey(sectionIndex, inputIndex) {
  return `${sectionIndex}_${inputIndex}`;
}

function getRowDraftKey(category, rowIndex) {
  return `${category}__${rowIndex}`;
}

function normalizeTag(value) {
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

function lowerTag(value) {
  return normalizeTag(value).toLowerCase();
}

function getDraftState(sectionIndex, inputIndex, priceRangeDrafts) {
  const key = getDraftKey(sectionIndex, inputIndex);
  const draft = priceRangeDrafts?.[key];

  return {
    categorySearchText:
      typeof draft?.categorySearchText === "string"
        ? draft.categorySearchText
        : "",
    selectedCategory:
      typeof draft?.selectedCategory === "string"
        ? draft.selectedCategory
        : "",
    unitSearchTextByRowKey:
      draft?.unitSearchTextByRowKey &&
      typeof draft.unitSearchTextByRowKey === "object"
        ? draft.unitSearchTextByRowKey
        : {},
    selectedUnitByRowKey:
      draft?.selectedUnitByRowKey &&
      typeof draft.selectedUnitByRowKey === "object"
        ? draft.selectedUnitByRowKey
        : {},
  };
}

function setDraftState(
  sectionIndex,
  inputIndex,
  nextDraft,
  setPriceRangeDrafts,
) {
  const key = getDraftKey(sectionIndex, inputIndex);

  setPriceRangeDrafts((prev) => ({
    ...prev,
    [key]: nextDraft,
  }));
}

function getSchemaCategories(input) {
  const defaults = Array.isArray(input?.defaultCategoryOptions)
    ? input.defaultCategoryOptions
    : [];
  const custom = Array.isArray(input?.customCategoryOptions)
    ? input.customCategoryOptions
    : [];

  const deduped = [];
  const seen = new Set();

  for (const raw of [...defaults, ...custom]) {
    const normalized = normalizeTag(raw);
    const lowered = lowerTag(normalized);
    if (!normalized || seen.has(lowered)) continue;
    seen.add(lowered);
    deduped.push(normalized);
  }

  return deduped;
}

function getSchemaUnitsForCategory(input, category) {
  const normalizedCategory = normalizeTag(category);

  const defaultMap =
    input?.defaultPriceUnitOptionsByCategory &&
    typeof input.defaultPriceUnitOptionsByCategory === "object"
      ? input.defaultPriceUnitOptionsByCategory
      : {};

  const customMap =
    input?.customUnitOptionsByCategory &&
    typeof input.customUnitOptionsByCategory === "object"
      ? input.customUnitOptionsByCategory
      : {};

  const merged = [];
  const seen = new Set();

  for (const [rawCategory, rawUnits] of Object.entries(defaultMap)) {
    if (lowerTag(rawCategory) !== lowerTag(normalizedCategory)) continue;

    for (const rawUnit of Array.isArray(rawUnits) ? rawUnits : []) {
      const normalizedUnit = normalizeTag(rawUnit);
      const loweredUnit = lowerTag(normalizedUnit);
      if (!normalizedUnit || seen.has(loweredUnit)) continue;
      seen.add(loweredUnit);
      merged.push(normalizedUnit);
    }
  }

  for (const [rawCategory, rawUnits] of Object.entries(customMap)) {
    if (lowerTag(rawCategory) !== lowerTag(normalizedCategory)) continue;

    for (const rawUnit of Array.isArray(rawUnits) ? rawUnits : []) {
      const normalizedUnit = normalizeTag(rawUnit);
      const loweredUnit = lowerTag(normalizedUnit);
      if (!normalizedUnit || seen.has(loweredUnit)) continue;
      seen.add(loweredUnit);
      merged.push(normalizedUnit);
    }
  }

  return merged;
}

function getActiveCategories(stored) {
  const catMap =
    stored?.categories && typeof stored.categories === "object"
      ? stored.categories
      : {};

  return Object.keys(catMap).map(normalizeTag).filter(Boolean);
}

function getAvailableCategories(input, stored, searchText) {
  const schemaCategories = getSchemaCategories(input);
  const activeCategories = getActiveCategories(stored);
  const activeSet = new Set(activeCategories.map(lowerTag));
  const query = normalizeTag(searchText).toLowerCase();

  const deduped = [];
  const seen = new Set();

  for (const category of schemaCategories) {
    const lowered = lowerTag(category);
    if (!lowered || seen.has(lowered)) continue;
    seen.add(lowered);

    if (activeSet.has(lowered)) continue;
    if (query && !lowered.includes(query)) continue;

    deduped.push(category);
  }

  return deduped;
}

function resolveTypedCategoryAgainstSchema(input, typedValue) {
  const normalizedTyped = normalizeTag(typedValue);
  if (!normalizedTyped) return "";

  const schemaCategories = getSchemaCategories(input);
  const typedLower = lowerTag(normalizedTyped);

  const exactSchemaMatch = schemaCategories.find(
    (category) => lowerTag(category) === typedLower,
  );

  return exactSchemaMatch || normalizedTyped;
}

function getUsedUnitsFromRows(rows) {
  const usedUnits = [];
  const seen = new Set();

  for (const row of Array.isArray(rows) ? rows : []) {
    const normalizedUnit = normalizeTag(row?.unit);
    const lowered = lowerTag(normalizedUnit);
    if (!normalizedUnit || seen.has(lowered)) continue;
    seen.add(lowered);
    usedUnits.push(normalizedUnit);
  }

  return usedUnits;
}

function getAvailableUnitsForRow(input, stored, category, searchText) {
  const schemaUnits = getSchemaUnitsForCategory(input, category);

  const rows = Array.isArray(stored?.categories?.[category])
    ? stored.categories[category]
    : [];

  const dataUnits = getUsedUnitsFromRows(rows);
  const query = normalizeTag(searchText).toLowerCase();

  const deduped = [];
  const seen = new Set();

  for (const unit of [...schemaUnits, ...dataUnits]) {
    const lowered = lowerTag(unit);
    if (!lowered || seen.has(lowered)) continue;
    seen.add(lowered);

    if (query && !lowered.includes(query)) continue;
    deduped.push(unit);
  }

  return deduped;
}

function resolveTypedUnitAgainstSchema(input, category, typedValue) {
  const normalizedTyped = normalizeTag(typedValue);
  if (!normalizedTyped) return "";

  const schemaUnits = getSchemaUnitsForCategory(input, category);
  const typedLower = lowerTag(normalizedTyped);

  const exactSchemaMatch = schemaUnits.find(
    (unit) => lowerTag(unit) === typedLower,
  );

  return exactSchemaMatch || normalizedTyped;
}

function getTotalPriceItems(catMap) {
  return Object.values(catMap).reduce((sum, rows) => {
    return sum + (Array.isArray(rows) ? rows.length : 0);
  }, 0);
}

function clampMoneyStr(
  raw,
  {
    minValue = "0.00",
    maxValue = "100000.00",
    maxLen = 30,
    decimals = 2,
    finalize = false,
    finalValue = 0,
  } = {},
) {
  if (raw == null || raw === "") {
    return finalize ? finalValue : "";
  }

  let s = String(raw).replace(/[^\d.]/g, "");

  const dotIndex = s.indexOf(".");
  if (dotIndex !== -1) {
    s = s.slice(0, dotIndex + 1) + s.slice(dotIndex + 1).replace(/\./g, "");
  }

  if (s.length > 1 && !s.startsWith("0.")) {
    s = s.replace(/^0+/, "");
  }

  if (dotIndex !== -1) {
    const [a, b = ""] = s.split(".");
    s = `${a}.${b.slice(0, decimals)}`;
  }

  if (s.length > maxLen) {
    s = s.slice(0, maxLen);
  }

  if (!finalize && s === "") {
    return "";
  }

  if (s === ".") {
    return finalize ? minValue : "0.";
  }

  if (!finalize && (s.endsWith(".") || /\.(\d*0)$/.test(s))) {
    return s;
  }

  const n = Number(s);
  if (!Number.isFinite(n)) {
    return finalize ? finalValue : "";
  }

  const minN = Number(minValue);
  const maxN = Number(maxValue);
  const clamped = Math.max(minN, Math.min(maxN, n));

  if (!finalize) {
    if (n < minN) return Number(minValue).toFixed(decimals);
    if (n > maxN) return Number(maxValue).toFixed(decimals);
    return String(clamped);
  }

  return clamped.toFixed(decimals);
}

function enforceMoneyMinMaxOrder(row, changedField) {
  const min = row.min;
  const max = row.max;

  if (min == null || max == null) return row;

  const nMin = Number(min);
  const nMax = Number(max);

  if (!Number.isFinite(nMin) || !Number.isFinite(nMax)) return row;

  if (changedField === "min" && nMin > nMax) {
    return { ...row, min: max };
  }

  if (changedField === "max" && nMax < nMin) {
    return { ...row, max: min };
  }

  return row;
}

export function renderPriceRangeArrayInput({
  input,
  stored,
  inputIndex,
  sectionIndex,
  setFormData,
  priceRangeDrafts,
  setPriceRangeDrafts,
}) {
  const {
    categorySearchText,
    selectedCategory,
    unitSearchTextByRowKey,
    selectedUnitByRowKey,
  } = getDraftState(sectionIndex, inputIndex, priceRangeDrafts);

  const modes = Array.isArray(input?.priceModeOptions)
    ? input.priceModeOptions
    : ["Free", "Fixed Price", "Min-Max Range", "Min Only", "Max Only"];

  const allowCustom = input?.allowCustomCategoriesAndUnits !== false;

  const catMap =
    stored?.categories && typeof stored.categories === "object"
      ? stored.categories
      : {};

  const activeCategories = Object.keys(catMap);
  const availableCategories = getAvailableCategories(
    input,
    stored,
    categorySearchText,
  );

  const resolvedSelectedCategory = availableCategories.includes(selectedCategory)
    ? selectedCategory
    : availableCategories[0] || "";

  const minValue =
    typeof input.minValue === "string" ? input.minValue : "0.00";
  const maxValue =
    typeof input.maxValue === "string" ? input.maxValue : "100000.00";
  const maxLen =
    typeof input.maxLength === "number" ? input.maxLength : 30;

  const maxCategories =
    typeof input.maxCategories === "number" ? input.maxCategories : 20;
  const maxItemsPerCategory =
    typeof input.maxItemsPerCategory === "number"
      ? input.maxItemsPerCategory
      : 50;
  const maxTotalPriceItems =
    typeof input.maxTotalPriceItems === "number"
      ? input.maxTotalPriceItems
      : 1000;
  const maxUnitsPerCategory =
    typeof input.maxUnitsPerCategory === "number"
      ? input.maxUnitsPerCategory
      : 10;

  function updateCategorySearchText(value) {
    const nextSearchText = value;
    const nextOptions = getAvailableCategories(input, stored, nextSearchText);

    setDraftState(
      sectionIndex,
      inputIndex,
      {
        categorySearchText: nextSearchText,
        selectedCategory: nextOptions[0] || "",
        unitSearchTextByRowKey,
        selectedUnitByRowKey,
      },
      setPriceRangeDrafts,
    );
  }

  function updateSelectedCategory(value) {
    setDraftState(
      sectionIndex,
      inputIndex,
      {
        categorySearchText,
        selectedCategory: value,
        unitSearchTextByRowKey,
        selectedUnitByRowKey,
      },
      setPriceRangeDrafts,
    );
  }

  function addCategory(nextCategoryRaw) {
    if (activeCategories.length >= maxCategories) return;

    const normalizedCategory = allowCustom
      ? resolveTypedCategoryAgainstSchema(input, nextCategoryRaw)
      : normalizeTag(nextCategoryRaw);

    if (!normalizedCategory) return;

    if (!allowCustom) {
      const schemaCategories = getSchemaCategories(input);
      if (
        !schemaCategories.some(
          (category) => lowerTag(category) === lowerTag(normalizedCategory),
        )
      ) {
        return;
      }
    }

    const alreadyExists = activeCategories.some(
      (category) => lowerTag(category) === lowerTag(normalizedCategory),
    );

    if (alreadyExists) {
      setDraftState(
        sectionIndex,
        inputIndex,
        {
          categorySearchText: "",
          selectedCategory: resolvedSelectedCategory,
          unitSearchTextByRowKey,
          selectedUnitByRowKey,
        },
        setPriceRangeDrafts,
      );
      return;
    }

    if (getTotalPriceItems(catMap) >= maxTotalPriceItems) return;

    const schemaUnits = getSchemaUnitsForCategory(input, normalizedCategory);
    const firstUnit = schemaUnits[0] || "";
    const firstMode = modes[0] || "Free";

    setFormData((prev) => {
      const next = structuredClone(prev);
      const slot = next.sections[sectionIndex].inputs[inputIndex];

      if (!slot.categories || typeof slot.categories !== "object") {
        slot.categories = {};
      }

      const initialRows = [
        {
          label: "",
          unit: firstUnit,
          priceMode: firstMode,
          min:
            firstMode === "Min Only" || firstMode === "Min-Max Range"
              ? minValue
              : null,
          max:
            firstMode === "Max Only" || firstMode === "Min-Max Range"
              ? maxValue
              : null,
          fixedPrice: firstMode === "Fixed Price" ? minValue : null,
        },
      ];

      slot.categories[normalizedCategory] = initialRows;

      return next;
    });

    const nextStored = {
      ...stored,
      categories: {
        ...(stored?.categories || {}),
        [normalizedCategory]: [
          {
            label: "",
            unit: firstUnit,
            priceMode: firstMode,
            min:
              firstMode === "Min Only" || firstMode === "Min-Max Range"
                ? minValue
                : null,
            max:
              firstMode === "Max Only" || firstMode === "Min-Max Range"
                ? maxValue
                : null,
            fixedPrice: firstMode === "Fixed Price" ? minValue : null,
          },
        ],
      },
    };

    const nextOptions = getAvailableCategories(input, nextStored, "");

    setDraftState(
      sectionIndex,
      inputIndex,
      {
        categorySearchText: "",
        selectedCategory: nextOptions[0] || "",
        unitSearchTextByRowKey,
        selectedUnitByRowKey,
      },
      setPriceRangeDrafts,
    );
  }

  function addTypedCategory() {
    if (!allowCustom) return;
    addCategory(categorySearchText);
  }

  function addSelectedCategory() {
    addCategory(resolvedSelectedCategory);
  }

  function addRow(category) {
    const existingRows = Array.isArray(catMap[category]) ? catMap[category] : [];
    if (existingRows.length >= maxItemsPerCategory) return;
    if (getTotalPriceItems(catMap) >= maxTotalPriceItems) return;

    setFormData((prev) => {
      const next = structuredClone(prev);
      const slot = next.sections[sectionIndex].inputs[inputIndex];

      if (!slot.categories || typeof slot.categories !== "object") {
        slot.categories = {};
      }

      const arr = Array.isArray(slot.categories[category])
        ? [...slot.categories[category]]
        : [];

      const categoryUnits = getUsedUnitsFromRows(arr);
      const schemaUnits = getSchemaUnitsForCategory(input, category);
      const mergedUnits = [];
      const seen = new Set();

      for (const unit of [...categoryUnits, ...schemaUnits]) {
        const normalized = normalizeTag(unit);
        const lowered = lowerTag(normalized);
        if (!normalized || seen.has(lowered)) continue;
        seen.add(lowered);
        mergedUnits.push(normalized);
      }

      const defaultUnit = mergedUnits[0] || "";
      const defaultMode = modes[0] || "Free";

      arr.push({
        label: "",
        unit: defaultUnit,
        priceMode: defaultMode,
        min:
          defaultMode === "Min Only" || defaultMode === "Min-Max Range"
            ? minValue
            : null,
        max:
          defaultMode === "Max Only" || defaultMode === "Min-Max Range"
            ? maxValue
            : null,
        fixedPrice: defaultMode === "Fixed Price" ? minValue : null,
      });

      slot.categories[category] = arr;

      return next;
    });
  }

  function deleteRow(category, rowIndex) {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const slot = next.sections[sectionIndex].inputs[inputIndex];

      const nextCategories = { ...(slot.categories || {}) };

      const arr = Array.isArray(nextCategories[category])
        ? [...nextCategories[category]]
        : [];

      arr.splice(rowIndex, 1);

      if (arr.length === 0) {
        delete nextCategories[category];
      } else {
        nextCategories[category] = arr;
      }

      slot.categories = nextCategories;

      return next;
    });

    const nextUnitSearchTextByRowKey = { ...unitSearchTextByRowKey };
    const nextSelectedUnitByRowKey = { ...selectedUnitByRowKey };

    delete nextUnitSearchTextByRowKey[getRowDraftKey(category, rowIndex)];
    delete nextSelectedUnitByRowKey[getRowDraftKey(category, rowIndex)];

    setDraftState(
      sectionIndex,
      inputIndex,
      {
        categorySearchText,
        selectedCategory: resolvedSelectedCategory,
        unitSearchTextByRowKey: nextUnitSearchTextByRowKey,
        selectedUnitByRowKey: nextSelectedUnitByRowKey,
      },
      setPriceRangeDrafts,
    );
  }

  function updateRow(category, rowIndex, patch) {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const slot = next.sections[sectionIndex].inputs[inputIndex];

      const nextCategories = { ...(slot.categories || {}) };
      const arr = Array.isArray(nextCategories[category])
        ? [...nextCategories[category]]
        : [];

      const row = { ...(arr[rowIndex] || {}) };
      arr[rowIndex] = { ...row, ...patch };

      nextCategories[category] = arr;
      slot.categories = nextCategories;

      return next;
    });
  }

  function updateUnitSearchText(category, rowIndex, value) {
    const rowKey = getRowDraftKey(category, rowIndex);

    const nextSearchTextByRowKey = {
      ...unitSearchTextByRowKey,
      [rowKey]: value,
    };

    const nextOptions = getAvailableUnitsForRow(
      input,
      stored,
      category,
      value,
    );

    setDraftState(
      sectionIndex,
      inputIndex,
      {
        categorySearchText,
        selectedCategory: resolvedSelectedCategory,
        unitSearchTextByRowKey: nextSearchTextByRowKey,
        selectedUnitByRowKey: {
          ...selectedUnitByRowKey,
          [rowKey]: nextOptions[0] || "",
        },
      },
      setPriceRangeDrafts,
    );
  }

  function updateSelectedUnit(category, rowIndex, value) {
    const rowKey = getRowDraftKey(category, rowIndex);

    setDraftState(
      sectionIndex,
      inputIndex,
      {
        categorySearchText,
        selectedCategory: resolvedSelectedCategory,
        unitSearchTextByRowKey,
        selectedUnitByRowKey: {
          ...selectedUnitByRowKey,
          [rowKey]: value,
        },
      },
      setPriceRangeDrafts,
    );
  }

  function addUnitToRow(category, rowIndex, nextUnitRaw) {
    const normalizedUnit = allowCustom
      ? resolveTypedUnitAgainstSchema(input, category, nextUnitRaw)
      : normalizeTag(nextUnitRaw);

    if (!normalizedUnit) return;

    if (!allowCustom) {
      const schemaUnits = getSchemaUnitsForCategory(input, category);
      if (
        !schemaUnits.some((unit) => lowerTag(unit) === lowerTag(normalizedUnit))
      ) {
        return;
      }
    }

    const rowKey = getRowDraftKey(category, rowIndex);

    setFormData((prev) => {
      const next = structuredClone(prev);
      const slot = next.sections[sectionIndex].inputs[inputIndex];

      const nextCategories = { ...(slot.categories || {}) };
      const arr = Array.isArray(nextCategories[category])
        ? [...nextCategories[category]]
        : [];

      const row = { ...(arr[rowIndex] || {}) };
      row.unit = normalizedUnit;
      arr[rowIndex] = row;

      const recomputedUnits = getUsedUnitsFromRows(arr);
      if (recomputedUnits.length > maxUnitsPerCategory) {
        return prev;
      }

      nextCategories[category] = arr;
      slot.categories = nextCategories;

      return next;
    });

    const nextOptions = getAvailableUnitsForRow(
      input,
      {
        ...stored,
        categories: {
          ...(stored?.categories || {}),
          [category]: Array.isArray(catMap[category])
            ? catMap[category].map((row, idx) =>
                idx === rowIndex ? { ...row, unit: normalizedUnit } : row,
              )
            : [],
        },
      },
      category,
      "",
    );

    setDraftState(
      sectionIndex,
      inputIndex,
      {
        categorySearchText,
        selectedCategory: resolvedSelectedCategory,
        unitSearchTextByRowKey: {
          ...unitSearchTextByRowKey,
          [rowKey]: "",
        },
        selectedUnitByRowKey: {
          ...selectedUnitByRowKey,
          [rowKey]: nextOptions[0] || "",
        },
      },
      setPriceRangeDrafts,
    );
  }

  function addTypedUnitToRow(category, rowIndex) {
    if (!allowCustom) return;
    addUnitToRow(
      category,
      rowIndex,
      unitSearchTextByRowKey[getRowDraftKey(category, rowIndex)] || "",
    );
  }

  function addSelectedUnitToRow(category, rowIndex) {
    const rowKey = getRowDraftKey(category, rowIndex);
    const searchText = unitSearchTextByRowKey[rowKey] || "";
    const availableUnits = getAvailableUnitsForRow(
      input,
      stored,
      category,
      searchText,
    );

    const resolvedSelectedUnit = availableUnits.includes(
      selectedUnitByRowKey[rowKey],
    )
      ? selectedUnitByRowKey[rowKey]
      : availableUnits[0] || "";

    addUnitToRow(category, rowIndex, resolvedSelectedUnit);
  }

  function onChangeMoney(category, rowIndex, raw, which) {
    updateRow(category, rowIndex, {
      [which]: clampMoneyStr(raw, {
        minValue,
        maxValue,
        maxLen,
        decimals: 2,
        finalize: false,
      }),
    });
  }

  function onBlurMoney(category, rowIndex, which) {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const slot = next.sections[sectionIndex].inputs[inputIndex];
      const nextCats = { ...(slot.categories || {}) };
      const arr = Array.isArray(nextCats[category]) ? [...nextCats[category]] : [];
      const row = { ...(arr[rowIndex] || {}) };

      row[which] = clampMoneyStr(row[which], {
        minValue,
        maxValue,
        maxLen,
        decimals: 2,
        finalize: true,
        finalValue: which === "max" ? maxValue : minValue,
      });

      arr[rowIndex] = enforceMoneyMinMaxOrder(row, which);
      nextCats[category] = arr;
      slot.categories = nextCats;

      return next;
    });
  }

  const canAddTypedCategory =
    allowCustom && normalizeTag(categorySearchText) !== "";
  const canAddSelectedCategory =
    !!resolvedSelectedCategory && activeCategories.length < maxCategories;

  return (
    <div
      key={input.id}
      className="price-range-form-group"
      role="group"
      aria-labelledby={`input-${input.id}-label`}
    >
      <h4 id={`input-${input.id}-label`}>{input.label}</h4>

      <div className="price-range-category-controls">
        <label
          className="price-range-label"
          htmlFor={`input-${input.id}-category-input`}
        >
          Categories:
        </label>

        <div className="tag-list-input-row">
          <input
            className="value-container"
            id={`input-${input.id}-category-input`}
            type="text"
            value={categorySearchText}
            maxLength={maxLen}
            onChange={(e) => updateCategorySearchText(e.target.value)}
            placeholder={
              allowCustom ? "Type or filter categories..." : "Filter categories..."
            }
          />

          {allowCustom && (
            <button
              type="button"
              className="price-range-action-button price-range-add-button"
              onClick={addTypedCategory}
              disabled={!canAddTypedCategory}
              aria-label={`Add typed category to ${input.label}`}
            >
              +
            </button>
          )}
        </div>

        <div className="tag-list-select-row">
          <select
            className="value-container tag-list-select"
            value={resolvedSelectedCategory}
            onChange={(e) => updateSelectedCategory(e.target.value)}
            disabled={availableCategories.length === 0}
          >
            {availableCategories.length === 0 ? (
              <option value="">No matches</option>
            ) : (
              availableCategories.map((category, idx) => (
                <option key={`${input.id}-cat-${idx}`} value={category}>
                  {category}
                </option>
              ))
            )}
          </select>

          <button
            type="button"
            className="price-range-action-button price-range-add-button"
            onClick={addSelectedCategory}
            disabled={!canAddSelectedCategory}
            aria-label={`Add selected category to ${input.label}`}
          >
            +
          </button>
        </div>
      </div>

      {activeCategories.map((category) => {
        const rows = Array.isArray(catMap[category]) ? catMap[category] : [];
        if (!rows.length) return null;

        return (
          <div
            key={`${input.id}-${category}`}
            className="price-range-category-block"
          >
            <h5 className="price-range-category-title">{category}</h5>

            {rows.map((row, rowIndex) => {
              const rowKey = getRowDraftKey(category, rowIndex);
              const rowMode = row?.priceMode || modes[0] || "Free";
              const showFixed = rowMode === "Fixed Price";
              const showMin =
                rowMode === "Min Only" || rowMode === "Min-Max Range";
              const showMax =
                rowMode === "Max Only" || rowMode === "Min-Max Range";

              const labelVal = row?.label ?? "";
              const unitVal = row?.unit ?? "";
              const fixedVal = row?.fixedPrice ?? "";
              const minVal = row?.min ?? "";
              const maxVal = row?.max ?? "";
              const unitSearchText = unitSearchTextByRowKey[rowKey] || "";

              const availableUnits = getAvailableUnitsForRow(
                input,
                stored,
                category,
                unitSearchText,
              );

              const resolvedUnitValue =
                unitVal ||
                resolvedSelectedUnitByRowKeyFallback(
                  availableUnits,
                  selectedUnitByRowKey[rowKey],
                );

              const canAddTypedUnit =
                allowCustom && normalizeTag(unitSearchText) !== "";
              const canAddSelectedUnit = !!resolvedUnitValue;

              return (
                <div
                  key={`${category}-${rowIndex}`}
                  className="price-range-row-card"
                >
                  <label
                    className="price-range-label"
                    htmlFor={`input-${input.id}-${category}-${rowIndex}-label`}
                  >
                    Label:
                  </label>
                  <input
                    id={`input-${input.id}-${category}-${rowIndex}-label`}
                    className="value-container"
                    type="text"
                    value={labelVal}
                    maxLength={maxLen}
                    onChange={(e) =>
                      updateRow(category, rowIndex, {
                        label: e.target.value,
                      })
                    }
                  />

                  <label
                    className="price-range-label"
                    htmlFor={`input-${input.id}-${category}-${rowIndex}-mode`}
                  >
                    Mode:
                  </label>
                  <select
                    id={`input-${input.id}-${category}-${rowIndex}-mode`}
                    className="value-container"
                    value={rowMode}
                    onChange={(e) => {
                      const newMode = e.target.value;

                      const patch = { priceMode: newMode };

                      if (newMode === "Free") {
                        patch.min = null;
                        patch.max = null;
                        patch.fixedPrice = null;
                      } else if (newMode === "Fixed Price") {
                        patch.min = null;
                        patch.max = null;
                        patch.fixedPrice = minValue;
                      } else if (newMode === "Min Only") {
                        patch.min = minValue;
                        patch.max = null;
                        patch.fixedPrice = null;
                      } else if (newMode === "Max Only") {
                        patch.min = null;
                        patch.max = maxValue;
                        patch.fixedPrice = null;
                      } else if (newMode === "Min-Max Range") {
                        patch.min = minValue;
                        patch.max = maxValue;
                        patch.fixedPrice = null;
                      }

                      updateRow(category, rowIndex, patch);
                    }}
                  >
                    {modes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>

                  {showFixed && (
                    <>
                      <label
                        className="price-range-label"
                        htmlFor={`input-${input.id}-${category}-${rowIndex}-fixed`}
                      >
                        Price:
                      </label>
                      <input
                        id={`input-${input.id}-${category}-${rowIndex}-fixed`}
                        className="value-container"
                        type="text"
                        inputMode="decimal"
                        value={fixedVal}
                        onChange={(e) =>
                          onChangeMoney(
                            category,
                            rowIndex,
                            e.target.value,
                            "fixedPrice",
                          )
                        }
                        onBlur={() =>
                          onBlurMoney(category, rowIndex, "fixedPrice")
                        }
                        placeholder={minValue}
                      />
                    </>
                  )}

                  {(showMin || showMax) && (
                    <div className="price-range-row">
                      {showMin && (
                        <div className="price-range-field">
                          <label
                            className="price-range-label"
                            htmlFor={`input-${input.id}-${category}-${rowIndex}-min`}
                          >
                            Min:
                          </label>
                          <input
                            id={`input-${input.id}-${category}-${rowIndex}-min`}
                            className="value-container"
                            type="text"
                            inputMode="decimal"
                            value={minVal}
                            onChange={(e) =>
                              onChangeMoney(
                                category,
                                rowIndex,
                                e.target.value,
                                "min",
                              )
                            }
                            onBlur={() =>
                              onBlurMoney(category, rowIndex, "min")
                            }
                            placeholder={minValue}
                          />
                        </div>
                      )}

                      {showMax && (
                        <div className="price-range-field">
                          <label
                            className="price-range-label"
                            htmlFor={`input-${input.id}-${category}-${rowIndex}-max`}
                          >
                            Max:
                          </label>
                          <input
                            id={`input-${input.id}-${category}-${rowIndex}-max`}
                            className="value-container"
                            type="text"
                            inputMode="decimal"
                            value={maxVal}
                            onChange={(e) =>
                              onChangeMoney(
                                category,
                                rowIndex,
                                e.target.value,
                                "max",
                              )
                            }
                            onBlur={() =>
                              onBlurMoney(category, rowIndex, "max")
                            }
                            placeholder={maxValue}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <label
                    className="price-range-label"
                    htmlFor={`input-${input.id}-${category}-${rowIndex}-unit-search`}
                  >
                    Unit:
                  </label>

                  <div className="tag-list-input-row">
                    <input
                      id={`input-${input.id}-${category}-${rowIndex}-unit-search`}
                      className="value-container"
                      type="text"
                      value={unitSearchText}
                      maxLength={maxLen}
                      onChange={(e) =>
                        updateUnitSearchText(category, rowIndex, e.target.value)
                      }
                      placeholder={allowCustom ? "Type or filter units..." : "Filter units..."}
                    />

                    {allowCustom && (
                      <button
                        type="button"
                        className="price-range-action-button price-range-add-button"
                        onClick={() => addTypedUnitToRow(category, rowIndex)}
                        disabled={!canAddTypedUnit}
                        aria-label={`Add typed unit to ${category} row`}
                      >
                        +
                      </button>
                    )}
                  </div>

                  <div className="tag-list-select-row">
                    <select
                      className="value-container tag-list-select"
                      value={resolvedUnitValue}
                      onChange={(e) =>
                        updateRow(category, rowIndex, { unit: e.target.value })
                      }
                      disabled={availableUnits.length === 0}
                    >
                      {availableUnits.length === 0 ? (
                        <option value="">No matches</option>
                      ) : (
                        availableUnits.map((unit, idx) => (
                          <option key={`${rowKey}-${idx}`} value={unit}>
                            {unit}
                          </option>
                        ))
                      )}
                    </select>

                    {allowCustom && (
                      <button
                        type="button"
                        className="price-range-action-button price-range-add-button"
                        onClick={() => addSelectedUnitToRow(category, rowIndex)}
                        disabled={!canAddSelectedUnit}
                        aria-label={`Add selected unit to ${category} row`}
                      >
                        +
                      </button>
                    )}
                  </div>

                  <div className="buttons-container-two">
                    <button
                      type="button"
                      onClick={() => deleteRow(category, rowIndex)}
                      aria-label="Delete"
                      className="form-delete-button"
                    >
                      −
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="buttons-container-two">
              <button
                type="button"
                onClick={() => addRow(category)}
                aria-label="Add"
                className="form-add-button"
                disabled={
                  rows.length >= maxItemsPerCategory ||
                  getTotalPriceItems(catMap) >= maxTotalPriceItems
                }
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function resolvedSelectedUnitByRowKeyFallback(availableUnits, selectedValue) {
  return availableUnits.includes(selectedValue)
    ? selectedValue
    : availableUnits[0] || "";
}

export default renderPriceRangeArrayInput;