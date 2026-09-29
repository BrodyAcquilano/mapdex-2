export function renderTextFilter(schemaInput, filterValue, setFilterValue) {
  return (
    <div key={schemaInput.id} className="form-group">
      <label
        className="label-container"
        htmlFor={`filter-${schemaInput.id}`}
      >
        {schemaInput.label}:
      </label>
      <input
        id={`filter-${schemaInput.id}`}
        type="text"
        className="value-container"
        value={filterValue || ""}
        onChange={(e) => setFilterValue(e.target.value)}
        placeholder="Type to filter..."
      />
    </div>
  );
}

export function matchesTextFilter(filterValue, dataInput) {
  if (typeof filterValue !== "string" || filterValue.trim() === "") return true;

  return (dataInput?.value || "")
    .toLowerCase()
    .includes(filterValue.toLowerCase());
}

export function createTextFilterState() {
  return "";
}

export function isTextFilterActive(value) {
  return typeof value === "string" && value.trim() !== "";
}