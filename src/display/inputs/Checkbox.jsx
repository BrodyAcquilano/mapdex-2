export function renderCheckboxInput(schemaInput, dataInput) {
  const mode =
    dataInput?.value === true
      ? schemaInput?.displayWhenTrue
      : schemaInput?.displayWhenFalse;

  if (mode === "none") return null;

  if (mode === "labelOnly") {
    return (
      <div
        key={schemaInput.id}
        className="inline-row"
        role="group"
        aria-label={schemaInput.label}
      >
        <span className="label-container">- {schemaInput.label}</span>
      </div>
    );
  }

  if (mode === "messageOnly") {
    const message = dataInput?.value
      ? schemaInput?.trueDisplayText
      : schemaInput?.falseDisplayText;

    return (
      <div
        key={schemaInput.id}
        className="inline-row"
        role="group"
        aria-label={message}
      >
        <span className="label-container">{message}</span>
      </div>
    );
  }

  if (mode === "labelMessage") {
    const message = dataInput?.value
      ? schemaInput?.trueDisplayText
      : schemaInput?.falseDisplayText;

    return (
      <div
        key={schemaInput.id}
        className="inline-row"
        role="group"
        aria-label={`${schemaInput.label}: ${message}`}
      >
        <span className="label-container">{schemaInput.label}:</span>
        <span className="value-container">{message}</span>
      </div>
    );
  }

  return null;
}