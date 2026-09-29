import React from "react";

export function renderCheckboxGateSection({
  selectedDataItem,
  dataSection,
  schemaSection,
  shouldDisplayInfoInput,
  renderInfoInput,
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

  const schemaInputs = Array.isArray(schemaSection?.inputs)
    ? schemaSection.inputs
    : [];

  const schemaInputByKey = new Map();
  for (const schemaInput of schemaInputs) {
    if (schemaInput?.inputKey) {
      schemaInputByKey.set(schemaInput.inputKey, schemaInput);
    }
  }

  const dataInputByKey = new Map();

  for (const dataInput of dataSection?.inputs || []) {
    const loc = selectedDataItem?.inputIndexById?.get(dataInput.id);
    if (!loc) continue;

    const { sectionIndex: sIdx, inputIndex: iIdx } = loc;
    const resolvedSchemaInput = selectedDataItem?.schema?.sections?.[sIdx]?.inputs?.[iIdx];

    // fallback to passed schema if selectedDataItem.schema is not present
    const schemaInput =
      resolvedSchemaInput ||
      schemaSection?.inputs?.[iIdx];

    if (!schemaInput?.inputKey) continue;

    dataInputByKey.set(schemaInput.inputKey, {
      dataInput,
      schemaInput,
    });
  }

  const renderedInputs = [];

  for (const primaryKey of primaryInputKeys) {
    const primaryPair = dataInputByKey.get(primaryKey);
    if (!primaryPair) continue;

    const { dataInput: primaryDataInput, schemaInput: primarySchemaInput } =
      primaryPair;

    if (shouldDisplayInfoInput(primarySchemaInput, primaryDataInput)) {
      const renderedPrimary = renderInfoInput(
        primarySchemaInput,
        primaryDataInput
      );
      if (renderedPrimary) renderedInputs.push(renderedPrimary);
    }

    const isChecked = primaryDataInput?.value === true;
    if (!isChecked) continue;

    const secondaryKeys = Array.isArray(secondaryInputMap[primaryKey])
      ? secondaryInputMap[primaryKey]
      : [];

    for (const secondaryKey of secondaryKeys) {
      const secondaryPair = dataInputByKey.get(secondaryKey);
      if (!secondaryPair) continue;

      const {
        dataInput: secondaryDataInput,
        schemaInput: secondarySchemaInput,
      } = secondaryPair;

      if (!shouldDisplayCheckboxGateSecondary({
        primaryKey,
        primaryDataInput,
        secondarySchemaInput,
        secondaryDataInput,
        shouldDisplayInfoInput,
      })) {
        continue;
      }

      const renderedSecondary = renderInfoInput(
        secondarySchemaInput,
        secondaryDataInput
      );

      if (renderedSecondary) renderedInputs.push(renderedSecondary);
    }
  }

  if (!renderedInputs.length) return null;

  return (
    <div key={schemaSection.id} className="section">
      <h3>{schemaSection.name}</h3>
      {renderedInputs}
    </div>
  );
}

function shouldDisplayCheckboxGateSecondary({
  primaryKey,
  primaryDataInput,
  secondarySchemaInput,
  secondaryDataInput,
  shouldDisplayInfoInput,
}) {
  if (primaryDataInput?.value !== true) return false;

  if (secondarySchemaInput?.secondaryFor !== primaryKey) return false;

  return shouldDisplayInfoInput(secondarySchemaInput, secondaryDataInput);
}