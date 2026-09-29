import "./TagList.css";

export function renderTagListInput(schemaInput, dataInput) {
  const tags = Array.isArray(dataInput?.tags)
    ? dataInput.tags.filter(
        (tag) => typeof tag === "string" && tag.trim() !== ""
      )
    : [];

  if (!tags.length && !schemaInput?.displayIfEmpty) {
    return null;
  }

  if (!tags.length) {
    const emptyText = schemaInput?.emptyDisplayText || "No data entered";

    return (
      <div
        key={schemaInput.id}
        className="inline-row"
        role="group"
        aria-label={`${schemaInput.label}: ${emptyText}`}
      >
        <span className="label-container">{schemaInput.label}:</span>
        <span className="value-container">{emptyText}</span>
      </div>
    );
  }

  return (
    <div
      key={schemaInput.id}
      className="tag-list-info-block"
      role="group"
      aria-label={`${schemaInput.label}: ${tags.join(", ")}`}
    >
      <div className="inline-row">
        <span className="label-container-long">{schemaInput.label}:</span>
      </div>

      <div className="inline-row">
        <div className="tag-list-info-list-wrap">
          <ul className="tag-list-info-list">
            {tags.map((tag, index) => (
              <li
                key={`${schemaInput.id}-${index}`}
                className="tag-list-info-item-row"
              >
                <span className="tag-list-info-bullet">•</span>
                <span className="tag-list-info-text">{tag}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}