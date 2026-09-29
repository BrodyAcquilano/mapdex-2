import React from "react";
import { createFilterStateForType } from "../initializeFilters.js";

export function renderCheckboxGateFilterSection({
  schemaSection,
  filterState,
  setFilterState,
  tagFilterDrafts,
  setTagFilterDrafts,
  priceRangeFilterDrafts,
  setPriceRangeFilterDrafts,
  renderInputFilter,
}) {
  const primaryInputKeys = Array.isArray(
    schemaSection?.checkboxGateConfig?.primaryInputKeys
  )
    ? schemaSection.checkboxGateConfig.primaryInputKeys
    : [];

  const secondaryInputMap =
    schemaSection?.checkboxGateConfig?.secondaryInputMap &&
    typeof schemaSection.checkboxGateConfig.secondaryInputMap === "object"
      ? schemaSection.checkboxGateConfig.secondaryInputMap
      : {};

  const filterableInputs = Array.isArray(schemaSection?.inputs)
    ? schemaSection.inputs.filter((input) => input.isFilter === true)
    : [];

  const schemaInputByKey = new Map();
  for (const schemaInput of filterableInputs) {
    if (schemaInput?.inputKey) {
      schemaInputByKey.set(schemaInput.inputKey, schemaInput);
    }
  }

  function resetSecondaryFilters(prevState, primaryKey) {
    const nextState = { ...prevState };
    const secondaryKeys = Array.isArray(secondaryInputMap[primaryKey])
      ? secondaryInputMap[primaryKey]
      : [];

    for (const secondaryKey of secondaryKeys) {
      const secondarySchemaInput = schemaInputByKey.get(secondaryKey);
      if (!secondarySchemaInput) continue;
      if (secondarySchemaInput.secondaryFor !== primaryKey) continue;
      if (secondarySchemaInput.isFilter !== true) continue;

      nextState[secondarySchemaInput.id] = createFilterStateForType(
        secondarySchemaInput.type,
        secondarySchemaInput
      );
    }

    return nextState;
  }

  function clearSecondaryTagDrafts(primaryKey) {
    const secondaryKeys = Array.isArray(secondaryInputMap[primaryKey])
      ? secondaryInputMap[primaryKey]
      : [];

    setTagFilterDrafts((prevDrafts) => {
      const nextDrafts = { ...prevDrafts };

      for (const secondaryKey of secondaryKeys) {
        const secondarySchemaInput = schemaInputByKey.get(secondaryKey);
        if (!secondarySchemaInput) continue;
        if (secondarySchemaInput.secondaryFor !== primaryKey) continue;
        if (secondarySchemaInput.type !== "tagList") continue;

        delete nextDrafts[secondarySchemaInput.id];
      }

      return nextDrafts;
    });
  }

  function clearSecondaryPriceRangeDrafts(primaryKey) {
    const secondaryKeys = Array.isArray(secondaryInputMap[primaryKey])
      ? secondaryInputMap[primaryKey]
      : [];

    setPriceRangeFilterDrafts((prevDrafts) => {
      const nextDrafts = { ...prevDrafts };

      for (const secondaryKey of secondaryKeys) {
        const secondarySchemaInput = schemaInputByKey.get(secondaryKey);
        if (!secondarySchemaInput) continue;
        if (secondarySchemaInput.secondaryFor !== primaryKey) continue;
        if (secondarySchemaInput.type !== "priceRangeArray") continue;

        delete nextDrafts[secondarySchemaInput.id];
      }

      return nextDrafts;
    });
  }

  function buildPrimarySetter(primarySchemaInput, primaryKey) {
    return (newValue) => {
      setFilterState((prev) => {
        const nextState = {
          ...prev,
          [primarySchemaInput.id]: newValue,
        };

        if (newValue !== true) {
          return resetSecondaryFilters(nextState, primaryKey);
        }

        return nextState;
      });

      if (newValue !== true) {
        clearSecondaryTagDrafts(primaryKey);
        clearSecondaryPriceRangeDrafts(primaryKey);
      }
    };
  }

  const renderedInputs = [];

  for (const primaryKey of primaryInputKeys) {
    const primarySchemaInput = schemaInputByKey.get(primaryKey);
    if (!primarySchemaInput) continue;

    const primaryRendered = renderInputFilter({
      schemaInput: primarySchemaInput,
      filterValue: filterState[primarySchemaInput.id],
      setFilterValue: buildPrimarySetter(primarySchemaInput, primaryKey),
      tagFilterDrafts,
      setTagFilterDrafts,
      priceRangeFilterDrafts,
      setPriceRangeFilterDrafts,
    });

    if (primaryRendered) {
      renderedInputs.push(primaryRendered);
    }

    const isPrimaryChecked = filterState?.[primarySchemaInput.id] === true;
    if (!isPrimaryChecked) continue;

    const secondaryKeys = Array.isArray(secondaryInputMap[primaryKey])
      ? secondaryInputMap[primaryKey]
      : [];

    for (const secondaryKey of secondaryKeys) {
      const secondarySchemaInput = schemaInputByKey.get(secondaryKey);
      if (!secondarySchemaInput) continue;
      if (secondarySchemaInput.secondaryFor !== primaryKey) continue;
      if (secondarySchemaInput.isFilter !== true) continue;

      const secondaryRendered = renderInputFilter({
        schemaInput: secondarySchemaInput,
        filterValue: filterState[secondarySchemaInput.id],
        setFilterValue: (newValue) =>
          setFilterState((prev) => ({
            ...prev,
            [secondarySchemaInput.id]: newValue,
          })),
        tagFilterDrafts,
        setTagFilterDrafts,
        priceRangeFilterDrafts,
        setPriceRangeFilterDrafts,
      });

      if (secondaryRendered) {
        renderedInputs.push(secondaryRendered);
      }
    }
  }

  if (!renderedInputs.length) return null;

  return (
    <div
      key={schemaSection.id}
      className="section"
      role="region"
      aria-labelledby={`section-title-${schemaSection.id}`}
    >
      <h3 id={`section-title-${schemaSection.id}`}>{schemaSection.name}</h3>
      {renderedInputs}
    </div>
  );
}