// src/workspace/schema/SchemaLeftColumn.jsx

import "./SchemaLeftColumn.css";

import {
  generateNewSection,
  generateNewInput,
  capitalizeFirstLetter,
} from "./schemaHelpers.js";

import {
  getSectionsLibrary,
  getSectionDefinition,
} from "./schemaBuilder/sectionsLibrary/index.js";

import {
  SECTION_LIMITS,
  PROJECT_LIMITS,
} from "../../../shared/validation/validationConstants.js";

function remapPreviewTextSettingsForSectionMove(
  previewTextSettings,
  fromIndex,
  toIndex,
) {
  const nextSettings = {};

  Object.entries(previewTextSettings || {}).forEach(([key, value]) => {
    const [sStr, iStr] = key.split("_");
    const sectionIndex = Number(sStr);
    const inputIndex = Number(iStr);

    if (!Number.isFinite(sectionIndex) || !Number.isFinite(inputIndex)) {
      nextSettings[key] = value;
      return;
    }

    if (sectionIndex === fromIndex) {
      nextSettings[`${toIndex}_${inputIndex}`] = value;
      return;
    }

    if (sectionIndex === toIndex) {
      nextSettings[`${fromIndex}_${inputIndex}`] = value;
      return;
    }

    nextSettings[key] = value;
  });

  return nextSettings;
}

function getNextSelectedSectionIndexAfterSectionMove({
  selectedSectionIndex,
  fromIndex,
  toIndex,
}) {
  if (typeof selectedSectionIndex !== "number") {
    return selectedSectionIndex;
  }

  if (selectedSectionIndex === fromIndex) {
    return toIndex;
  }

  if (selectedSectionIndex === toIndex) {
    return fromIndex;
  }

  return selectedSectionIndex;
}

