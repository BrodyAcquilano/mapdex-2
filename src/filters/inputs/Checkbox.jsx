export function renderCheckboxFilter(schemaInput, filterValue, setFilterValue) {
  return (
    <div key={schemaInput.id} className="inline-checkbox-row">
      <div className="checkbox-container">
        <input
          id={`filter-${schemaInput.id}`}
          type="checkbox"
          checked={filterValue || false}
          onChange={(e) => setFilterValue(e.target.checked)}
        />
      </div>
      <label
        htmlFor={`filter-${schemaInput.id}`}
        className="label-container"
      >
        {schemaInput.label}
      </label>
    </div>
  );
}

export function matchesCheckboxFilter(filterValue, dataInput) {
  if (filterValue !== true) return true;
  return dataInput?.value === true;
}

export function createCheckboxFilterState() {
  return false;
}

export function isCheckboxFilterActive(value) {
  return value === true;
}