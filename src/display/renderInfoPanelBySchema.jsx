import { renderUserSection } from "./user/UserRenderer.jsx";
import renderGeometrySection from "./geometry/GeometryRenderer.jsx";
import TimeRenderer from "./time/TimeRenderer.jsx";
import { renderAnalysisSection } from "./analysis/AnalysisRenderer.jsx";
import renderExtensionsSection from "./extensions/ExtensionRenderer.jsx";

import { renderCheckboxGateSection } from "./conditionalSections/CheckboxGate.jsx";

import { renderTextInput } from "./inputs/Text.jsx";
import { renderNumberInput } from "./inputs/Number.jsx";
import { renderPercentageInput } from "./inputs/Percentage.jsx";
import { renderCapacityInput } from "./inputs/Capacity.jsx";
import { renderWebsiteInput } from "./inputs/Website.jsx";
import { renderPhoneNumberInput } from "./inputs/PhoneNumber.jsx";
import { renderEmailInput } from "./inputs/Email.jsx";
import { renderNotesInput } from "./inputs/Notes.jsx";
import { renderHoursInput } from "./inputs/Hours.jsx";
import { renderCheckboxInput } from "./inputs/Checkbox.jsx";
import { renderDropdownInput } from "./inputs/Dropdown.jsx";
import { renderAgeRangeInput } from "./inputs/AgeRange.jsx";
import { renderPriceRangeArrayInput } from "./inputs/PriceRangeArray.jsx";
import { renderTagListInput } from "./inputs/TagList.jsx";

export function renderInfoPanelBySchema(
  selectedDataItem,
  schema,
  viewerTimeZone,
  onOpenExtension,
  currentPage,
  analysisResult,
  displayTimeMode,
  setDisplayTimeMode,
  overrideTimeZone,
  setOverrideTimeZone,
) {
  if (!selectedDataItem || !schema) return null;

  const renderedBlocks = [];

  const userBlock = renderUserSection(selectedDataItem, schema);
  if (userBlock) renderedBlocks.push(userBlock);

  const geometryBlock = renderGeometrySection(selectedDataItem, schema);
  if (geometryBlock) renderedBlocks.push(geometryBlock);

  renderedBlocks.push(
    <TimeRenderer
      key="time-block"
      selectedDataItem={selectedDataItem}
      schema={schema}
      viewerTimeZone={viewerTimeZone}
      displayTimeMode={displayTimeMode}
      setDisplayTimeMode={setDisplayTimeMode}
      overrideTimeZone={overrideTimeZone}
      setOverrideTimeZone={setOverrideTimeZone}
    />,
  );

  const sectionBlocks = renderSchemaSections(selectedDataItem, schema);
  if (sectionBlocks.length) renderedBlocks.push(...sectionBlocks);

  const extensionsBlock = renderExtensionsSection(
    selectedDataItem,
    onOpenExtension,
  );
  if (extensionsBlock) renderedBlocks.push(extensionsBlock);

  if (currentPage === "analysis") {
    const analysisBlock = renderAnalysisSection(
      selectedDataItem,
      schema,
      analysisResult,
    );
    if (analysisBlock) renderedBlocks.push(analysisBlock);
  }

  return renderedBlocks;
}

function renderSchemaSections(selectedDataItem, schema) {
  if (!selectedDataItem || !schema?.sections) return [];

  const renderedSections = [];

  for (const dataSection of selectedDataItem.sections || []) {
    const sectionIndex = selectedDataItem.sectionIndexById?.get(dataSection.id);
    if (sectionIndex == null) continue;

    const schemaSection = schema.sections[sectionIndex];
    if (!schemaSection) continue;

    if (schemaSection.conditionalSection === "checkboxGate") {
      const renderedConditionalSection = renderCheckboxGateSection({
        selectedDataItem,
        dataSection,
        schemaSection,
        shouldDisplayInfoInput,
        renderInfoInput,
      });

      if (renderedConditionalSection) {
        renderedSections.push(renderedConditionalSection);
      }

      continue;
    }

    const renderedInputs = [];

    for (const dataInput of dataSection.inputs || []) {
      const loc = selectedDataItem.inputIndexById?.get(dataInput.id);
      if (!loc) continue;

      const { sectionIndex: sIdx, inputIndex: iIdx } = loc;
      const schemaInput = schema.sections[sIdx]?.inputs?.[iIdx];
      if (!schemaInput) continue;

      if (!shouldDisplayInfoInput(schemaInput, dataInput)) continue;

      const rendered = renderInfoInput(schemaInput, dataInput);

      if (rendered) renderedInputs.push(rendered);
    }

    if (!renderedInputs.length) continue;

    renderedSections.push(
      <div key={schemaSection.id} className="section">
        <h3>{schemaSection.name}</h3>
        {renderedInputs}
      </div>,
    );
  }

  return renderedSections;
}

