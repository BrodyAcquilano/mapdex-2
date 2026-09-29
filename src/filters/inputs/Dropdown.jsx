export function renderDropdownFilter(schemaInput, filterValue, setFilterValue) {
  return (
    <div key={schemaInput.id} className="form-group">
      <label
        className="label-container"
        htmlFor={`filter-${schemaInput.id}`}
      >
        {schemaInput.label}:
      </label>
      <select
        id={`filter-${schemaInput.id}`}
        value={filterValue || "Any"}
        className="value-container"
        onChange={(e) => setFilterValue(e.target.value)}
      >
        <option value="Any">Any</option>
        {schemaInput.options.map((option, idx) => (
          <option key={idx} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function matchesDropdownFilter(filterValue, dataInput) {
  if (!filterValue || filterValue === "Any") return true;
  return filterValue === dataInput?.value;
}

export function createDropdownFilterState() {
  return "Any";
}

export function isDropdownFilterActive(value) {
  return value && value !== "Any";
}