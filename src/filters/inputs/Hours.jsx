import {
  daysOfWeek,
  timeAMPMToMinutes,
  timeOptionsAMPM,
} from "../../../shared/validation/formValueHelpers.js";

export function renderHoursFilter(schemaInput, filterValue, setFilterValue) {
  const dayId = `filter-${schemaInput.id}-day`;
  const timeId = `filter-${schemaInput.id}-time`;

  return (
    <div key={schemaInput.id} className="form-group">
      <label className="label-container" htmlFor={dayId}>
        {schemaInput.label} (Day of Week):
      </label>

      <select
        id={dayId}
        className="value-container"
        value={filterValue?.day || "Any"}
        onChange={(e) =>
          setFilterValue({ ...(filterValue || {}), day: e.target.value })
        }
      >
        <option value="Any">Any Day</option>
        {daysOfWeek.map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </select>

      <label className="label-container" htmlFor={timeId}>
        {schemaInput.label} (Time of Day):
      </label>

      <select
        id={timeId}
        className="value-container"
        value={filterValue?.time || "Any"}
        onChange={(e) =>
          setFilterValue({ ...(filterValue || {}), time: e.target.value })
        }
      >
        <option value="Any">Any Time</option>
        {timeOptionsAMPM.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export function matchesHoursFilter(filterValue, dataInput) {
  if (!dataInput || !dataInput.openHours) {
    return true;
  }

  const hours =
    dataInput.openHours && typeof dataInput.openHours === "object"
      ? dataInput.openHours
      : {};

  const day = filterValue?.day || "Any";
  const time = filterValue?.time || "Any";

  if (day === "Any" && time === "Any") return true;

  const filterMinutes =
    time !== "Any"
      ? time === "12:00 a.m."
        ? 0
        : timeAMPMToMinutes(time)
      : null;

  const getValidRowsForDay = (dayName) => {
    const rows = Array.isArray(hours[dayName]) ? hours[dayName] : [];

    return rows.filter((row) => {
      const open = row?.open;
      const close = row?.close;

      const hasOpen = typeof open === "string" && open.trim() !== "";
      const hasClose = typeof close === "string" && close.trim() !== "";

      return hasOpen && hasClose;
    });
  };

  const getIntervalMinutes = (row) => {
    const open = row?.open;
    const close = row?.close;

    const openMin = timeAMPMToMinutes(open);
    const closeMin =
      close === "12:00 a.m." ? 1440 : timeAMPMToMinutes(close);

    return { openMin, closeMin };
  };

  const rowMatchesTime = (row) => {
    if (filterMinutes == null) return false;

    const { openMin, closeMin } = getIntervalMinutes(row);

    if (filterMinutes === 0) {
      return openMin === 0 || closeMin === 1440;
    }

    return filterMinutes >= openMin && filterMinutes <= closeMin;
  };

  if (day !== "Any" && time === "Any") {
    return getValidRowsForDay(day).length > 0;
  }

  if (day === "Any" && time !== "Any") {
    return daysOfWeek.some((d) =>
      getValidRowsForDay(d).some((row) => rowMatchesTime(row)),
    );
  }

  if (day !== "Any" && time !== "Any") {
    return getValidRowsForDay(day).some((row) => rowMatchesTime(row));
  }

  return true;
}

export function createHoursFilterState() {
  return {
    day: "Any",
    time: "Any",
  };
}

export function isHoursFilterActive(value) {
  return value?.day !== "Any" || value?.time !== "Any";
}