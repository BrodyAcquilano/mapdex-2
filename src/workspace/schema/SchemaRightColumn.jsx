// src/workspace/schema/SchemaRightColumn.jsx

import "./Schema.css";
import { GalleryExtensionConfigurator } from "./schemaBuilder/extensionConfigurators/GalleryExtensionConfigurator.jsx";
import { GuestbookExtensionConfigurator } from "./schemaBuilder/extensionConfigurators/GuestbookExtensionConfigurator.jsx";
import { BulletinConfigurator } from "./schemaBuilder/extensionConfigurators/BulletinConfigurator.jsx";
import { ChatConfigurator } from "./schemaBuilder/extensionConfigurators/ChatConfigurator.jsx";
import ProjectSettingsConfigurator from "./schemaBuilder/projectConfigurators/ProjectSettingsConfigurator.jsx";
import GeometryConfigurator from "./schemaBuilder/geometryConfigurators/GeometryConfigurator.jsx";
import TimeConfigurator from "./schemaBuilder/timeConfigurators/TimeConfigurator.jsx";
import TextConfigurator from "./schemaBuilder/inputConfigurators/TextConfigurator.jsx";
import NumberConfigurator from "./schemaBuilder/inputConfigurators/NumberConfigurator.jsx";
import PercentageConfigurator from "./schemaBuilder/inputConfigurators/PercentageConfigurator.jsx";
import WebsiteConfigurator from "./schemaBuilder/inputConfigurators/WebsiteConfigurator.jsx";
import PhoneConfigurator from "./schemaBuilder/inputConfigurators/PhoneConfigurator.jsx";
import EmailConfigurator from "./schemaBuilder/inputConfigurators/EmailConfigurator.jsx";
import CheckboxConfigurator from "./schemaBuilder/inputConfigurators/CheckboxConfigurator.jsx";
import DropdownConfigurator from "./schemaBuilder/inputConfigurators/DropdownConfigurator.jsx";
import NotesConfigurator from "./schemaBuilder/inputConfigurators/NotesConfigurator.jsx";
import CapacityConfigurator from "./schemaBuilder/inputConfigurators/CapacityConfigurator.jsx";
import HoursConfigurator from "./schemaBuilder/inputConfigurators/HoursConfigurator.jsx";
import AgeRangeConfigurator from "./schemaBuilder/inputConfigurators/AgeRangeConfigurator.jsx";
import PriceRangeConfigurator from "./schemaBuilder/inputConfigurators/PriceRangeConfigurator.jsx";
import TagListConfigurator from "./schemaBuilder/inputConfigurators/TagListConfigurator.jsx";
import { createSchemaMutators } from "./schemaBuilder/schemaMutators/schemaMutators.js";
import { getSectionDefinition } from "./schemaBuilder/sectionsLibrary/index.js";

function getInputTypeLabel(type) {
  if (type === "ageRange") return "Age Range";
  if (type === "phoneNumber") return "Phone Number";
  if (type === "priceRangeArray") return "Price Range Array";
  if (type === "tagList") return "Tag List";

  if (!type) return "Unknown";

  return type.charAt(0).toUpperCase() + type.slice(1);
}

