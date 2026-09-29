function formatAgeRangeValue(dataInput) {
  const mode = dataInput?.mode;

  if (mode === "All Ages") return "All Ages";
  if (mode === "Min Only") return `${dataInput.min}+`;
  if (mode === "Max Only") return `Under ${dataInput.max}`;
  if (mode === "Min-Max Range") return `${dataInput.min}-${dataInput.max}`;

  return "";
}

export function renderAgeRangeInput(schemaInput, dataInput) {
  const rawValue = formatAgeRangeValue(dataInput);
  const isEmpty = rawValue === "";

  if (isEmpty && !schemaInput?.displayIfEmpty) {
    return null;
  }

  const displayValue = isEmpty
    ? schemaInput?.emptyDisplayText || "No age range listed"
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