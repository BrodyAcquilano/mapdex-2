export function renderUserFilterSection({
  schema,
  filterState,
  setFilterState,
}) {
  if (schema?.engineKey !== "presence") return null;

  const filterValue = filterState?.userName || "";

  const setFilterValue = (newValue) =>
    setFilterState((prev) => ({
      ...prev,
      userName: newValue,
    }));

  return (
    <div
      key="user-filter-section"
      className="section"
      role="region"
      aria-labelledby="section-title-user-filter"
    >
      <h3 id="section-title-user-filter">User</h3>

      <div className="form-group">
        <label
          className="label-container"
          htmlFor="filter-user-name"
        >
          User Name:
        </label>
        <input
          id="filter-user-name"
          type="text"
          className="value-container"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          placeholder="Type to filter..."
        />
      </div>
    </div>
  );
}

export function matchesUserNameFilter(filterValue, dataItem) {
  if (typeof filterValue !== "string" || filterValue.trim() === "") return true;

  return (dataItem?.userName || "")
    .toLowerCase()
    .includes(filterValue.toLowerCase());
}

export function createUserNameFilterState() {
  return "";
}

export function isUserNameFilterActive(value) {
  return typeof value === "string" && value.trim() !== "";
}