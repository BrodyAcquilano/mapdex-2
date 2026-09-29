function formatPercentageValue(dataInput) {
  const mode = dataInput?.mode;

  if (mode === "Single Value") return `${dataInput?.singleValue ?? ""}%`;
  if (mode === "Min Only") return `${dataInput?.min ?? ""}%+`;
  if (mode === "Max Only") return `Under ${dataInput?.max ?? ""}%`;
  if (mode === "Min-Max Range") {
    return `${dataInput?.min ?? ""}%-${dataInput?.max ?? ""}%`;
  }

  return "";
}

export function renderPercentageInput(schemaInput, dataInput) {
  const rawValue = formatPercentageValue(dataInput);
  const isEmpty = rawValue === "";

  if (isEmpty && !schemaInput?.displayIfEmpty) {
    return null;
  }

  const displayValue = isEmpty
    ? schemaInput?.emptyDisplayText || "No percentage entered"
    : rawValue;

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