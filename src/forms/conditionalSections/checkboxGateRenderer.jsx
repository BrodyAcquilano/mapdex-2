import {
  resetCheckboxGateSecondaryInput,
  initializeCheckboxGateSecondaryInput,
} from "./checkboxGateHelpers.js";

export function renderCheckboxGateSection({
  section,
  sectionIndex,
  formData,
  setFormData,
  tagInputDrafts,
  setTagInputDrafts,
  priceRangeDrafts,
  setPriceRangeDrafts,
  renderStandardSectionInput,
}) {
  const primaryInputKeys = Array.isArray(
    section?.checkboxGateConfig?.primaryInputKeys,
  )
    ? section.checkboxGateConfig.primaryInputKeys
    : [];

  const secondaryInputMap =
    section?.checkboxGateConfig?.secondaryInputMap &&
    typeof section.checkboxGateConfig.secondaryInputMap === "object"
      ? section.checkboxGateConfig.secondaryInputMap
      : {};

  const inputIndexByKey = new Map();

  section.inputs.forEach((input, index) => {
    if (input?.inputKey) {
      inputIndexByKey.set(input.inputKey, index);
    }
  });

  function clearSecondaryTagDrafts(primaryKey) {
    const secondaryKeys = Array.isArray(secondaryInputMap[primaryKey])
      ? secondaryInputMap[primaryKey]
      : [];

    setTagInputDrafts((prevDrafts) => {
      const nextDrafts = {
        ...prevDrafts,
      };

      for (const secondaryKey of secondaryKeys) {
        const secondaryIndex = inputIndexByKey.get(secondaryKey);

        if (secondaryIndex == null) {
          continue;
        }

        const secondaryInput = section.inputs[secondaryIndex];

        if (!secondaryInput) {
          continue;
        }

        if (secondaryInput.secondaryFor !== primaryKey) {
          continue;
        }

        if (secondaryInput.type !== "tagList") {
          continue;
        }

        delete nextDrafts[`${sectionIndex}_${secondaryIndex}`];
      }

      return nextDrafts;
    });
  }

  function clearSecondaryPriceRangeDrafts(primaryKey) {
    const secondaryKeys = Array.isArray(secondaryInputMap[primaryKey])
      ? secondaryInputMap[primaryKey]
      : [];

    setPriceRangeDrafts((prevDrafts) => {
      const nextDrafts = {
        ...prevDrafts,
      };

      for (const secondaryKey of secondaryKeys) {
        const secondaryIndex = inputIndexByKey.get(secondaryKey);

        if (secondaryIndex == null) {
          continue;
        }

        const secondaryInput = section.inputs[secondaryIndex];

        if (!secondaryInput) {
          continue;
        }

        if (secondaryInput.secondaryFor !== primaryKey) {
          continue;
        }

        if (secondaryInput.type !== "priceRangeArray") {
          continue;
        }

        delete nextDrafts[`${sectionIndex}_${secondaryIndex}`];
      }

      return nextDrafts;
    });
  }

  function updatePrimaryWithSecondaries(primaryInput, primaryIndex, checked) {
    const primaryKey = primaryInput.inputKey;

    setFormData((prev) => {
      const next = {
        ...prev,
      };

      const nextSections = [...next.sections];

      const nextSection = {
        ...nextSections[sectionIndex],
      };

      const nextInputs = [...nextSection.inputs];

      const previousPrimary = nextInputs[primaryIndex] || {
        id: primaryInput.id,
      };

      nextInputs[primaryIndex] = {
        ...previousPrimary,
        value: checked,
      };

      const secondaryKeys = Array.isArray(secondaryInputMap[primaryKey])
        ? secondaryInputMap[primaryKey]
        : [];

      for (const secondaryKey of secondaryKeys) {
        const secondaryIndex = inputIndexByKey.get(secondaryKey);

        if (secondaryIndex == null) {
          continue;
        }

        const secondarySchemaInput = section.inputs[secondaryIndex];

        if (!secondarySchemaInput) {
          continue;
        }

        if (secondarySchemaInput.secondaryFor !== primaryKey) {
          continue;
        }

        nextInputs[secondaryIndex] = checked
          ? initializeCheckboxGateSecondaryInput(secondarySchemaInput)
          : resetCheckboxGateSecondaryInput(secondarySchemaInput);
      }

      nextSection.inputs = nextInputs;

      nextSections[sectionIndex] = nextSection;

      next.sections = nextSections;

      return next;
    });

    if (!checked) {
      clearSecondaryTagDrafts(primaryKey);

      clearSecondaryPriceRangeDrafts(primaryKey);
    }
  }

  function renderPrimaryInput(primaryInput, primaryIndex) {
    const stored = formData.sections?.[sectionIndex]?.inputs?.[primaryIndex];

    if (primaryInput.type === "checkbox") {
      return (
        <CheckboxGatePrimaryCheckbox
          key={primaryInput.id}
          input={primaryInput}
          stored={stored}
          sectionIndex={sectionIndex}
          inputIndex={primaryIndex}
          setFormData={setFormData}
          onCheckedChange={(checked) =>
            updatePrimaryWithSecondaries(primaryInput, primaryIndex, checked)
          }
        />
      );
    }

    return renderStandardSectionInput({
      input: primaryInput,
      inputIndex: primaryIndex,
      sectionIndex,
      formData,
      setFormData,
      tagInputDrafts,
      setTagInputDrafts,
      priceRangeDrafts,
      setPriceRangeDrafts,
    });
  }

  const renderedInputs = [];

  for (const primaryKey of primaryInputKeys) {
    const primaryIndex = inputIndexByKey.get(primaryKey);

    if (primaryIndex == null) {
      continue;
    }

    const primaryInput = section.inputs[primaryIndex];

    if (!primaryInput) {
      continue;
    }

    renderedInputs.push(renderPrimaryInput(primaryInput, primaryIndex));

    const primaryStored =
      formData.sections?.[sectionIndex]?.inputs?.[primaryIndex];

    const isChecked = primaryStored?.value === true;

    if (!isChecked) {
      continue;
    }

    const secondaryKeys = Array.isArray(secondaryInputMap[primaryKey])
      ? secondaryInputMap[primaryKey]
      : [];

    for (const secondaryKey of secondaryKeys) {
      const secondaryIndex = inputIndexByKey.get(secondaryKey);

      if (secondaryIndex == null) {
        continue;
      }

      const secondaryInput = section.inputs[secondaryIndex];

      if (!secondaryInput) {
        continue;
      }

      if (secondaryInput.secondaryFor !== primaryKey) {
        continue;
      }

      const renderedSecondary = renderStandardSectionInput({
        input: secondaryInput,
        inputIndex: secondaryIndex,
        sectionIndex,
        formData,
        setFormData,
        tagInputDrafts,
        setTagInputDrafts,
        priceRangeDrafts,
        setPriceRangeDrafts,
      });

      if (renderedSecondary) {
        renderedInputs.push(renderedSecondary);
      }
    }
  }

  if (!renderedInputs.length) {
    return null;
  }

  return (
    <div
      role="region"
      aria-labelledby={`section-title-${section.id}`}
      className="section"
    >
      <h3 id={`section-title-${section.id}`}>{section.name}</h3>

      {renderedInputs}
    </div>
  );
}

