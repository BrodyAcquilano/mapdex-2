import "../../styles/modals.css";
import "../../styles/panels.css";
import "./TagList.css";

function getDraftKey(sectionIndex, inputIndex) {
  return `${sectionIndex}_${inputIndex}`;
}

function getDraftState(sectionIndex, inputIndex, tagInputDrafts) {
  const key = getDraftKey(sectionIndex, inputIndex);
  const draft = tagInputDrafts?.[key];

  return {
    key,
    searchText: typeof draft?.searchText === "string" ? draft.searchText : "",
    selectedOption:
      typeof draft?.selectedOption === "string" ? draft.selectedOption : "",
  };
}

function setDraftState(sectionIndex, inputIndex, nextDraft, setTagInputDrafts) {
  const key = getDraftKey(sectionIndex, inputIndex);

  setTagInputDrafts((prev) => ({
    ...prev,
    [key]: nextDraft,
  }));
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

function getSchemaTags(input) {
  const defaultTags = Array.isArray(input?.defaultTags)
    ? input.defaultTags
    : [];

  const customTags = Array.isArray(input?.customTags)
    ? input.customTags
    : [];

  const deduped = [];
  const seen = new Set();

  for (const raw of [...defaultTags, ...customTags]) {
    const normalized = normalizeTag(raw);
    const lowered = lowerTag(normalized);

    if (!normalized || seen.has(lowered)) continue;

    seen.add(lowered);
    deduped.push(normalized);
  }

  return deduped;
}

function getSelectedTags(stored) {
  return Array.isArray(stored?.tags)
    ? stored.tags
        .filter((tag) => typeof tag === "string")
        .map(normalizeTag)
        .filter(Boolean)
    : [];
}

function getAvailableOptions(input, stored, searchText) {
  const schemaTags = getSchemaTags(input);
  const selectedTags = getSelectedTags(stored);
  const selectedSet = new Set(selectedTags.map(lowerTag));
  const query = normalizeTag(searchText).toLowerCase();

  const deduped = [];
  const seen = new Set();

  for (const tag of schemaTags) {
    const lowered = lowerTag(tag);
    if (!lowered || seen.has(lowered)) continue;

    seen.add(lowered);

    if (selectedSet.has(lowered)) continue;
    if (query && !lowered.includes(query)) continue;

    deduped.push(tag);
  }

  return deduped;
}

function resolveTypedTagAgainstSchema(input, typedValue) {
  const normalizedTyped = normalizeTag(typedValue);
  if (!normalizedTyped) return "";

  const schemaTags = getSchemaTags(input);
  const typedLower = lowerTag(normalizedTyped);

  const exactSchemaMatch = schemaTags.find(
    (tag) => lowerTag(tag) === typedLower,
  );

  return exactSchemaMatch || normalizedTyped;
}

export function renderTagListInput({
  input,
  stored,
  sectionIndex,
  inputIndex,
  setFormData,
  tagInputDrafts,
  setTagInputDrafts,
}) {
  const { searchText, selectedOption } = getDraftState(
    sectionIndex,
    inputIndex,
    tagInputDrafts,
  );

  const allowCustomTags = input?.allowCustomTags !== false;

  const tags = getSelectedTags(stored);
  const availableOptions = getAvailableOptions(input, stored, searchText);

  const resolvedSelectedOption = availableOptions.includes(selectedOption)
    ? selectedOption
    : availableOptions[0] || "";

  function updateSearchText(value) {
    const nextSearchText = value;
    const nextOptions = getAvailableOptions(input, stored, nextSearchText);

    setDraftState(
      sectionIndex,
      inputIndex,
      {
        searchText: nextSearchText,
        selectedOption: nextOptions[0] || "",
      },
      setTagInputDrafts,
    );
  }

  function updateSelectedOption(value) {
    setDraftState(
      sectionIndex,
      inputIndex,
      {
        searchText,
        selectedOption: value,
      },
      setTagInputDrafts,
    );
  }

  function addNormalizedTag(nextTag) {
    const normalizedTag = allowCustomTags
      ? resolveTypedTagAgainstSchema(input, nextTag)
      : normalizeTag(nextTag);

    if (!normalizedTag) return;

    if (!allowCustomTags) {
      const schemaTags = getSchemaTags(input);

      const existsInSchema = schemaTags.some(
        (tag) => lowerTag(tag) === lowerTag(normalizedTag),
      );

      if (!existsInSchema) return;
    }

    if (typeof input.maxItems === "number" && tags.length >= input.maxItems) {
      return;
    }

    const lowered = lowerTag(normalizedTag);
    const alreadyExists = tags.some((tag) => lowerTag(tag) === lowered);

    if (alreadyExists) {
      setDraftState(
        sectionIndex,
        inputIndex,
        {
          searchText: "",
          selectedOption: resolvedSelectedOption,
        },
        setTagInputDrafts,
      );
      return;
    }

    setFormData((prev) => {
      const next = structuredClone(prev);
      const slot = next.sections[sectionIndex].inputs[inputIndex];

      if (!Array.isArray(slot.tags)) {
        slot.tags = [];
      }

      slot.tags.push(normalizedTag);
      return next;
    });

    const nextStored = {
      ...stored,
      tags: [...tags, normalizedTag],
    };

    const nextOptions = getAvailableOptions(input, nextStored, "");

    setDraftState(
      sectionIndex,
      inputIndex,
      {
        searchText: "",
        selectedOption: nextOptions[0] || "",
      },
      setTagInputDrafts,
    );
  }

  function addTypedTag() {
    if (!allowCustomTags) return;
    addNormalizedTag(searchText);
  }

  function addSelectedOption() {
    addNormalizedTag(resolvedSelectedOption);
  }

  function removeTag(tagIndex) {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const slot = next.sections[sectionIndex].inputs[inputIndex];

      if (!Array.isArray(slot.tags)) {
        slot.tags = [];
        return next;
      }

      slot.tags.splice(tagIndex, 1);
      return next;
    });

    const nextStored = {
      ...stored,
      tags: tags.filter((_, idx) => idx !== tagIndex),
    };

    const nextOptions = getAvailableOptions(input, nextStored, searchText);

    setDraftState(
      sectionIndex,
      inputIndex,
      {
        searchText,
        selectedOption: nextOptions.includes(resolvedSelectedOption)
          ? resolvedSelectedOption
          : nextOptions[0] || "",
      },
      setTagInputDrafts,
    );
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();

      if (allowCustomTags) {
        addTypedTag();
      }
    }
  }

  const maxLength = input.maxLength || 150;
  const maxItems = input.maxItems || 10000;
  const canAddMore = tags.length < maxItems;
  const canAddTyped =
    allowCustomTags && canAddMore && normalizeTag(searchText) !== "";
  const canAddSelected = canAddMore && !!resolvedSelectedOption;

  return (
    <div
      key={input.id}
      className="tag-list-form-group"
      role="group"
      aria-labelledby={`input-${input.id}-label`}
    >
      <label
        className="label-container"
        htmlFor={`input-${input.id}`}
        id={`input-${input.id}-label`}
      >
        {input.label}:
      </label>

      <div className="tag-list-input-row">
        <input
          className="value-container"
          id={`input-${input.id}`}
          type="text"
          value={searchText}
          maxLength={maxLength}
          onChange={(e) => updateSearchText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            allowCustomTags ? "Type or filter tags..." : "Filter tags..."
          }
        />

        {allowCustomTags && (
          <button
            type="button"
            className="tag-list-action-button tag-list-add-button"
            onClick={addTypedTag}
            disabled={!canAddTyped}
            aria-label={`Add typed tag to ${input.label}`}
            title={canAddTyped ? "Add typed tag" : "No typed tag to add"}
          >
            +
          </button>
        )}
      </div>

      <div className="tag-list-select-row">
        <select
          className="value-container tag-list-select"
          value={resolvedSelectedOption}
          onChange={(e) => updateSelectedOption(e.target.value)}
          disabled={availableOptions.length === 0}
        >
          {availableOptions.length === 0 ? (
            <option value="">No matches</option>
          ) : (
            availableOptions.map((option, idx) => (
              <option key={`${input.id}-${idx}`} value={option}>
                {option}
              </option>
            ))
          )}
        </select>

        <button
          type="button"
          className="tag-list-action-button tag-list-add-button"
          onClick={addSelectedOption}
          disabled={!canAddSelected}
          aria-label={`Add selected tag to ${input.label}`}
          title={canAddSelected ? "Add selected tag" : "No selected tag to add"}
        >
          +
        </button>
      </div>

      {tags.length > 0 && (
        <div className="tag-list-items">
          {tags.map((tag, tagIndex) => (
            <div key={`${input.id}-${tagIndex}`} className="tag-list-item-row">
              <button
                type="button"
                className="tag-list-action-button tag-list-delete-button"
                onClick={() => removeTag(tagIndex)}
                aria-label={`Remove ${tag}`}
                title="Remove tag"
              >
                &minus;
              </button>

              <span className="tag-list-bullet">•</span>
              <span className="tag-list-text">{tag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default renderTagListInput;