import "./PriceRangeArray.css";

function parseNum(raw) {
  if (raw === "" || raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function getDraftKey(schemaInputId) {
  return String(schemaInputId);
}

function getCategoryDraftKey(category) {
  return String(category);
}

function getDraftState(schemaInputId, priceRangeFilterDrafts) {
  const key = getDraftKey(schemaInputId);
  const draft = priceRangeFilterDrafts?.[key];

  return {
    key,
    categorySearchText:
      typeof draft?.categorySearchText === "string"
        ? draft.categorySearchText
        : "",
    selectedCategory:
      typeof draft?.selectedCategory === "string"
        ? draft.selectedCategory
        : "",
    unitSearchTextByCategory:
      draft?.unitSearchTextByCategory &&
      typeof draft.unitSearchTextByCategory === "object"
        ? draft.unitSearchTextByCategory
        : {},
  };
}

function setDraftState(schemaInputId, nextDraft, setPriceRangeFilterDrafts) {
  const key = getDraftKey(schemaInputId);

  setPriceRangeFilterDrafts((prev) => ({
    ...prev,
    [key]: nextDraft,
  }));
}

function normalizeTag(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function lowerTag(value) {
  return normalizeTag(value).toLowerCase();
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

function buildDefaultCategory(schemaMin, schemaMax) {
  return {
    unit: "Any Unit",
    mode: "Any Price",
    min: schemaMin,
    max: schemaMax,
  };
}

function getModeOptions() {
  return ["Any Price", "Free", "Budget Range", "Minimum Budget", "Maximum Budget"];
}

function shouldShowMin(mode) {
  return mode === "Minimum Budget" || mode === "Budget Range";
}

function shouldShowMax(mode) {
  return mode === "Maximum Budget" || mode === "Budget Range";
}

function hasNumeric(mode) {
  return (
    mode === "Budget Range" ||
    mode === "Minimum Budget" ||
    mode === "Maximum Budget"
  );
}

function getSchemaCategories(schemaInput) {
  const defaults = Array.isArray(schemaInput?.defaultCategoryOptions)
    ? schemaInput.defaultCategoryOptions
    : [];
  const custom = Array.isArray(schemaInput?.customCategoryOptions)
    ? schemaInput.customCategoryOptions
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

function getSchemaUnitsForCategory(schemaInput, category) {
  const normalizedCategory = normalizeTag(category);

  const defaultMap =
    schemaInput?.defaultPriceUnitOptionsByCategory &&
    typeof schemaInput.defaultPriceUnitOptionsByCategory === "object"
      ? schemaInput.defaultPriceUnitOptionsByCategory
      : {};

  const customMap =
    schemaInput?.customUnitOptionsByCategory &&
    typeof schemaInput.customUnitOptionsByCategory === "object"
      ? schemaInput.customUnitOptionsByCategory
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

function getSelectedCategories(filterValue) {
  const categories =
    filterValue?.categories && typeof filterValue.categories === "object"
      ? filterValue.categories
      : {};

  return Object.keys(categories)
    .map(normalizeTag)
    .filter(Boolean);
}

function getAvailableCategories(schemaInput, filterValue, searchText) {
  const schemaCategories = getSchemaCategories(schemaInput);
  const selectedCategories = getSelectedCategories(filterValue);
  const selectedSet = new Set(selectedCategories.map(lowerTag));
  const query = normalizeTag(searchText).toLowerCase();

  const deduped = [];
  const seen = new Set();

  for (const category of schemaCategories) {
    const lowered = lowerTag(category);
    if (!lowered || seen.has(lowered)) continue;
    seen.add(lowered);

    if (selectedSet.has(lowered)) continue;
    if (query && !lowered.includes(query)) continue;

    deduped.push(category);
  }

  return deduped;
}

function getAvailableUnits(schemaInput, category, searchText) {
  const schemaUnits = getSchemaUnitsForCategory(schemaInput, category);
  const query = normalizeTag(searchText).toLowerCase();

  return schemaUnits.filter((unit) => {
    const lowered = lowerTag(unit);
    if (!lowered) return false;
    if (query && !lowered.includes(query)) return false;
    return true;
  });
}

export function renderPriceRangeArrayFilter(
  schemaInput,
  filterValue,
  setFilterValue,
  priceRangeFilterDrafts,
  setPriceRangeFilterDrafts,
) {
  const { categorySearchText, selectedCategory, unitSearchTextByCategory } =
    getDraftState(schemaInput.id, priceRangeFilterDrafts);

  const schemaMin =
    typeof schemaInput.minValue === "string" ? schemaInput.minValue : "0.00";

  const schemaMax =
    typeof schemaInput.maxValue === "string"
      ? schemaInput.maxValue
      : "100000.00";

  const maxLen =
    typeof schemaInput.maxLength === "number" ? schemaInput.maxLength : 30;

  const value =
    filterValue && typeof filterValue === "object"
      ? filterValue
      : { categories: {} };

  const categories =
    value.categories && typeof value.categories === "object"
      ? value.categories
      : {};

  const availableCategories = getAvailableCategories(
    schemaInput,
    value,
    categorySearchText,
  );

  const resolvedSelectedCategory = availableCategories.includes(selectedCategory)
    ? selectedCategory
    : availableCategories[0] || "";

  const defaultCat = buildDefaultCategory(schemaMin, schemaMax);
  const modeOptions = getModeOptions();

  function updateCategorySearchText(nextSearchText) {
    const nextOptions = getAvailableCategories(
      schemaInput,
      value,
      nextSearchText,
    );

    setDraftState(
      schemaInput.id,
      {
        categorySearchText: nextSearchText,
        selectedCategory: nextOptions[0] || "",
        unitSearchTextByCategory,
      },
      setPriceRangeFilterDrafts,
    );
  }

  function updateSelectedCategory(nextSelectedCategory) {
    setDraftState(
      schemaInput.id,
      {
        categorySearchText,
        selectedCategory: nextSelectedCategory,
        unitSearchTextByCategory,
      },
      setPriceRangeFilterDrafts,
    );
  }

  function addCategoryFilter() {
    const nextCategory = normalizeTag(resolvedSelectedCategory);
    if (!nextCategory) return;

    const nextCategories = {
      ...categories,
      [nextCategory]: { ...defaultCat },
    };

    setFilterValue({
      ...value,
      categories: nextCategories,
    });

    const nextValue = { ...value, categories: nextCategories };
    const nextOptions = getAvailableCategories(schemaInput, nextValue, "");

    setDraftState(
      schemaInput.id,
      {
        categorySearchText: "",
        selectedCategory: nextOptions[0] || "",
        unitSearchTextByCategory,
      },
      setPriceRangeFilterDrafts,
    );
  }

  function removeCategoryFilter(categoryToRemove) {
    const nextCategories = { ...categories };
    delete nextCategories[categoryToRemove];

    const nextUnitDrafts = { ...unitSearchTextByCategory };
    delete nextUnitDrafts[getCategoryDraftKey(categoryToRemove)];

    const nextValue = {
      ...value,
      categories: nextCategories,
    };

    setFilterValue(nextValue);

    const nextOptions = getAvailableCategories(
      schemaInput,
      nextValue,
      categorySearchText,
    );

    setDraftState(
      schemaInput.id,
      {
        categorySearchText,
        selectedCategory: nextOptions.includes(resolvedSelectedCategory)
          ? resolvedSelectedCategory
          : nextOptions[0] || "",
        unitSearchTextByCategory: nextUnitDrafts,
      },
      setPriceRangeFilterDrafts,
    );
  }

  function setCatField(cat, field, v) {
    const prevCat = categories[cat] || defaultCat;
    const nextCat = { ...prevCat, [field]: v };

    if (field === "mode") {
      const m = String(v || "Any Price");
      nextCat.min = schemaMin;
      nextCat.max = schemaMax;
      nextCat.mode = m;
    }

    setFilterValue({
      ...value,
      categories: { ...categories, [cat]: nextCat },
    });
  }

  function updateUnitSearchText(category, nextSearchText) {
    setDraftState(
      schemaInput.id,
      {
        categorySearchText,
        selectedCategory: resolvedSelectedCategory,
        unitSearchTextByCategory: {
          ...unitSearchTextByCategory,
          [getCategoryDraftKey(category)]: nextSearchText,
        },
      },
      setPriceRangeFilterDrafts,
    );
  }

  const canAddCategory = !!resolvedSelectedCategory;
  const selectedCategoryEntries = Object.entries(categories);

  return (
    <div
      key={schemaInput.id}
      className="price-range-filter-form-group"
      role="group"
      aria-labelledby={`filter-${schemaInput.id}-label`}
    >
      <h4 id={`filter-${schemaInput.id}-label`}>{schemaInput.label}</h4>

      <label
        className="label-container"
        htmlFor={`filter-${schemaInput.id}-category-search`}
      >
        Categories:
      </label>

      <div className="price-range-filter-search-row">
        <input
          id={`filter-${schemaInput.id}-category-search`}
          type="text"
          className="value-container"
          value={categorySearchText}
          onChange={(e) => updateCategorySearchText(e.target.value)}
          placeholder="Type to filter categories..."
        />
      </div>

      <div className="price-range-filter-select-row">
        <select
          id={`filter-${schemaInput.id}-category-select`}
          className="value-container price-range-filter-select"
          value={resolvedSelectedCategory}
          onChange={(e) => updateSelectedCategory(e.target.value)}
          disabled={availableCategories.length === 0}
        >
          {availableCategories.length === 0 ? (
            <option value="">No matches</option>
          ) : (
            availableCategories.map((option, idx) => (
              <option key={`${schemaInput.id}-cat-${idx}`} value={option}>
                {option}
              </option>
            ))
          )}
        </select>

        <button
          type="button"
          className="price-range-filter-action-button price-range-filter-add-button"
          onClick={addCategoryFilter}
          disabled={!canAddCategory}
          aria-label={`Add ${schemaInput.label} category filter`}
          title={canAddCategory ? "Add filter" : "No category selected"}
        >
          +
        </button>
      </div>

      {selectedCategoryEntries.map(([cat, cfg]) => {
        const unitDraftKey = getCategoryDraftKey(cat);
        const unitSearchText = unitSearchTextByCategory[unitDraftKey] || "";
        const unitOptions = getAvailableUnits(schemaInput, cat, unitSearchText);
        const modeStr = String(cfg.mode || "Any Price");

        return (
          <div
            key={`${schemaInput.id}-${cat}`}
            className="price-range-filter-category-block"
          >
            <div className="price-range-filter-category-header">
              <h5 className="price-range-filter-category-title">{cat}</h5>

              <button
                type="button"
                className="price-range-filter-action-button price-range-filter-delete-button"
                onClick={() => removeCategoryFilter(cat)}
                aria-label={`Remove ${cat} filter`}
                title="Remove filter"
              >
                &minus;
              </button>
            </div>

            <label
              className="price-range-label"
              htmlFor={`filter-${schemaInput.id}-${cat}-mode`}
            >
              Budget Filter:
            </label>
            <select
              id={`filter-${schemaInput.id}-${cat}-mode`}
              className="value-container"
              value={modeStr}
              onChange={(e) => setCatField(cat, "mode", e.target.value)}
            >
              {modeOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {hasNumeric(modeStr) && (
              <>
                {shouldShowMin(modeStr) && (
                  <>
                    <label
                      className="price-range-label"
                      htmlFor={`filter-${schemaInput.id}-${cat}-min`}
                    >
                      Minimum budget:
                    </label>
                    <input
                      className="value-container"
                      id={`filter-${schemaInput.id}-${cat}-min`}
                      type="text"
                      inputMode="decimal"
                      value={cfg.min ?? ""}
                      onChange={(e) =>
                        setCatField(
                          cat,
                          "min",
                          clampMoneyStr(e.target.value, {
                            minValue: String(schemaMin),
                            maxValue: String(schemaMax),
                            maxLen,
                            decimals: 2,
                            finalize: false,
                          }),
                        )
                      }
                      onBlur={() => {
                        const finalized = clampMoneyStr(cfg.min, {
                          minValue: String(schemaMin),
                          maxValue: String(schemaMax),
                          maxLen,
                          decimals: 2,
                          finalize: true,
                          finalValue: String(schemaMin),
                        });

                        const fixed = enforceMoneyMinMaxOrder(
                          { ...cfg, min: finalized },
                          "min",
                        );

                        setFilterValue({
                          ...value,
                          categories: {
                            ...categories,
                            [cat]: fixed,
                          },
                        });
                      }}
                      placeholder={String(schemaMin)}
                    />
                  </>
                )}

                {shouldShowMax(modeStr) && (
                  <>
                    <label
                      className="price-range-label"
                      htmlFor={`filter-${schemaInput.id}-${cat}-max`}
                    >
                      Maximum budget:
                    </label>
                    <input
                      id={`filter-${schemaInput.id}-${cat}-max`}
                      type="text"
                      className="value-container"
                      inputMode="decimal"
                      value={cfg.max ?? ""}
                      onChange={(e) =>
                        setCatField(
                          cat,
                          "max",
                          clampMoneyStr(e.target.value, {
                            minValue: String(schemaMin),
                            maxValue: String(schemaMax),
                            maxLen,
                            decimals: 2,
                            finalize: false,
                          }),
                        )
                      }
                      onBlur={() => {
                        const finalized = clampMoneyStr(cfg.max, {
                          minValue: String(schemaMin),
                          maxValue: String(schemaMax),
                          maxLen,
                          decimals: 2,
                          finalize: true,
                          finalValue: String(schemaMax),
                        });

                        const fixed = enforceMoneyMinMaxOrder(
                          { ...cfg, max: finalized },
                          "max",
                        );

                        setFilterValue({
                          ...value,
                          categories: {
                            ...categories,
                            [cat]: fixed,
                          },
                        });
                      }}
                      placeholder={String(schemaMax)}
                    />
                  </>
                )}
              </>
            )}

            <label
              className="price-range-label"
              htmlFor={`filter-${schemaInput.id}-${cat}-unit-search`}
            >
              Unit:
            </label>

            <div className="price-range-filter-search-row">
              <input
                id={`filter-${schemaInput.id}-${cat}-unit-search`}
                type="text"
                className="value-container"
                value={unitSearchText}
                onChange={(e) => updateUnitSearchText(cat, e.target.value)}
                placeholder="Type to filter units..."
              />
            </div>

            <div className="price-range-filter-select-row">
              <select
                id={`filter-${schemaInput.id}-${cat}-unit`}
                value={cfg.unit || "Any Unit"}
                className="value-container price-range-filter-select"
                onChange={(e) => setCatField(cat, "unit", e.target.value)}
              >
                <option value="Any Unit">Any Unit</option>
                {unitOptions.map((u, idx) => (
                  <option key={`${cat}-unit-${idx}`} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getItemRange(item, schemaMin, schemaMax) {
  if (!item || typeof item !== "object") {
    return { lo: null, hi: null, ok: false };
  }

  const minN = parseNum(item.min);
  const maxN = parseNum(item.max);
  const fixedN = parseNum(item.fixedPrice);

  switch (item.priceMode) {
    case "Free":
      return { lo: 0, hi: 0, ok: true };

    case "Fixed Price":
      return fixedN == null
        ? { lo: null, hi: null, ok: false }
        : { lo: fixedN, hi: fixedN, ok: true };

    case "Min-Max Range":
      if (minN == null && maxN == null) {
        return { lo: null, hi: null, ok: false };
      }
      return {
        lo: minN ?? schemaMin,
        hi: maxN ?? schemaMax,
        ok: true,
      };

    case "Min Only":
      return minN == null
        ? { lo: null, hi: null, ok: false }
        : { lo: minN, hi: schemaMax, ok: true };

    case "Max Only":
      return maxN == null
        ? { lo: null, hi: null, ok: false }
        : { lo: schemaMin, hi: maxN, ok: true };

    default:
      return { lo: null, hi: null, ok: false };
  }
}

function getFilterRange(cfg, intent, schemaMin, schemaMax) {
  const mn = parseNum(cfg.min);
  const mx = parseNum(cfg.max);

  switch (intent) {
    case "Any Price":
      return null;

    case "Free":
      return { lo: 0, hi: 0 };

    case "Minimum Budget":
      return { lo: mn ?? schemaMin, hi: schemaMax };

    case "Maximum Budget":
      return { lo: schemaMin, hi: mx ?? schemaMax };

    case "Budget Range":
      return {
        lo: Math.min(mn ?? schemaMin, mx ?? schemaMax),
        hi: Math.max(mn ?? schemaMin, mx ?? schemaMax),
      };

    default:
      return null;
  }
}

export function matchesPriceRangeArrayFilter(schemaInput, filterValue, dataInput) {
  const schemaMin =
    typeof schemaInput.minValue === "string" ? Number(schemaInput.minValue) : 0;

  const schemaMax =
    typeof schemaInput.maxValue === "string"
      ? Number(schemaInput.maxValue)
      : 100000;

  const enabledByCat =
    filterValue?.categories && typeof filterValue.categories === "object"
      ? filterValue.categories
      : {};

  const enabledCats = Object.entries(enabledByCat)
    .filter(([, cfg]) => cfg && typeof cfg === "object")
    .map(([cat]) => cat);

  if (!enabledCats.length) return true;

  const categories = dataInput?.categories;
  if (!categories || typeof categories !== "object") return false;

  for (const category of enabledCats) {
    const cfg = enabledByCat[category] || {};
    const items = Array.isArray(categories[category]) ? categories[category] : [];

    if (!items.length) return false;

    const intent = cfg.mode || "Any Price";
    const filterRange = getFilterRange(cfg, intent, schemaMin, schemaMax);
    const unitFilter = cfg.unit || "Any Unit";

    const categoryPasses = items.some((item) => {
      if (!item || typeof item !== "object") return false;

      if (unitFilter !== "Any Unit" && item.unit !== unitFilter) {
        return false;
      }

      if (intent === "Any Price" && !filterRange) return true;

      const r = getItemRange(item, schemaMin, schemaMax);
      if (!r.ok) return false;

      if (intent === "Free") return r.lo === 0 && r.hi === 0;
      if (!filterRange) return true;

      return r.lo <= filterRange.hi && r.hi >= filterRange.lo;
    });

    if (!categoryPasses) return false;
  }

  return true;
}

export function createPriceRangeArrayFilterState() {
  return { categories: {} };
}

export function isPriceRangeArrayFilterActive(value) {
  const cats =
    value?.categories && typeof value.categories === "object"
      ? value.categories
      : {};

  return Object.keys(cats).length > 0;
}