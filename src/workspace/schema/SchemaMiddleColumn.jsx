// src/workspace/schema/SchemaMiddleColumn.jsx

import "./Schema.css";
import { capitalizeFirstLetter } from "./schemaHelpers.js";
import { getSectionDefinition } from "./schemaBuilder/sectionsLibrary/index.js";

function remapPreviewTextSettingsForInputMove(
  previewTextSettings,
  sectionIndex,
  fromIndex,
  toIndex,
) {
  const nextSettings = {};

  Object.entries(previewTextSettings || {}).forEach(([key, value]) => {
    const [sStr, iStr] = key.split("_");
    const currentSectionIndex = Number(sStr);
    const inputIndex = Number(iStr);

    if (!Number.isFinite(currentSectionIndex) || !Number.isFinite(inputIndex)) {
      nextSettings[key] = value;
      return;
    }

    if (currentSectionIndex !== sectionIndex) {
      nextSettings[key] = value;
      return;
    }

    if (inputIndex === fromIndex) {
      nextSettings[`${sectionIndex}_${toIndex}`] = value;
      return;
    }

    if (inputIndex === toIndex) {
      nextSettings[`${sectionIndex}_${fromIndex}`] = value;
      return;
    }

    nextSettings[key] = value;
  });

  return nextSettings;
}

function getNextSelectedInputIndexAfterInputMove({
  selectedInputIndex,
  fromIndex,
  toIndex,
}) {
  if (typeof selectedInputIndex !== "number") {
    return selectedInputIndex;
  }

  if (selectedInputIndex === fromIndex) {
    return toIndex;
  }

  if (selectedInputIndex === toIndex) {
    return fromIndex;
  }

  return selectedInputIndex;
}

