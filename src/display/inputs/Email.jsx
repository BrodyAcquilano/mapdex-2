function buildMailtoHref(raw) {
  const s = String(raw || "").trim();
  return `mailto:${s}`;
}

export function renderEmailInput(schemaInput, dataInput) {
  if (
    (dataInput?.value === "" ||
      dataInput?.value === null ||
      dataInput?.value === undefined) &&
    !schemaInput?.displayIfEmpty
  ) {
    return null;
  }

  const isEmpty =
    dataInput?.value === "" ||
    dataInput?.value === null ||
    dataInput?.value === undefined;

  const displayValue = isEmpty
    ? schemaInput?.emptyDisplayText || "No email listed"
    : String(dataInput.value);

  const labelId = `${schemaInput.id}-label`;

  if (isEmpty) {
    return (
      <div key={schemaInput.id} role="group" className="inline-row">
        <span id={labelId} className="label-container">
          {schemaInput.label}:
        </span>
        <span className="value-container" aria-labelledby={labelId}>
          {displayValue}
        </span>
      </div>
    );
  }

  const href = buildMailtoHref(dataInput.value);

  return (
    <div key={schemaInput.id} role="group" className="inline-row">
      <span id={labelId} className="label-container">
        {schemaInput.label}:
      </span>
      <a className="value-container" href={href} aria-labelledby={labelId}>
        {displayValue}
      </a>
    </div>
  );
}