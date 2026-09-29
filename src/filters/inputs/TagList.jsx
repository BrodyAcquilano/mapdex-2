import "./TagList.css";

function getDraftKey(schemaInputId) {
  return String(schemaInputId);
}

function getDraftState(schemaInputId, tagFilterDrafts) {
  const key = getDraftKey(schemaInputId);
  const draft = tagFilterDrafts?.[key];

  return {
    key,
    searchText: typeof draft?.searchText === "string" ? draft.searchText : "",
    selectedOption:
      typeof draft?.selectedOption === "string" ? draft.selectedOption : "",
  };
}

function setDraftState(schemaInputId, nextDraft, setTagFilterDrafts) {
  const key = getDraftKey(schemaInputId);

  setTagFilterDrafts((prev) => ({
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

function getSchemaTags(schemaInput) {
  const defaultTags = Array.isArray(schemaInput?.defaultTags)
    ? schemaInput.defaultTags
    : [];

  const customTags = Array.isArray(schemaInput?.customTags)
    ? schemaInput.customTags
    : [];

  const deduped = [];
  const seen = new Set();

  for (const rawTag of [...defaultTags, ...customTags]) {
    const normalized = normalizeTag(rawTag);
    const lowered = lowerTag(normalized);

    if (!normalized || seen.has(lowered)) continue;

    seen.add(lowered);
    deduped.push(normalized);
  }

  return deduped;
}

function getSelectedTags(filterValue) {
  return Array.isArray(filterValue)
    ? filterValue
        .filter((tag) => typeof tag === "string")
        .map(normalizeTag)
        .filter(Boolean)
    : [];
}

function getAvailableOptions(schemaInput, filterValue, searchText) {
  const schemaTags = getSchemaTags(schemaInput);
  const selectedTags = getSelectedTags(filterValue);
  const selectedSet = new Set(selectedTags.map(lowerTag));
  const query = normalizeTag(searchText).toLowerCase();

  const deduped = [];
  const seen = new Set();

  for (const tag of schemaTags) {
    const lowered = lowerTag(tag);
    if (!lowered) continue;
    if (seen.has(lowered)) continue;
    seen.add(lowered);

    if (selectedSet.has(lowered)) continue;
    if (query && !lowered.includes(query)) continue;

    deduped.push(tag);
  }

  return deduped;
}

export function renderTagListFilter(
  schemaInput,
  filterValue,
  setFilterValue,
  tagFilterDrafts,
  setTagFilterDrafts,
) {
  const { key, searchText, selectedOption } = getDraftState(
    schemaInput.id,
    tagFilterDrafts,
  );

  const selectedTags = getSelectedTags(filterValue);
  const availableOptions = getAvailableOptions(
    schemaInput,
    selectedTags,
    searchText,
  );

  const resolvedSelectedOption = availableOptions.includes(selectedOption)
    ? selectedOption
    : availableOptions[0] || "";

  function handleSearchChange(value) {
    const nextSearchText = value;

    const nextOptions = getAvailableOptions(
      schemaInput,
      selectedTags,
      nextSearchText,
    );

    setDraftState(
      schemaInput.id,
      {
        searchText: nextSearchText,
        selectedOption: nextOptions[0] || "",
      },
      setTagFilterDrafts,
    );
  }

  function handleSelectChange(value) {
    setDraftState(
      schemaInput.id,
      {
        searchText,
        selectedOption: value,
      },
      setTagFilterDrafts,
    );
  }

  function handleAddTag() {
    const nextTag = normalizeTag(resolvedSelectedOption);
    if (!nextTag) return;

    const lowered = lowerTag(nextTag);
    const alreadySelected = selectedTags.some(
      (tag) => lowerTag(tag) === lowered
    );
    if (alreadySelected) return;

    const nextFilterTags = [...selectedTags, nextTag];
    setFilterValue(nextFilterTags);

    const nextOptions = getAvailableOptions(schemaInput, nextFilterTags, "");

    setDraftState(
      schemaInput.id,
      {
        searchText: "",
        selectedOption: nextOptions[0] || "",
      },
      setTagFilterDrafts,
    );
  }

  function handleRemoveTag(tagToRemove) {
    const removeLower = lowerTag(tagToRemove);
    const nextFilterTags = selectedTags.filter(
      (tag) => lowerTag(tag) !== removeLower,
    );

    setFilterValue(nextFilterTags);

    const nextOptions = getAvailableOptions(
      schemaInput,
      nextFilterTags,
      searchText,
    );

    setDraftState(
      schemaInput.id,
      {
        searchText,
        selectedOption: nextOptions.includes(resolvedSelectedOption)
          ? resolvedSelectedOption
          : nextOptions[0] || "",
      },
      setTagFilterDrafts,
    );
  }

  const canAdd = !!resolvedSelectedOption;

  return (
    <div
      key={schemaInput.id}
      className="tag-filter-form-group"
      role="group"
      aria-labelledby={`filter-${schemaInput.id}-label`}
    >
      <label
        className="label-container"
        htmlFor={`filter-${schemaInput.id}-search`}
        id={`filter-${schemaInput.id}-label`}
      >
        {schemaInput.label}:
      </label>

      <div className="tag-filter-search-row">
        <input
          id={`filter-${schemaInput.id}-search`}
          type="text"
          className="value-container"
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Type to filter tags..."
        />
      </div>

      <div className="tag-filter-select-row">
        <select
          id={`filter-${schemaInput.id}-select`}
          className="value-container tag-filter-select"
          value={resolvedSelectedOption}
          onChange={(e) => handleSelectChange(e.target.value)}
          disabled={availableOptions.length === 0}
        >
          {availableOptions.length === 0 ? (
            <option value="">No matches</option>
          ) : (
            availableOptions.map((option, idx) => (
              <option key={`${key}-${idx}`} value={option}>
                {option}
              </option>
            ))
          )}
        </select>

        <button
          type="button"
          className="tag-filter-action-button tag-filter-add-button"
          onClick={handleAddTag}
          disabled={!canAdd}
          aria-label={`Add ${schemaInput.label} filter`}
          title={canAdd ? "Add filter" : "No tag selected"}
        >
          +
        </button>
      </div>

      {selectedTags.length > 0 && (
        <div className="tag-filter-items">
          {selectedTags.map((tag, idx) => (
            <div key={`${key}-selected-${idx}`} className="tag-filter-item-row">
              <button
                type="button"
                className="tag-filter-action-button tag-filter-delete-button"
                onClick={() => handleRemoveTag(tag)}
                aria-label={`Remove ${tag} filter`}
                title="Remove filter"
              >
                &minus;
              </button>

              <span className="tag-filter-bullet">•</span>
              <span className="tag-filter-text">{tag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function matchesTagListFilter(filterValue, dataInput) {
  const activeTags = getSelectedTags(filterValue);
  if (activeTags.length === 0) return true;

  const dataTags = Array.isArray(dataInput?.tags)
    ? dataInput.tags
        .filter((tag) => typeof tag === "string")
        .map(normalizeTag)
        .filter(Boolean)
    : [];

  const dataSet = new Set(dataTags.map(lowerTag));

  return activeTags.every((tag) => dataSet.has(lowerTag(tag)));
}

export function createTagListFilterState() {
  return [];
}

export function isTagListFilterActive(value) {
  return Array.isArray(value) && value.length > 0;
}