export function normalizeTag(tag) {
  if (typeof tag !== "string") return "";

  const collapsed = tag.trim().replace(/\s+/g, " ");
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

export function normalizeTagArray(tags) {
  const seen = new Set();
  const result = [];

  for (const rawTag of safeArray(tags)) {
    const normalized = normalizeTag(rawTag);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function makeTagListError(message, schemaInput, code) {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  error.inputId = String(schemaInput?.id || "");
  error.inputLabel = schemaInput?.label || "";
  return error;
}

function getDefaultTags(schemaInput) {
  return normalizeTagArray(schemaInput?.defaultTags);
}

function getCustomTags(schemaInput) {
  return normalizeTagArray(schemaInput?.customTags);
}

function assertTagMaxLength(tags, schemaInput) {
  const maxLength = schemaInput?.maxLength ?? 150;

  for (const tag of tags) {
    if (tag.length > maxLength) {
      throw makeTagListError(
        `Tag "${tag}" exceeds maxLength for input ${schemaInput.label || schemaInput.id}.`,
        schemaInput,
        "TAG_LIST_MAX_LENGTH_EXCEEDED",
      );
    }
  }
}

function assertCustomTagsAllowed(schemaInput, incomingTags) {
  if (schemaInput?.allowCustomTags !== false) return;

  const defaultTags = getDefaultTags(schemaInput);
  const defaultSet = new Set(defaultTags.map((tag) => tag.toLowerCase()));

  const invalidTags = incomingTags.filter(
    (tag) => !defaultSet.has(tag.toLowerCase()),
  );

  if (invalidTags.length > 0) {
    throw makeTagListError(
      `Custom tags are not allowed for input ${schemaInput.label || schemaInput.id}.`,
      schemaInput,
      "TAG_LIST_CUSTOM_TAGS_NOT_ALLOWED",
    );
  }
}

export function buildProjectTagListInputMap(projectSections) {
  const map = new Map();

  for (const section of projectSections || []) {
    for (const input of section.inputs || []) {
      if (input?.type !== "tagList") continue;
      map.set(String(input.id), input);
    }
  }

  return map;
}

function buildDataTagListInputMap(dataSections) {
  const map = new Map();

  for (const section of dataSections || []) {
    for (const input of section.inputs || []) {
      if (!input?.id) continue;
      map.set(String(input.id), input);
    }
  }

  return map;
}

function addTagsToChangeMap(changeMap, inputId, tags) {
  const normalizedTags = normalizeTagArray(tags);
  if (normalizedTags.length === 0) return;

  const key = String(inputId);
  const existingTags = changeMap.get(key) || [];
  const existingSet = new Set(existingTags.map((tag) => tag.toLowerCase()));

  for (const tag of normalizedTags) {
    const tagKey = tag.toLowerCase();
    if (existingSet.has(tagKey)) continue;

    existingSet.add(tagKey);
    existingTags.push(tag);
  }

  changeMap.set(key, existingTags);
}

function countChangeMapTags(changeMap) {
  let count = 0;

  for (const tags of changeMap.values()) {
    count += tags.length;
  }

  return count;
}

export function normalizeTagListSections(projectSections, dataSections) {
  const tagListInputMap = buildProjectTagListInputMap(projectSections);
  const nextSections = structuredClone(
    Array.isArray(dataSections) ? dataSections : [],
  );

  for (const section of nextSections) {
    for (const input of section.inputs || []) {
      const schemaInput = tagListInputMap.get(String(input?.id));
      if (!schemaInput) continue;

      const incomingTags = normalizeTagArray(input?.tags);

      assertTagMaxLength(incomingTags, schemaInput);
      assertCustomTagsAllowed(schemaInput, incomingTags);

      if (incomingTags.length > (schemaInput.maxItems ?? 10000)) {
        const error = makeTagListError(
          `Tag limit exceeded for input ${schemaInput.label || schemaInput.id}.`,
          schemaInput,
          "TAG_LIST_MAX_ITEMS_EXCEEDED",
        );

        error.maxItems = schemaInput.maxItems ?? 10000;
        error.resultCount = incomingTags.length;

        throw error;
      }

      input.tags = incomingTags;
    }
  }

  return nextSections;
}

export function formatTagChanges(changeMap) {
  return Array.from(changeMap.entries())
    .map(([inputId, tags]) => ({
      inputId,
      tags: [...tags],
    }))
    .filter((entry) => entry.tags.length > 0);
}

export function mergeTagsIntoProjectSections(projectSections, dataSections) {
  const nextSections = structuredClone(
    Array.isArray(projectSections) ? projectSections : [],
  );

  const addedCustomTagsMap = new Map();
  const schemaInputMap = buildProjectTagListInputMap(nextSections);

  for (const section of dataSections || []) {
    for (const input of section.inputs || []) {
      const schemaInput = schemaInputMap.get(String(input?.id));
      if (!schemaInput) continue;

      const defaultTags = getDefaultTags(schemaInput);
      const customTags = getCustomTags(schemaInput);
      const incomingTags = normalizeTagArray(input?.tags);

      assertTagMaxLength(incomingTags, schemaInput);
      assertCustomTagsAllowed(schemaInput, incomingTags);

      const defaultSet = new Set(
        defaultTags.map((tag) => tag.toLowerCase()),
      );

      const combinedCustomTags = [...customTags];
      const combinedCustomSet = new Set(
        combinedCustomTags.map((tag) => tag.toLowerCase()),
      );

      const addedHere = [];

      if (schemaInput.allowCustomTags !== false) {
        for (const incomingTag of incomingTags) {
          const key = incomingTag.toLowerCase();

          if (defaultSet.has(key)) continue;
          if (combinedCustomSet.has(key)) continue;

          combinedCustomSet.add(key);
          combinedCustomTags.push(incomingTag);
          addedHere.push(incomingTag);
        }
      }

      const totalUniqueOptions = normalizeTagArray([
        ...defaultTags,
        ...combinedCustomTags,
      ]);

      if (totalUniqueOptions.length > (schemaInput.maxItems ?? 10000)) {
        const error = makeTagListError(
          `Tag limit exceeded for input ${schemaInput.label || schemaInput.id}.`,
          schemaInput,
          "TAG_LIST_MAX_ITEMS_EXCEEDED",
        );

        error.maxItems = schemaInput.maxItems ?? 10000;
        error.currentCount = normalizeTagArray([
          ...defaultTags,
          ...customTags,
        ]).length;
        error.incomingCount = incomingTags.length;
        error.resultCount = totalUniqueOptions.length;

        throw error;
      }

      schemaInput.defaultTags = defaultTags;
      schemaInput.customTags = combinedCustomTags;

      if (addedHere.length > 0) {
        addedCustomTagsMap.set(String(schemaInput.id), addedHere);
      }
    }
  }

  return {
    nextSections,
    addedCustomTags: formatTagChanges(addedCustomTagsMap),
  };
}

export function collectRemovedCustomTagsForDataItemUpdate(
  projectSections,
  oldDataSections,
  newDataSections,
) {
  const schemaInputMap = buildProjectTagListInputMap(projectSections);
  const oldInputMap = buildDataTagListInputMap(oldDataSections);
  const newInputMap = buildDataTagListInputMap(newDataSections);
  const removedCustomTagsMap = new Map();

  for (const [inputId, schemaInput] of schemaInputMap.entries()) {
    if (schemaInput.allowCustomTags === false) continue;

    const customTags = getCustomTags(schemaInput);
    if (customTags.length === 0) continue;

    const customSet = new Set(customTags.map((tag) => tag.toLowerCase()));

    const oldInput = oldInputMap.get(inputId);
    if (!oldInput) continue;

    const oldTags = normalizeTagArray(oldInput?.tags);
    if (oldTags.length === 0) continue;

    const newInput = newInputMap.get(inputId);
    const newTags = normalizeTagArray(newInput?.tags);
    const newSet = new Set(newTags.map((tag) => tag.toLowerCase()));

    const removedCustomTags = oldTags.filter((tag) => {
      const key = tag.toLowerCase();
      return customSet.has(key) && !newSet.has(key);
    });

    addTagsToChangeMap(removedCustomTagsMap, inputId, removedCustomTags);
  }

  return formatTagChanges(removedCustomTagsMap);
}

function removeTagsFoundInDataItem(changeMap, dataItem, schemaInputMap) {
  if (countChangeMapTags(changeMap) === 0) return;

  for (const section of dataItem?.sections || []) {
    for (const input of section.inputs || []) {
      const inputId = String(input?.id || "");
      if (!changeMap.has(inputId)) continue;

      const schemaInput = schemaInputMap.get(inputId);
      if (!schemaInput) continue;
      if (schemaInput.allowCustomTags === false) {
        changeMap.delete(inputId);
        continue;
      }

      const tagsToFind = changeMap.get(inputId) || [];
      if (tagsToFind.length === 0) {
        changeMap.delete(inputId);
        continue;
      }

      const incomingTags = normalizeTagArray(input?.tags);
      const incomingSet = new Set(
        incomingTags.map((tag) => tag.toLowerCase()),
      );

      const remainingTagsToFind = tagsToFind.filter(
        (tag) => !incomingSet.has(tag.toLowerCase()),
      );

      if (remainingTagsToFind.length === 0) {
        changeMap.delete(inputId);
      } else {
        changeMap.set(inputId, remainingTagsToFind);
      }
    }
  }
}

function pruneCustomTagsFromProjectSections(projectSections, orphanedTagsMap) {
  const nextSections = structuredClone(
    Array.isArray(projectSections) ? projectSections : [],
  );

  if (countChangeMapTags(orphanedTagsMap) === 0) {
    return {
      nextSections,
      removedCustomTags: [],
    };
  }

  const schemaInputMap = buildProjectTagListInputMap(nextSections);
  const removedCustomTagsMap = new Map();

  for (const [inputId, tagsToRemove] of orphanedTagsMap.entries()) {
    const schemaInput = schemaInputMap.get(String(inputId));
    if (!schemaInput) continue;
    if (schemaInput.allowCustomTags === false) continue;

    const customTags = getCustomTags(schemaInput);
    if (customTags.length === 0) continue;

    const removeSet = new Set(
      normalizeTagArray(tagsToRemove).map((tag) => tag.toLowerCase()),
    );

    const nextCustomTags = [];
    const removedHere = [];

    for (const customTag of customTags) {
      if (removeSet.has(customTag.toLowerCase())) {
        removedHere.push(customTag);
      } else {
        nextCustomTags.push(customTag);
      }
    }

    schemaInput.customTags = nextCustomTags;

    if (removedHere.length > 0) {
      removedCustomTagsMap.set(String(inputId), removedHere);
    }
  }

  return {
    nextSections,
    removedCustomTags: formatTagChanges(removedCustomTagsMap),
  };
}

export function removeUnusedCustomTagsAfterDataItemUpdate(
  projectSections,
  oldDataSections,
  newDataSections,
  otherDataItems,
) {
  const removedCandidates = collectRemovedCustomTagsForDataItemUpdate(
    projectSections,
    oldDataSections,
    newDataSections,
  );

  if (removedCandidates.length === 0) {
    return {
      nextSections: structuredClone(
        Array.isArray(projectSections) ? projectSections : [],
      ),
      removedCustomTags: [],
    };
  }

  const orphanedTagsMap = new Map();

  for (const change of removedCandidates) {
    addTagsToChangeMap(orphanedTagsMap, change.inputId, change.tags);
  }

  const schemaInputMap = buildProjectTagListInputMap(projectSections);

  for (const dataItem of otherDataItems || []) {
    if (countChangeMapTags(orphanedTagsMap) === 0) break;
    removeTagsFoundInDataItem(orphanedTagsMap, dataItem, schemaInputMap);
  }

  return pruneCustomTagsFromProjectSections(projectSections, orphanedTagsMap);
}

export function recomputeProjectTagSections(projectSections, remainingDataItems) {
  const nextSections = structuredClone(
    Array.isArray(projectSections) ? projectSections : [],
  );

  const schemaInputMap = buildProjectTagListInputMap(nextSections);
  const oldCustomTagsByInput = new Map();

  for (const [inputId, schemaInput] of schemaInputMap.entries()) {
    const defaultTags = getDefaultTags(schemaInput);
    const customTags = getCustomTags(schemaInput);

    oldCustomTagsByInput.set(inputId, customTags);

    schemaInput.defaultTags = defaultTags;
    schemaInput.customTags = [];
  }

  for (const dataItem of remainingDataItems || []) {
    for (const section of dataItem.sections || []) {
      for (const input of section.inputs || []) {
        const schemaInput = schemaInputMap.get(String(input?.id));
        if (!schemaInput) continue;

        const incomingTags = normalizeTagArray(input?.tags);

        assertTagMaxLength(incomingTags, schemaInput);
        assertCustomTagsAllowed(schemaInput, incomingTags);

        if (schemaInput.allowCustomTags === false) {
          continue;
        }

        const defaultTags = getDefaultTags(schemaInput);
        const defaultSet = new Set(defaultTags.map((tag) => tag.toLowerCase()));

        const currentCustomTags = getCustomTags(schemaInput);
        const currentCustomSet = new Set(
          currentCustomTags.map((tag) => tag.toLowerCase()),
        );

        for (const incomingTag of incomingTags) {
          const key = incomingTag.toLowerCase();

          if (defaultSet.has(key)) continue;
          if (currentCustomSet.has(key)) continue;

          currentCustomSet.add(key);
          currentCustomTags.push(incomingTag);
        }

        schemaInput.customTags = currentCustomTags;
      }
    }
  }

  const removedCustomTagsMap = new Map();

  for (const [inputId, oldCustomTags] of oldCustomTagsByInput.entries()) {
    const schemaInput = schemaInputMap.get(String(inputId));
    const nextCustomTags = getCustomTags(schemaInput);
    const nextSet = new Set(nextCustomTags.map((tag) => tag.toLowerCase()));

    const removed = oldCustomTags.filter(
      (tag) => !nextSet.has(tag.toLowerCase()),
    );

    if (removed.length > 0) {
      removedCustomTagsMap.set(inputId, removed);
    }
  }

  return {
    nextSections,
    removedCustomTags: formatTagChanges(removedCustomTagsMap),
  };
}