import { renderTextInput } from "../inputs/Text.jsx";
import { renderNotesInput } from "../inputs/Notes.jsx";
import { renderPhoneNumberInput } from "../inputs/PhoneNumber.jsx";
import { renderEmailInput } from "../inputs/Email.jsx";
import { renderWebsiteInput } from "../inputs/Website.jsx";
import { renderNumberInput } from "../inputs/Number.jsx";
import { renderPercentageInput } from "../inputs/Percentage.jsx";
import { renderCapacityInput } from "../inputs/Capacity.jsx";
import { renderCheckboxInput } from "../inputs/Checkbox.jsx";
import { renderDropdownInput } from "../inputs/Dropdown.jsx";
import { renderHoursInput } from "../inputs/Hours.jsx";
import { renderAgeRangeInput } from "../inputs/AgeRange.jsx";
import { renderPriceRangeArrayInput } from "../inputs/PriceRangeArray.jsx";
import { renderTagListInput } from "../inputs/TagList.jsx";
import { renderCheckboxGateSection } from "../conditionalSections/checkboxGateRenderer.jsx";

export function renderSection({
  section,
  sectionIndex,
  formData,
  setFormData,
  tagInputDrafts,
  setTagInputDrafts,
  priceRangeDrafts,
  setPriceRangeDrafts,
}) {
  if (
    !section ||
    !formData ||
    !Array.isArray(formData.sections)
  ) {
    return null;
  }

  if (
    section.conditionalSection ===
    "checkboxGate"
  ) {
    return renderCheckboxGateSection({
      section,
      sectionIndex,
      formData,
      setFormData,
      tagInputDrafts,
      setTagInputDrafts,
      priceRangeDrafts,
      setPriceRangeDrafts,
      renderStandardSectionInput,
    });
  }

  return (
    <div
      role="region"
      aria-labelledby={`section-title-${section.id}`}
      className="section"
    >
      <h3
        id={`section-title-${section.id}`}
      >
        {section.name}
      </h3>

      {section.inputs.map(
        (input, inputIndex) =>
          renderStandardSectionInput({
            input,
            inputIndex,
            sectionIndex,
            formData,
            setFormData,
            tagInputDrafts,
            setTagInputDrafts,
            priceRangeDrafts,
            setPriceRangeDrafts,
          }),
      )}
    </div>
  );
}

export function renderStandardSectionInput({
  input,
  inputIndex,
  sectionIndex,
  formData,
  setFormData,
  tagInputDrafts,
  setTagInputDrafts,
  priceRangeDrafts,
  setPriceRangeDrafts,
}) {
  const stored =
    formData.sections?.[
      sectionIndex
    ]?.inputs?.[inputIndex];

  const inputValue =
    stored?.value;

  if (input.type === "text") {
    return renderTextInput({
      input,
      inputValue,
      sectionIndex,
      inputIndex,
      setFormData,
    });
  }

  if (input.type === "notes") {
    return renderNotesInput({
      input,
      inputValue,
      sectionIndex,
      inputIndex,
      setFormData,
    });
  }

  if (input.type === "phoneNumber") {
    return renderPhoneNumberInput({
      input,
      inputValue,
      sectionIndex,
      inputIndex,
      setFormData,
    });
  }

  if (input.type === "email") {
    return renderEmailInput({
      input,
      inputValue,
      sectionIndex,
      inputIndex,
      setFormData,
    });
  }

  if (input.type === "website") {
    return renderWebsiteInput({
      input,
      inputValue,
      sectionIndex,
      inputIndex,
      setFormData,
    });
  }

  if (input.type === "number") {
    return renderNumberInput({
      input,
      stored,
      sectionIndex,
      inputIndex,
      setFormData,
    });
  }

  if (input.type === "percentage") {
    return renderPercentageInput({
      input,
      stored,
      sectionIndex,
      inputIndex,
      setFormData,
    });
  }

  if (input.type === "capacity") {
    return renderCapacityInput({
      input,
      stored,
      sectionIndex,
      inputIndex,
      setFormData,
    });
  }

  if (input.type === "checkbox") {
    return renderCheckboxInput({
      input,
      stored,
      sectionIndex,
      inputIndex,
      setFormData,
    });
  }

  if (input.type === "dropdown") {
    return renderDropdownInput({
      input,
      inputValue,
      sectionIndex,
      inputIndex,
      setFormData,
    });
  }

  if (input.type === "hours") {
    return renderHoursInput({
      input,
      formData,
      setFormData,
      sectionIndex,
      inputIndex,
    });
  }

  if (input.type === "ageRange") {
    return renderAgeRangeInput({
      input,
      stored,
      inputIndex,
      sectionIndex,
      setFormData,
    });
  }

  if (
    input.type ===
    "priceRangeArray"
  ) {
    return renderPriceRangeArrayInput({
      input,
      stored,
      inputIndex,
      sectionIndex,
      formData,
      setFormData,
      priceRangeDrafts,
      setPriceRangeDrafts,
    });
  }

  if (input.type === "tagList") {
    return renderTagListInput({
      input,
      stored,
      sectionIndex,
      inputIndex,
      setFormData,
      tagInputDrafts,
      setTagInputDrafts,
    });
  }

  return null;
}

export default renderSection;