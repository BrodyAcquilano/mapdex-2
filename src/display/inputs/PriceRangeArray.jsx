function formatPriceRow(row) {
  const mode = row?.priceMode;
  const unit = row?.unit;

  if (mode === "Free") return "Free";
  if (mode === "Fixed Price") return `$${row.fixedPrice} (${unit})`;
  if (mode === "Min-Max Range") return `$${row.min}-$${row.max} (${unit})`;
  if (mode === "Min Only") return `$${row.min}+ (${unit})`;
  if (mode === "Max Only") return `Under $${row.max} (${unit})`;

  return "";
}

export function renderPriceRangeArrayInput(schemaInput, dataInput) {
  const categories = dataInput?.categories;
  const categoryNames =
    categories && typeof categories === "object"
      ? Object.keys(categories)
      : [];

  const isEmpty = categoryNames.length === 0;

  if (isEmpty && !schemaInput?.displayIfEmpty) {
    return null;
  }

  if (isEmpty) {
    const fallbackText =
      schemaInput?.emptyDisplayText || "No prices listed";

    return (
      <div
        key={schemaInput.id}
        className="inline-row"
        role="group"
        aria-label={`${schemaInput.label}: ${fallbackText}`}
      >
        <span className="label-container">{schemaInput.label}:</span>
        <span className="value-container">{fallbackText}</span>
      </div>
    );
  }

  return (
    <div key={schemaInput.id} role="group" aria-label={schemaInput.label}>
      <h4>{schemaInput.label}</h4>

      {categoryNames.map((categoryName) => {
        const rows = categories[categoryName] || [];
        if (!rows.length) return null;

        return (
          <div key={categoryName}>
            <div className="price-category">
              <h5>{categoryName}:</h5>
            </div>

            {rows.map((row, i) => {
              const label = row?.label || "Item";
              const formatted = formatPriceRow(row);

              return (
                <div
                  key={`${categoryName}-${i}`}
                  className="inline-row price-item-row"
                  role="group"
                  aria-label={`${label}: ${formatted}`}
                >
                  <span className="price-label-container">{label}:</span>
                  <span className="value-container">{formatted}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}