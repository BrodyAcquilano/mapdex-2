export function renderNotesInput(schemaInput, dataInput) {
  if (
    (dataInput?.value === "" ||
      dataInput?.value === null ||
      dataInput?.value === undefined) &&
    !schemaInput?.displayIfEmpty
  ) {
    return null;
  }

  const displayValue =
    dataInput?.value === "" ||
    dataInput?.value === null ||
    dataInput?.value === undefined
      ? schemaInput?.emptyDisplayText || "No data entered"
      : dataInput.value;

  return (
    <div
      key={schemaInput.id}
      className="inline-row"
      role="group"
      aria-label={`${schemaInput.label}: ${displayValue}`}
    >
      <span className="label-container">{schemaInput.label}:</span>
      <span className="value-container">{displayValue}</span>
    </div>
  );
}