function SchemaLeftColumn({
  draftSchema,
  setDraftSchema,
  selectedSectionIndex,
  setSelectedSectionIndex,
  setSelectedInputIndex,
  schemaRules,
  previewTextSettings,
  setPreviewTextSettings,
  SETTINGS_SECTION_KEY,
  GEOMETRY_SECTION_KEY,
  TIME_SECTION_KEY,
  EXTENSIONS_SECTION_KEY,
}) {
  const lockedSectionIndexes = schemaRules?.lockedSections || [];
  const isLockedSectionIndex = (index) => lockedSectionIndexes.includes(index);

  const isSettingsSelected = selectedSectionIndex === SETTINGS_SECTION_KEY;
  const isGeometrySelected = selectedSectionIndex === GEOMETRY_SECTION_KEY;
  const isTimeSelected = selectedSectionIndex === TIME_SECTION_KEY;
  const isExtensionsSelected = selectedSectionIndex === EXTENSIONS_SECTION_KEY;

  const predefinedSections = getSectionsLibrary();

  const selectedSection =
    typeof selectedSectionIndex === "number"
      ? draftSchema.sections?.[selectedSectionIndex]
      : null;

  const isSelectedPredefinedSection = Boolean(
    selectedSection?.systemKey &&
    getSectionDefinition(selectedSection.systemKey),
  );

  const isAddInputDisabled =
    isSettingsSelected ||
    isGeometrySelected ||
    isTimeSelected ||
    isExtensionsSelected ||
    isSelectedPredefinedSection;

  const sectionCount = Array.isArray(draftSchema.sections)
    ? draftSchema.sections.length
    : 0;

  const hasReachedMaxSections = sectionCount >= PROJECT_LIMITS.maxSections;

  const selectedSectionInputCount = Array.isArray(selectedSection?.inputs)
    ? selectedSection.inputs.length
    : 0;

  const hasReachedMaxInputsForSelectedSection =
    selectedSectionInputCount >= SECTION_LIMITS.maxInputs;

  function applyPresenceGuardsToInput(input) {
    if (!input || draftSchema?.engineKey !== "presence") {
      return input;
    }

    if (input.type === "tagList") {
      return {
        ...input,
        allowCustomTags: false,
      };
    }

    if (input.type === "priceRangeArray") {
      return {
        ...input,
        allowCustomCategoriesAndUnits: false,
      };
    }

    return input;
  }

  function applyPresenceGuardsToSection(section) {
    if (!section || draftSchema?.engineKey !== "presence") {
      return section;
    }

    return {
      ...section,
      inputs: Array.isArray(section.inputs)
        ? section.inputs.map((input) => applyPresenceGuardsToInput(input))
        : [],
    };
  }

  function addNewSection() {
    if (hasReachedMaxSections) return;

    const newSection = applyPresenceGuardsToSection(generateNewSection());
    const updatedSections = [...draftSchema.sections, newSection];

    setDraftSchema({ ...draftSchema, sections: updatedSections });
    setSelectedSectionIndex(updatedSections.length - 1);
    setSelectedInputIndex(null);
  }

  function addPredefinedSection(sectionKey) {
    if (!sectionKey) return;
    if (hasReachedMaxSections) return;

    const sectionDefinition = getSectionDefinition(sectionKey);
    if (!sectionDefinition?.buildSection) return;

    const builtSection = applyPresenceGuardsToSection(
      sectionDefinition.buildSection(),
    );

    if (!builtSection) return;

    const sectionSystemKey = builtSection.systemKey;

    const alreadyExists = draftSchema.sections.some(
      (section) =>
        section?.systemKey &&
        sectionSystemKey &&
        section.systemKey === sectionSystemKey,
    );

    if (alreadyExists) return;

    const updatedSections = [...draftSchema.sections, builtSection];

    setDraftSchema({ ...draftSchema, sections: updatedSections });
    setSelectedSectionIndex(updatedSections.length - 1);
    setSelectedInputIndex(null);
  }

  function handleMoveSection(e, index, direction) {
    e.stopPropagation();

    const sections = Array.isArray(draftSchema.sections)
      ? draftSchema.sections
      : [];

    const toIndex = index + direction;

    if (index < 0 || index >= sections.length) return;
    if (toIndex < 0 || toIndex >= sections.length) return;

    // Locked sections cannot move, and other sections
    // cannot swap positions with a locked section.
    if (isLockedSectionIndex(index)) return;
    if (isLockedSectionIndex(toIndex)) return;

    const updatedSections = [...sections];

    [updatedSections[index], updatedSections[toIndex]] = [
      updatedSections[toIndex],
      updatedSections[index],
    ];

    setDraftSchema({
      ...draftSchema,
      sections: updatedSections,
    });

    setSelectedSectionIndex(
      getNextSelectedSectionIndexAfterSectionMove({
        selectedSectionIndex,
        fromIndex: index,
        toIndex,
      }),
    );

    setPreviewTextSettings(
      remapPreviewTextSettingsForSectionMove(
        previewTextSettings,
        index,
        toIndex,
      ),
    );
  }

  function handleDeleteSection(e, index) {
    e.stopPropagation();
    if (isLockedSectionIndex(index)) return;

    const updatedSections = draftSchema.sections.filter((_, i) => i !== index);
    setDraftSchema({ ...draftSchema, sections: updatedSections });

    if (selectedSectionIndex === index) {
      setSelectedSectionIndex(SETTINGS_SECTION_KEY);
      setSelectedInputIndex(null);
    } else if (
      typeof selectedSectionIndex === "number" &&
      selectedSectionIndex > index
    ) {
      setSelectedSectionIndex(selectedSectionIndex - 1);
      setSelectedInputIndex(null);
    }

    const nextSettings = {};
    Object.entries(previewTextSettings || {}).forEach(([key, value]) => {
      const [sStr, iStr] = key.split("_");
      const s = Number(sStr);
      const i = Number(iStr);

      if (!Number.isFinite(s) || !Number.isFinite(i)) {
        nextSettings[key] = value;
        return;
      }

      if (s === index) return;

      if (s > index) {
        nextSettings[`${s - 1}_${i}`] = value;
        return;
      }

      nextSettings[key] = value;
    });

    setPreviewTextSettings(nextSettings);
  }

  function handleRenameSectionKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  }

  function handleRenameSection(e, index) {
    if (isLockedSectionIndex(index)) return;

    const newName = e.target.value;
    const updatedSections = [...draftSchema.sections];
    updatedSections[index].name = newName;
    setDraftSchema({ ...draftSchema, sections: updatedSections });
  }

  function addInputToCurrentSection(type) {
    if (
      selectedSectionIndex === SETTINGS_SECTION_KEY ||
      selectedSectionIndex === GEOMETRY_SECTION_KEY ||
      selectedSectionIndex === TIME_SECTION_KEY ||
      selectedSectionIndex === EXTENSIONS_SECTION_KEY
    ) {
      return;
    }

    const currentSection = draftSchema.sections?.[selectedSectionIndex];
    if (
      currentSection?.systemKey &&
      getSectionDefinition(currentSection.systemKey)
    ) {
      return;
    }

    if (
      Array.isArray(currentSection?.inputs) &&
      currentSection.inputs.length >= SECTION_LIMITS.maxInputs
    ) {
      return;
    }

    const newInput = applyPresenceGuardsToInput(generateNewInput(type));
    const updatedSections = [...draftSchema.sections];

    if (!updatedSections[selectedSectionIndex]) return;
    if (!Array.isArray(updatedSections[selectedSectionIndex].inputs)) {
      updatedSections[selectedSectionIndex].inputs = [];
    }

    updatedSections[selectedSectionIndex].inputs.push(newInput);
    setDraftSchema({ ...draftSchema, sections: updatedSections });
  }

  const addableInputTypes = schemaRules?.addableInputTypes || [
    "text",
    "number",
    "percentage",
    "website",
    "phoneNumber",
    "email",
    "checkbox",
    "dropdown",
    "notes",
    "capacity",
    "hours",
    "ageRange",
    "priceRangeArray",
    "tagList",
  ];

  const getTypeLabel = (type) => {
    if (type === "ageRange") return "Age Range";
    if (type === "phoneNumber") return "Phone Number";
    if (type === "priceRangeArray") return "Price Range Array";
    if (type === "tagList") return "Tag List";
    return capitalizeFirstLetter(type);
  };

  const isPredefinedSectionAdded = (sectionKey) => {
    const sectionDefinition = getSectionDefinition(sectionKey);
    if (!sectionDefinition?.key) return false;

    return draftSchema.sections.some(
      (section) => section?.systemKey === sectionDefinition.key,
    );
  };

  const availablePredefinedSections = predefinedSections.filter(
    (sectionDef) => !isPredefinedSectionAdded(sectionDef.key),
  );

  return (
    <div className="schema-column-left">
      <div className="sections-manager">
        <div className="section-header">
          <h2>Sections Manager</h2>
        </div>

        <div className="sections-manager-toolbar">
          <span className="sections-manager-toolbar-title">Toolbar</span>
          <span
            className="sections-manager-add-tool"
            onClick={() => !hasReachedMaxSections && addNewSection()}
            title={
              hasReachedMaxSections
                ? `Maximum of ${PROJECT_LIMITS.maxSections} sections reached`
                : "Add New Section"
            }
            style={{
              pointerEvents: hasReachedMaxSections ? "none" : "auto",
              opacity: hasReachedMaxSections ? 0.5 : 1,
            }}
          >
            ➕
          </span>
        </div>

        <div className="section-manager-content">
          <ul className="sections-manager-list">
            <li
              key={SETTINGS_SECTION_KEY}
              className={`sections-manager-item sections-manager-item-locked ${
                selectedSectionIndex === SETTINGS_SECTION_KEY
                  ? "sections-manager-item-selected"
                  : ""
              }`}
              onClick={() => {
                setSelectedSectionIndex(SETTINGS_SECTION_KEY);
                setSelectedInputIndex(null);
              }}
              title="Project Settings"
            >
              <div className="sections-manager-item-content">
                <span className="sections-manager-bullet">•</span>
                <span className="sections-manager-name">Project Settings</span>
              </div>
            </li>

            <li
              key={GEOMETRY_SECTION_KEY}
              className={`sections-manager-item sections-manager-item-locked ${
                selectedSectionIndex === GEOMETRY_SECTION_KEY
                  ? "sections-manager-item-selected"
                  : ""
              }`}
              onClick={() => {
                setSelectedSectionIndex(GEOMETRY_SECTION_KEY);
                setSelectedInputIndex(null);
              }}
              title="Geometry Settings"
            >
              <div className="sections-manager-item-content">
                <span className="sections-manager-bullet">•</span>
                <span className="sections-manager-name">Geometry</span>
              </div>
            </li>

            <li
              key={TIME_SECTION_KEY}
              className={`sections-manager-item sections-manager-item-locked ${
                selectedSectionIndex === TIME_SECTION_KEY
                  ? "sections-manager-item-selected"
                  : ""
              }`}
              onClick={() => {
                setSelectedSectionIndex(TIME_SECTION_KEY);
                setSelectedInputIndex(null);
              }}
              title="Time Settings"
            >
              <div className="sections-manager-item-content">
                <span className="sections-manager-bullet">•</span>
                <span className="sections-manager-name">Time</span>
              </div>
            </li>

            {draftSchema.sections.map((section, index) => {
              const isLocked = isLockedSectionIndex(index);

              const canMoveUp =
                !isLocked && index > 0 && !isLockedSectionIndex(index - 1);

              const canMoveDown =
                !isLocked &&
                index < draftSchema.sections.length - 1 &&
                !isLockedSectionIndex(index + 1);

              return (
                <li
                  key={section.id}
                  className={`sections-manager-item ${
                    selectedSectionIndex === index
                      ? "sections-manager-item-selected"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedSectionIndex(index);
                    setSelectedInputIndex(null);
                  }}
                >
                  <div className="sections-manager-item-content">
                    <span className="sections-manager-bullet">•</span>
                    <input
                      className="sections-manager-name"
                      type="text"
                      value={section.name}
                      maxLength={32}
                      onChange={(e) => handleRenameSection(e, index)}
                      onKeyDown={handleRenameSectionKeyDown}
                      readOnly={isLocked}
                      disabled={isLocked}
                      title={isLocked ? "This section is required." : ""}
                    />
                  </div>

                  <div className="sections-manager-actions">
                    {canMoveUp ? (
                      <span
                        className="sections-manager-reorder"
                        onClick={(e) => handleMoveSection(e, index, -1)}
                        title="Move Section Up"
                      >
                        ▲
                      </span>
                    ) : (
                      <span
                        className="sections-manager-reorder sections-manager-reorder-placeholder"
                        aria-hidden="true"
                      >
                        ▲
                      </span>
                    )}

                    {canMoveDown ? (
                      <span
                        className="sections-manager-reorder"
                        onClick={(e) => handleMoveSection(e, index, 1)}
                        title="Move Section Down"
                      >
                        ▼
                      </span>
                    ) : (
                      <span
                        className="sections-manager-reorder sections-manager-reorder-placeholder"
                        aria-hidden="true"
                      >
                        ▼
                      </span>
                    )}

                    {!isLocked ? (
                      <span
                        className="sections-manager-delete"
                        onClick={(e) => handleDeleteSection(e, index)}
                        title="Delete Section"
                      >
                        −
                      </span>
                    ) : (
                      <span
                        className="sections-manager-delete sections-manager-delete-placeholder"
                        aria-hidden="true"
                      >
                        −
                      </span>
                    )}
                  </div>
                </li>
              );
            })}

            {draftSchema.extensions && (
              <li
                key={EXTENSIONS_SECTION_KEY}
                className={`sections-manager-item sections-manager-item-locked ${
                  selectedSectionIndex === EXTENSIONS_SECTION_KEY
                    ? "sections-manager-item-selected"
                    : ""
                }`}
                onClick={() => {
                  setSelectedSectionIndex(EXTENSIONS_SECTION_KEY);
                  setSelectedInputIndex(null);
                }}
                title="Engine extensions"
              >
                <div className="sections-manager-item-content">
                  <span className="sections-manager-bullet">•</span>
                  <span className="sections-manager-name">Extensions</span>
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="add-section-container">
        <div className="section-header">
          <h2>Predefined Sections</h2>
        </div>

        <div className="add-section-sub-container">
          <div className="add-section-list">
            {availablePredefinedSections.length === 0 ? (
              <div className="add-section-toolbar add-section-toolbar-empty">
                <span className="add-section-toolbar-title">
                  All predefined sections have been added
                </span>
              </div>
            ) : (
              availablePredefinedSections.map((sectionDef) => (
                <div className="add-section-toolbar" key={sectionDef.key}>
                  <span className="add-section-toolbar-title">
                    {sectionDef.label}
                  </span>

                  <span
                    className="add-section-add-tool"
                    onClick={() =>
                      !hasReachedMaxSections &&
                      addPredefinedSection(sectionDef.key)
                    }
                    title={
                      hasReachedMaxSections
                        ? `Maximum of ${PROJECT_LIMITS.maxSections} sections reached`
                        : `Add ${sectionDef.label}`
                    }
                    style={{
                      pointerEvents: hasReachedMaxSections ? "none" : "auto",
                      opacity: hasReachedMaxSections ? 0.5 : 1,
                    }}
                  >
                    ➕
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div
        className={`add-input-container ${
          isAddInputDisabled ? "add-input-container-disabled" : ""
        }`}
      >
        <div className="section-header">
          <h2>Add Input</h2>
        </div>

        <div className="add-input-sub-container">
          <div className="add-input-list">
            {addableInputTypes.map((type) => {
              const isInputLimitDisabled =
                !isAddInputDisabled && hasReachedMaxInputsForSelectedSection;

              return (
                <div
                  className={`add-input-toolbar ${
                    isAddInputDisabled || isInputLimitDisabled
                      ? "add-input-toolbar-disabled"
                      : ""
                  }`}
                  key={type}
                >
                  <span className="add-input-toolbar-title">
                    {getTypeLabel(type)}
                  </span>

                  <span
                    className="add-input-add-tool"
                    onClick={() =>
                      !isAddInputDisabled &&
                      !isInputLimitDisabled &&
                      addInputToCurrentSection(type)
                    }
                    title={
                      isSettingsSelected
                        ? "Inputs cannot be added to Project Settings"
                        : isGeometrySelected
                          ? "Inputs cannot be added to Geometry"
                          : isTimeSelected
                            ? "Inputs cannot be added to Time"
                            : isExtensionsSelected
                              ? "Inputs cannot be added to Extensions"
                              : isSelectedPredefinedSection
                                ? "Inputs cannot be added to predefined sections"
                                : isInputLimitDisabled
                                  ? `Maximum of ${SECTION_LIMITS.maxInputs} inputs reached for this section`
                                  : `Add ${getTypeLabel(type)}`
                    }
                    style={{
                      pointerEvents:
                        isAddInputDisabled || isInputLimitDisabled
                          ? "none"
                          : "auto",
                      opacity:
                        isAddInputDisabled || isInputLimitDisabled ? 0.5 : 1,
                    }}
                  >
                    ➕
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SchemaLeftColumn;
