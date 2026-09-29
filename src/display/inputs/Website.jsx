export function renderWebsiteInput(schemaInput, dataInput) {
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
    ? schemaInput?.emptyDisplayText || "No website listed"
    : dataInput.value;

  const labelId = `${schemaInput.id}-label`;

  return (
    <div key={schemaInput.id} role="group" className="inline-row">
      <span id={labelId} className="label-container">
        {schemaInput.label}:
      </span>

      {isEmpty ? (
        <span className="value-container" aria-labelledby={labelId}>
          {displayValue}
        </span>
      ) : (
        <a
          className="value-container"
          href={dataInput.value}
          target="_blank"
          rel="noopener noreferrer"
          aria-labelledby={labelId}
        >
          {displayValue}
        </a>
      )}
    </div>
  );
}