function CheckboxGatePrimaryCheckbox({
  input,
  stored,
  sectionIndex,
  inputIndex,
  setFormData,
  onCheckedChange,
}) {
  const supportsApplicability = input.isApplicableOption === true;

  const isApplicable = supportsApplicability
    ? stored?.isApplicable !== false
    : true;

  const inputValue = stored?.value ?? false;

  if (!supportsApplicability) {
    return (
      <div key={input.id} className="inline-checkbox-row">
        <div className="checkbox-container">
          <input
            id={`input-${input.id}`}
            type="checkbox"
            checked={!!inputValue}
            onChange={(e) => {
              onCheckedChange(e.target.checked);
            }}
          />
        </div>

        <label htmlFor={`input-${input.id}`} className="label-container">
          {input.label}
        </label>
      </div>
    );
  }

  return (
    <div key={input.id} className="quantitative-form-group">
      <label
        className="quantitative-label"
        htmlFor={`input-${input.id}-applicable`}
      >
        {input.label}:
      </label>

      <select
        id={`input-${input.id}-applicable`}
        value={isApplicable ? "applicable" : "notApplicable"}
        onChange={(e) => {
          const nextIsApplicable = e.target.value === "applicable";

          setFormData((prev) => {
            const next = {
              ...prev,
            };

            const nextSections = [...next.sections];

            const nextSection = {
              ...nextSections[sectionIndex],
            };

            const nextInputs = [...nextSection.inputs];

            const current = nextInputs[inputIndex] || {
              id: input.id,
            };

            nextInputs[inputIndex] = {
              ...current,

              isApplicable: nextIsApplicable,

              value: nextIsApplicable ? !!current.value : false,
            };

            nextSection.inputs = nextInputs;

            nextSections[sectionIndex] = nextSection;

            next.sections = nextSections;

            return next;
          });

          if (!nextIsApplicable) {
            onCheckedChange(false);
          }
        }}
      >
        <option value="applicable">Is Applicable</option>

        <option value="notApplicable">Is Not Applicable</option>
      </select>

      {isApplicable && (
        <div className="inline-checkbox-row">
          <div className="checkbox-container">
            <input
              id={`input-${input.id}`}
              type="checkbox"
              checked={!!inputValue}
              onChange={(e) => {
                onCheckedChange(e.target.checked);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