function SchemaMiddleColumn({
  draftSchema,
  setDraftSchema,
  selectedSectionIndex,
  selectedInputIndex,
  setSelectedInputIndex,
  schemaRules,
  extensions,
  previewTextSettings,
  setPreviewTextSettings,
  SETTINGS_SECTION_KEY,
  GEOMETRY_SECTION_KEY,
  TIME_SECTION_KEY,
  EXTENSIONS_SECTION_KEY,
}) {
  const lockedInputs = schemaRules?.lockedInputs || [];
  const lockedExtensions = extensions || {};

  const isSettingsSelected = selectedSectionIndex === SETTINGS_SECTION_KEY;
  const isGeometrySelected = selectedSectionIndex === GEOMETRY_SECTION_KEY;
  const isTimeSelected = selectedSectionIndex === TIME_SECTION_KEY;
  const isExtensionsSelected = selectedSectionIndex === EXTENSIONS_SECTION_KEY;

  const selectedSection =
    typeof selectedSectionIndex === "number"
      ? (draftSchema.sections?.[selectedSectionIndex] ?? null)
      : null;

  const selectedSectionDefinition = selectedSection?.systemKey
    ? getSectionDefinition(selectedSection.systemKey)
    : null;

  const selectedSectionLockedInputs =
    selectedSectionDefinition?.schemaRules?.lockedInputs || [];

  const isNoValidSectionSelected =
    !isSettingsSelected &&
    !isGeometrySelected &&
    !isTimeSelected &&
    !isExtensionsSelected &&
    !selectedSection;

  const isLockedInputIndex = (sectionIndex, inputIndex) =>
    lockedInputs.some(
      (rule) =>
        rule.sectionIndex === sectionIndex && rule.inputIndex === inputIndex,
    );

  const getSelectedSectionLockedInputRule = (inputIndex) =>
    selectedSectionLockedInputs.find(
      (rule) => rule.inputIndex === inputIndex,
    ) || null;

  const isInputLocked = (sectionIndex, inputIndex) => {
    if (isLockedInputIndex(sectionIndex, inputIndex)) return true;
    if (getSelectedSectionLockedInputRule(inputIndex)) return true;
    return false;
  };

  const isInputLabelLocked = (sectionIndex, inputIndex) => {
    if (isLockedInputIndex(sectionIndex, inputIndex)) return true;

    const lockedRule = getSelectedSectionLockedInputRule(inputIndex);
    if (!lockedRule) return false;

    return Array.isArray(lockedRule.lockedFields)
      ? lockedRule.lockedFields.includes("label")
      : false;
  };

  function handleRenameInput(e, index) {
    if (!selectedSection) return;

    const input = selectedSection.inputs?.[index];
    if (!input) return;

    if (isInputLabelLocked(selectedSectionIndex, index)) return;

    const updatedSections = [...draftSchema.sections];
    updatedSections[selectedSectionIndex].inputs[index].label = e.target.value;
    setDraftSchema({ ...draftSchema, sections: updatedSections });
  }

  function handleRenameGeometryLabel(e) {
    setDraftSchema({
      ...draftSchema,
      geometry: {
        ...draftSchema.geometry,
        label: e.target.value,
      },
    });
  }

  function handleRenameTimeLabel(e) {
    setDraftSchema({
      ...draftSchema,
      time: {
        ...draftSchema.time,
        label: e.target.value,
      },
    });
  }

  function handleRenameInputKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  }

  function handleMoveInput(e, index, direction) {
    e.stopPropagation();

    if (!selectedSection) return;
    if (selectedSection?.systemKey && selectedSectionDefinition) return;

    const inputs = Array.isArray(selectedSection.inputs)
      ? selectedSection.inputs
      : [];

    const toIndex = index + direction;

    if (index < 0 || index >= inputs.length) return;
    if (toIndex < 0 || toIndex >= inputs.length) return;

    // Locked inputs cannot move, and other inputs
    // cannot swap positions with a locked input.
    if (isInputLocked(selectedSectionIndex, index)) return;
    if (isInputLocked(selectedSectionIndex, toIndex)) return;

    const updatedSections = [...draftSchema.sections];
    const updatedInputs = [...inputs];

    [updatedInputs[index], updatedInputs[toIndex]] = [
      updatedInputs[toIndex],
      updatedInputs[index],
    ];

    updatedSections[selectedSectionIndex] = {
      ...updatedSections[selectedSectionIndex],
      inputs: updatedInputs,
    };

    setDraftSchema({
      ...draftSchema,
      sections: updatedSections,
    });

    setSelectedInputIndex(
      getNextSelectedInputIndexAfterInputMove({
        selectedInputIndex,
        fromIndex: index,
        toIndex,
      }),
    );

    setPreviewTextSettings(
      remapPreviewTextSettingsForInputMove(
        previewTextSettings,
        selectedSectionIndex,
        index,
        toIndex,
      ),
    );
  }

  function handleDeleteInput(e, index) {
    e.stopPropagation();
    if (!selectedSection) return;

    const input = selectedSection.inputs?.[index];
    if (!input) return;

    if (isInputLocked(selectedSectionIndex, index)) return;

    const updatedSections = [...draftSchema.sections];
    updatedSections[selectedSectionIndex].inputs = updatedSections[
      selectedSectionIndex
    ].inputs.filter((_, i) => i !== index);

    setDraftSchema({ ...draftSchema, sections: updatedSections });

    if (selectedInputIndex === index) {
      setSelectedInputIndex(null);
    } else if (selectedInputIndex > index) {
      setSelectedInputIndex(selectedInputIndex - 1);
    }

    const nextSettings = {};
    const removedKey = `${selectedSectionIndex}_${index}`;

    Object.entries(previewTextSettings || {}).forEach(([key, value]) => {
      if (key === removedKey) return;

      const [sStr, iStr] = key.split("_");
      const s = Number(sStr);
      const i = Number(iStr);

      if (!Number.isFinite(s) || !Number.isFinite(i)) {
        nextSettings[key] = value;
        return;
      }

      if (s !== selectedSectionIndex) {
        nextSettings[key] = value;
        return;
      }

      if (i > index) {
        nextSettings[`${s}_${i - 1}`] = value;
        return;
      }

      if (i < index) {
        nextSettings[key] = value;
      }
    });

    setPreviewTextSettings(nextSettings);
  }

  return (
    <div className="schema-column-middle">
      <div className="section-header">
        <h2>Schema Builder</h2>
      </div>

      {isNoValidSectionSelected ? (
        <div className="selected-section-content">
          <div className="selected-section-toolbar">
            <span className="selected-section-toolbar-title">
              No Section Selected
            </span>
          </div>
        </div>
      ) : isSettingsSelected ? (
        <>
          <div className="selected-section-toolbar">
            <span className="selected-section-toolbar-title">
              Project Settings
            </span>
          </div>

          <div className="selected-section-content">
            <ul className="selected-section-list">
              <li
                className={`selected-section-item ${
                  selectedInputIndex === 0
                    ? "selected-section-item-selected"
                    : ""
                }`}
                onClick={() => setSelectedInputIndex(0)}
              >
                <div className="selected-section-item-content">
                  <span className="selected-section-bullet">•</span>
                  <span
                    className="selected-section-label selected-section-label-locked"
                    title="Project settings"
                  >
                    Project Settings
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </>
      ) : isGeometrySelected ? (
        <>
          <div className="selected-section-toolbar">
            <span className="selected-section-toolbar-title">Geometry</span>
          </div>

          <div className="selected-section-content">
            <ul className="selected-section-list">
              <li
                className={`selected-section-item ${
                  selectedInputIndex === 0
                    ? "selected-section-item-selected"
                    : ""
                }`}
                onClick={() => setSelectedInputIndex(0)}
              >
                <div className="selected-section-item-content">
                  <span className="selected-section-bullet">•</span>
                  <input
                    className="selected-section-label"
                    type="text"
                    value={draftSchema.geometry?.label || "Geometry"}
                    maxLength={32}
                    onChange={handleRenameGeometryLabel}
                    onKeyDown={handleRenameInputKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    title="Geometry label"
                  />
                </div>
              </li>
            </ul>
          </div>
        </>
      ) : isTimeSelected ? (
        <>
          <div className="selected-section-toolbar">
            <span className="selected-section-toolbar-title">
              Time Settings
            </span>
          </div>

          <div className="selected-section-content">
            <ul className="selected-section-list">
              <li
                className={`selected-section-item ${
                  selectedInputIndex === 0
                    ? "selected-section-item-selected"
                    : ""
                }`}
                onClick={() => setSelectedInputIndex(0)}
              >
                <div className="selected-section-item-content">
                  <span className="selected-section-bullet">•</span>
                  <input
                    className="selected-section-label"
                    type="text"
                    value={draftSchema.time?.label || "Time"}
                    maxLength={32}
                    onChange={handleRenameTimeLabel}
                    onKeyDown={handleRenameInputKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    title="Time label"
                  />
                </div>
              </li>
            </ul>
          </div>
        </>
      ) : isExtensionsSelected ? (
        <>
          <div className="selected-section-toolbar">
            <span className="selected-section-toolbar-title">Extensions</span>
          </div>

          <div className="selected-section-content">
            <ul className="selected-section-list">
              {Object.entries(draftSchema.extensions || {}).map(([key]) => {
                const isLocked = lockedExtensions[key] !== undefined;

                return (
                  <li
                    key={key}
                    className={`selected-section-item ${
                      selectedInputIndex === key
                        ? "selected-section-item-selected"
                        : ""
                    }`}
                    onClick={() => setSelectedInputIndex(key)}
                  >
                    <div className="selected-section-item-content">
                      <span className="selected-section-bullet">•</span>
                      <span
                        className="selected-section-label selected-section-label-locked"
                        title={isLocked ? "Engine extension" : ""}
                      >
                        {capitalizeFirstLetter(key)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : (
        <>
          <div className="selected-section-toolbar">
            <span className="selected-section-toolbar-title">
              {selectedSection?.name || "Selected Section"}
            </span>
          </div>

          <div className="selected-section-content">
            <ul className="selected-section-list">
              {(selectedSection?.inputs || []).map((input, index) => {
                const isInputLockedForActions = isInputLocked(
                  selectedSectionIndex,
                  index,
                );

                const isLabelLocked = isInputLabelLocked(
                  selectedSectionIndex,
                  index,
                );

                const isSystemSection = Boolean(
                  selectedSection?.systemKey && selectedSectionDefinition,
                );

                const canMoveUp =
                  !isSystemSection &&
                  !isInputLockedForActions &&
                  index > 0 &&
                  !isInputLocked(selectedSectionIndex, index - 1);

                const canMoveDown =
                  !isSystemSection &&
                  !isInputLockedForActions &&
                  index < (selectedSection?.inputs || []).length - 1 &&
                  !isInputLocked(selectedSectionIndex, index + 1);

                return (
                  <li
                    key={input.id}
                    className={`selected-section-item ${
                      selectedInputIndex === index
                        ? "selected-section-item-selected"
                        : ""
                    }`}
                    onClick={() => setSelectedInputIndex(index)}
                  >
                    {!isSystemSection && (
                      <div className="selected-section-actions">
                        {!isInputLockedForActions ? (
                          <span
                            className="selected-section-delete"
                            onClick={(e) => handleDeleteInput(e, index)}
                            title="Delete Input"
                          >
                            −
                          </span>
                        ) : (
                          <span
                            className="selected-section-delete selected-section-delete-placeholder"
                            aria-hidden="true"
                          >
                            −
                          </span>
                        )}

                        {canMoveUp ? (
                          <span
                            className="selected-section-reorder"
                            onClick={(e) => handleMoveInput(e, index, -1)}
                            title="Move Input Up"
                          >
                            ▲
                          </span>
                        ) : (
                          <span
                            className="selected-section-reorder selected-section-reorder-placeholder"
                            aria-hidden="true"
                          >
                            ▲
                          </span>
                        )}

                        {canMoveDown ? (
                          <span
                            className="selected-section-reorder"
                            onClick={(e) => handleMoveInput(e, index, 1)}
                            title="Move Input Down"
                          >
                            ▼
                          </span>
                        ) : (
                          <span
                            className="selected-section-reorder selected-section-reorder-placeholder"
                            aria-hidden="true"
                          >
                            ▼
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      className={`selected-section-item-content ${
                        isSystemSection
                          ? "selected-section-item-content-system"
                          : ""
                      }`}
                    >
                      <span className="selected-section-bullet">•</span>
                      <input
                        className={`selected-section-label ${
                          isLabelLocked ? "selected-section-label-locked" : ""
                        }`}
                        type="text"
                        value={input.label}
                        maxLength={32}
                        onChange={(e) => handleRenameInput(e, index)}
                        onKeyDown={handleRenameInputKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        readOnly={isLabelLocked}
                        disabled={isLabelLocked}
                        title={isLabelLocked ? "This label is locked." : ""}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export default SchemaMiddleColumn;
