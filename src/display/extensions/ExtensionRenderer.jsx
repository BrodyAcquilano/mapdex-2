export default function renderExtensionsSection(selectedDataItem, onOpenExtension) {
  const extensions = selectedDataItem?.extensions;

  if (
    !extensions ||
    typeof extensions !== "object" ||
    Array.isArray(extensions)
  ) {
    return null;
  }
  if (Object.keys(extensions).length === 0) return null;

  const enabledKeys = Object.entries(extensions)
    .filter(([, value]) => value === true)
    .map(([key]) => key);

  if (enabledKeys.length === 0) return null;

  return (
    <div
      className="section"
      role="region"
      aria-labelledby="section-title-extensions"
    >
      <h3 id="section-title-extensions" className="visually-hidden">
        Extensions
      </h3>

      {enabledKeys.map((key) => (
        <div key={key} className="buttons-container">
          <button
            type="button"
            className="panel-action-button"
            aria-label={`Open ${key}`}
            onClick={() => onOpenExtension?.(key, "viewer")}
          >
            Open {key}
          </button>
        </div>
      ))}
    </div>
  );
}