export function shouldDisplayInfoInput(schemaInput, dataInput) {
  let shouldDisplay = false;

  const controlledByIsDisplayed =
    schemaInput.type === "number" ||
    schemaInput.type === "percentage" ||
    schemaInput.type === "capacity" ||
    schemaInput.type === "text" ||
    schemaInput.type === "website" ||
    schemaInput.type === "phoneNumber" ||
    schemaInput.type === "email" ||
    schemaInput.type === "dropdown" ||
    schemaInput.type === "notes" ||
    schemaInput.type === "ageRange" ||
    schemaInput.type === "priceRangeArray" ||
    schemaInput.type === "hours" ||
    schemaInput.type === "tagList";

  if (controlledByIsDisplayed && !schemaInput.isDisplayed) {
    return false;
  }

  if (
    schemaInput.type === "number" ||
    schemaInput.type === "percentage" ||
    schemaInput.type === "capacity"
  ) {
    const allowedModes = Array.isArray(schemaInput.modeOptions)
      ? schemaInput.modeOptions
      : [];

    const mode = dataInput?.mode;
    const hasValue = mode !== "" && mode != null && allowedModes.includes(mode);

    if (hasValue || schemaInput.displayIfEmpty === true) {
      shouldDisplay = true;
    }
  } else if (schemaInput.type === "ageRange") {
    const allowedModes = Array.isArray(schemaInput.ageModeOptions)
      ? schemaInput.ageModeOptions
      : [];

    const mode = dataInput?.mode;
    const hasValue = mode !== "" && mode != null && allowedModes.includes(mode);

    if (hasValue || schemaInput.displayIfEmpty === true) {
      shouldDisplay = true;
    }
  } else if (schemaInput.type === "priceRangeArray") {
    const cats = dataInput?.categories;
    const hasValue =
      cats && typeof cats === "object" && Object.keys(cats).length > 0;

    if (hasValue || schemaInput.displayIfEmpty === true) {
      shouldDisplay = true;
    }
  } else if (schemaInput.type === "hours") {
    const openHours = dataInput?.openHours;

    const hasValue =
      openHours &&
      typeof openHours === "object" &&
      Object.values(openHours).some(
        (dayRows) =>
          Array.isArray(dayRows) &&
          dayRows.some((row) => {
            const hasOpen =
              typeof row?.open === "string" && row.open.trim() !== "";
            const hasClose =
              typeof row?.close === "string" && row.close.trim() !== "";
            return hasOpen && hasClose;
          }),
      );

    if (hasValue || schemaInput.displayIfEmpty === true) {
      shouldDisplay = true;
    }
  } else if (schemaInput.type === "tagList") {
    const tags = Array.isArray(dataInput?.tags)
      ? dataInput.tags.filter(
          (tag) => typeof tag === "string" && tag.trim() !== "",
        )
      : [];

    const hasValue = tags.length > 0;

    if (hasValue || schemaInput.displayIfEmpty === true) {
      shouldDisplay = true;
    }
  } else if (
    schemaInput.type === "text" ||
    schemaInput.type === "website" ||
    schemaInput.type === "phoneNumber" ||
    schemaInput.type === "email" ||
    schemaInput.type === "dropdown" ||
    schemaInput.type === "notes"
  ) {
    const hasValue =
      dataInput?.value !== "" &&
      dataInput?.value !== null &&
      dataInput?.value !== undefined;

    if (hasValue || schemaInput.displayIfEmpty === true) {
      shouldDisplay = true;
    }
  } else if (schemaInput.type === "checkbox") {
    if (
      schemaInput.isApplicableOption === true &&
      dataInput?.isApplicable === false
    ) {
      return false;
    }

    if (dataInput?.value === true) {
      shouldDisplay = schemaInput.displayWhenTrue !== "none";
    } else {
      shouldDisplay = schemaInput.displayWhenFalse !== "none";
    }
  }

  return shouldDisplay;
}

export function renderInfoInput(schemaInput, dataInput) {
  if (schemaInput.type === "checkbox") {
    return renderCheckboxInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "number") {
    return renderNumberInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "percentage") {
    return renderPercentageInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "capacity") {
    return renderCapacityInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "text") {
    return renderTextInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "website") {
    return renderWebsiteInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "phoneNumber") {
    return renderPhoneNumberInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "email") {
    return renderEmailInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "dropdown") {
    return renderDropdownInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "notes") {
    return renderNotesInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "hours") {
    return renderHoursInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "ageRange") {
    return renderAgeRangeInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "priceRangeArray") {
    return renderPriceRangeArrayInput(schemaInput, dataInput);
  }

  if (schemaInput.type === "tagList") {
    return renderTagListInput(schemaInput, dataInput);
  }

  return null;
}