function SchemaRightColumn({
  draftSchema,
  setDraftSchema,
  selectedSectionIndex,
  selectedInputIndex,
  previewTextSettings,
  setPreviewTextSettings,
  schemaRules,
  extensions,
  geometryTypes,
  SETTINGS_SECTION_KEY,
  GEOMETRY_SECTION_KEY,
  TIME_SECTION_KEY,
  EXTENSIONS_SECTION_KEY,
}) {
  const isSettingsSection = selectedSectionIndex === SETTINGS_SECTION_KEY;
  const isGeometrySection = selectedSectionIndex === GEOMETRY_SECTION_KEY;
  const isTimeSection = selectedSectionIndex === TIME_SECTION_KEY;
  const isExtensionsSection = selectedSectionIndex === EXTENSIONS_SECTION_KEY;

  const selectedSection =
    typeof selectedSectionIndex === "number"
      ? (draftSchema.sections?.[selectedSectionIndex] ?? null)
      : null;

  const selectedSectionDefinition = selectedSection?.systemKey
    ? getSectionDefinition(selectedSection.systemKey)
    : null;

  const selectedSectionLockedInputs =
    selectedSectionDefinition?.schemaRules?.lockedInputs || [];

  const currentInput =
    !isSettingsSection &&
    !isGeometrySection &&
    !isTimeSection &&
    !isExtensionsSection &&
    selectedSection &&
    selectedInputIndex !== null
      ? (selectedSection.inputs?.[selectedInputIndex] ?? null)
      : null;

  const isInputSelected = !!currentInput;

  const lockedInputs = schemaRules?.lockedInputs || [];
  const lockedExtensions = extensions || {};
  const geometryLockedFields = schemaRules?.geometryLockedFields || [];
  const timeLockedFields = schemaRules?.timeLockedFields || [];

  function getLockedRule() {
    if (!isInputSelected) return null;

    const engineRule =
      lockedInputs.find(
        (r) =>
          r.sectionIndex === selectedSectionIndex &&
          r.inputIndex === selectedInputIndex,
      ) || null;

    if (engineRule) return engineRule;

    const sectionRule =
      selectedSectionLockedInputs.find(
        (r) => r.inputIndex === selectedInputIndex,
      ) || null;

    return sectionRule;
  }

  function isLockedField(fieldName) {
    const rule = getLockedRule();
    const lockedFields = rule?.lockedFields || [];
    return lockedFields.includes(fieldName);
  }

  const safeArr = (v) => (Array.isArray(v) ? v : []);

  function renderPreviewTextSelect(inputType) {
    const previewDisabled =
      inputType === "ageRange" ||
      inputType === "notes" ||
      inputType === "priceRangeArray" ||
      inputType === "hours" ||
      inputType === "tagList";

    return (
      <label className="input-configurator-option">
        Preview Text:
        <select
          value={
            previewTextSettings[
              `${selectedSectionIndex}_${selectedInputIndex}`
            ] || "none"
          }
          onChange={(e) => {
            const newSettings = { ...previewTextSettings };
            newSettings[`${selectedSectionIndex}_${selectedInputIndex}`] =
              e.target.value;
            setPreviewTextSettings(newSettings);
          }}
          disabled={previewDisabled}
          title={
            previewDisabled
              ? "This input type can't be used in preview text."
              : ""
          }
        >
          <option value="none">Not in Preview Text</option>
          <option value="value">Value</option>
          <option value="labelValue">Label: Value</option>
        </select>
      </label>
    );
  }

  const mutators = createSchemaMutators({
    schema: draftSchema,
    setSchema: setDraftSchema,
    selectedSectionIndex,
    selectedInputIndex,
    isLockedField,
    safeArr,
  });

  const {
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
    handleNotesChange,
    handleDisplayModeChange,
    handleFalseDisplayTextChange,
    handleTrueDisplayTextChange,
    handleAddDropdownOption,
    handleDropdownOptionRename,
    handleDeleteDropdownOption,
    handleAddAgeModeOption,
    handleDeleteAgeModeOption,
    handleAddPriceCategory,
    handleRenamePriceCategory,
    handlePriceCategoryBlur,
    handleDeletePriceCategory,
    handleAddPriceMode,
    handleDeletePriceMode,
    handlePriceMinValueChange,
    handlePriceMinValueBlur,
    handlePriceMaxValueChange,
    handlePriceMaxValueBlur,
    handleAddUnit,
    handleRenameUnit,
    handleUnitBlur,
    handleDeleteUnit,
    handleAddModeOption,
    handleDeleteModeOption,
    handleAddCapacityModeOption,
    handleDeleteCapacityModeOption,
    handleAddDefaultTag,
    handleRenameDefaultTag,
    handleDefaultTagBlur,
    handleDeleteDefaultTag,
  } = mutators;

  if (isSettingsSection) {
    return (
      <div className="schema-column-right">
        <div className="section-header">
          <h2>Input Configurator</h2>
        </div>

        <div className="input-configurator-toolbar">
          <span className="input-configurator-toolbar-title">
            Project Settings
          </span>
        </div>

        <div className="input-configurator-content">
          <ProjectSettingsConfigurator
            draftSchema={draftSchema}
            setDraftSchema={setDraftSchema}
          />
        </div>
      </div>
    );
  }

  if (isGeometrySection) {
    return (
      <div className="schema-column-right">
        <div className="section-header">
          <h2>Input Configurator</h2>
        </div>

        <div className="input-configurator-toolbar">
          <span className="input-configurator-toolbar-title">
            Geometry Settings
          </span>
        </div>

        <div className="input-configurator-content">
          <GeometryConfigurator
            geometry={draftSchema.geometry}
            geometryTypes={geometryTypes}
            setDraftSchema={setDraftSchema}
            lockedFields={geometryLockedFields}
          />
        </div>
      </div>
    );
  }

  if (isTimeSection) {
    return (
      <div className="schema-column-right">
        <div className="section-header">
          <h2>Input Configurator</h2>
        </div>

        <div className="input-configurator-toolbar">
          <span className="input-configurator-toolbar-title">
            Time Settings
          </span>
        </div>

        <div className="input-configurator-content">
          <TimeConfigurator
            time={draftSchema.time}
            setDraftSchema={setDraftSchema}
            lockedFields={timeLockedFields}
          />
        </div>
      </div>
    );
  }

  if (isExtensionsSection) {
    const extensionKey = selectedInputIndex;
    const extension = draftSchema.extensions?.[extensionKey];
    const rules = lockedExtensions[extensionKey];
    const isConfigurable = rules?.configurable === true;

    return (
      <div className="schema-column-right">
        <div className="section-header">
          <h2>Input Configurator</h2>
        </div>

        {!extensionKey || !extension ? (
          <div className="input-configurator-toolbar">
            <span className="input-configurator-toolbar-title">
              No Input Selected
            </span>
          </div>
        ) : (
          <>
            <div className="input-configurator-toolbar">
              <span className="input-configurator-toolbar-title">
                {extensionKey.charAt(0).toUpperCase() + extensionKey.slice(1)}
              </span>
            </div>

            <div className="input-configurator-content">
              {extensionKey === "Guestbook" && (
                <GuestbookExtensionConfigurator
                  extension={extension}
                  setSchema={setDraftSchema}
                  disabled={!isConfigurable}
                />
              )}

              {extensionKey === "Gallery" && (
                <GalleryExtensionConfigurator
                  extension={extension}
                  setSchema={setDraftSchema}
                  disabled={!isConfigurable}
                />
              )}

              {extensionKey === "Bulletin" && (
                <BulletinConfigurator
                  extension={extension}
                  setSchema={setDraftSchema}
                  disabled={!isConfigurable}
                />
              )}

              {extensionKey === "Chat" && (
                <ChatConfigurator
                  extension={extension}
                  setSchema={setDraftSchema}
                  disabled={!isConfigurable}
                />
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="schema-column-right">
      <div className="section-header">
        <h2>Input Configurator</h2>
      </div>

      {!isInputSelected ? (
        <div className="input-configurator-toolbar">
          <span className="input-configurator-toolbar-title">
            No Input Selected
          </span>
        </div>
      ) : (
        <div className="input-configurator-toolbar">
          <span className="input-configurator-toolbar-title">
            {currentInput?.label || "Selected Input"}
          </span>
        </div>
      )}

      <div className="input-configurator-content">
        {isInputSelected && currentInput && (
          <>
            <div className="input-configurator-type">
              <span className="input-configurator-type-label">Input Type:</span>
              <span className="input-configurator-type-value">
                {getInputTypeLabel(currentInput.type)}
              </span>
            </div>

            {currentInput.type === "text" && (
              <TextConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleMaxLengthChange={handleMaxLengthChange}
                handleMaxLengthBlur={handleMaxLengthBlur}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "number" && (
              <NumberConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleMinValueChange={handleMinValueChange}
                handleMinValueBlur={handleMinValueBlur}
                handleMaxValueChange={handleMaxValueChange}
                handleMaxValueBlur={handleMaxValueBlur}
                handleMaxLengthChange={handleMaxLengthChange}
                handleMaxLengthBlur={handleMaxLengthBlur}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                handleAddModeOption={handleAddModeOption}
                handleDeleteModeOption={handleDeleteModeOption}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "percentage" && (
              <PercentageConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleMinValueChange={handleMinValueChange}
                handleMinValueBlur={handleMinValueBlur}
                handleMaxValueChange={handleMaxValueChange}
                handleMaxValueBlur={handleMaxValueBlur}
                handleMaxLengthChange={handleMaxLengthChange}
                handleMaxLengthBlur={handleMaxLengthBlur}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                handleAddModeOption={handleAddModeOption}
                handleDeleteModeOption={handleDeleteModeOption}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "website" && (
              <WebsiteConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleMaxLengthChange={handleMaxLengthChange}
                handleMaxLengthBlur={handleMaxLengthBlur}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "phoneNumber" && (
              <PhoneConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleMaxLengthChange={handleMaxLengthChange}
                handleMaxLengthBlur={handleMaxLengthBlur}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "email" && (
              <EmailConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleMaxLengthChange={handleMaxLengthChange}
                handleMaxLengthBlur={handleMaxLengthBlur}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "checkbox" && (
              <CheckboxConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleDisplayModeChange={handleDisplayModeChange}
                handleTrueDisplayTextChange={handleTrueDisplayTextChange}
                handleFalseDisplayTextChange={handleFalseDisplayTextChange}
                handleNotesChange={handleNotesChange}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "dropdown" && (
              <DropdownConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                handleDropdownOptionRename={handleDropdownOptionRename}
                handleDeleteDropdownOption={handleDeleteDropdownOption}
                handleAddDropdownOption={handleAddDropdownOption}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "notes" && (
              <NotesConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleMaxLengthChange={handleMaxLengthChange}
                handleMaxLengthBlur={handleMaxLengthBlur}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "capacity" && (
              <CapacityConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleMinValueChange={handleMinValueChange}
                handleMinValueBlur={handleMinValueBlur}
                handleMaxValueChange={handleMaxValueChange}
                handleMaxValueBlur={handleMaxValueBlur}
                handleMaxLengthChange={handleMaxLengthChange}
                handleMaxLengthBlur={handleMaxLengthBlur}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                handleAddCapacityModeOption={handleAddCapacityModeOption}
                handleDeleteCapacityModeOption={handleDeleteCapacityModeOption}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "hours" && (
              <HoursConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "ageRange" && (
              <AgeRangeConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleMinValueChange={handleMinValueChange}
                handleMinValueBlur={handleMinValueBlur}
                handleMaxValueChange={handleMaxValueChange}
                handleMaxValueBlur={handleMaxValueBlur}
                handleMaxLengthChange={handleMaxLengthChange}
                handleMaxLengthBlur={handleMaxLengthBlur}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                handleAddAgeModeOption={handleAddAgeModeOption}
                handleDeleteAgeModeOption={handleDeleteAgeModeOption}
                renderPreviewTextSelect={renderPreviewTextSelect}
              />
            )}

            {currentInput.type === "priceRangeArray" && (
              <PriceRangeConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handlePriceMinValueChange={handlePriceMinValueChange}
                handlePriceMinValueBlur={handlePriceMinValueBlur}
                handlePriceMaxValueChange={handlePriceMaxValueChange}
                handlePriceMaxValueBlur={handlePriceMaxValueBlur}
                handleMaxLengthChange={handleMaxLengthChange}
                handleMaxLengthBlur={handleMaxLengthBlur}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                handleAddPriceCategory={handleAddPriceCategory}
                handleRenamePriceCategory={handleRenamePriceCategory}
                handlePriceCategoryBlur={handlePriceCategoryBlur}
                handleDeletePriceCategory={handleDeletePriceCategory}
                handleAddPriceMode={handleAddPriceMode}
                handleDeletePriceMode={handleDeletePriceMode}
                handleAddUnit={handleAddUnit}
                handleRenameUnit={handleRenameUnit}
                handleUnitBlur={handleUnitBlur}
                handleDeleteUnit={handleDeleteUnit}
                safeArr={safeArr}
                renderPreviewTextSelect={renderPreviewTextSelect}
                engineKey={draftSchema.engineKey}
              />
            )}

            {currentInput.type === "tagList" && (
              <TagListConfigurator
                currentInput={currentInput}
                toggleOption={toggleOption}
                isLockedField={isLockedField}
                handleMaxLengthChange={handleMaxLengthChange}
                handleMaxLengthBlur={handleMaxLengthBlur}
                handleMaxItemsChange={handleMaxItemsChange}
                handleMaxItemsBlur={handleMaxItemsBlur}
                handleEmptyDisplayTextChange={handleEmptyDisplayTextChange}
                handleAddDefaultTag={handleAddDefaultTag}
                handleRenameDefaultTag={handleRenameDefaultTag}
                handleDefaultTagBlur={handleDefaultTagBlur}
                handleDeleteDefaultTag={handleDeleteDefaultTag}
                renderPreviewTextSelect={renderPreviewTextSelect}
                engineKey={draftSchema.engineKey}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SchemaRightColumn;
