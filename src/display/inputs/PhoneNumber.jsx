function buildTelHref(raw) {
  const s = (raw || "").trim();
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");

  if (hasPlus) return `tel:+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  if (digits.length === 10) return `tel:+1${digits}`;
  return `tel:${digits}`;
}

export function renderPhoneNumberInput(schemaInput, dataInput) {
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
    ? schemaInput?.emptyDisplayText || "No phone number listed"
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

  const dial = buildTelHref(String(dataInput.value));

  return (
    <div key={schemaInput.id} role="group" className="inline-row">
      <span id={labelId} className="label-container">
        {schemaInput.label}:
      </span>
      <a className="value-container" href={dial} aria-labelledby={labelId}>
        {displayValue}
      </a>
    </div>
  );
}