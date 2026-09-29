export function renderHoursInput(schemaInput, dataInput) {
  const rawOpenHours =
    dataInput && typeof dataInput.openHours === "object"
      ? dataInput.openHours
      : {};

  const hasValue = Object.values(rawOpenHours).some(
    (dayRows) =>
      Array.isArray(dayRows) &&
      dayRows.some((row) => {
        const hasOpen =
          typeof row?.open === "string" && row.open.trim() !== "";
        const hasClose =
          typeof row?.close === "string" && row.close.trim() !== "";
        return hasOpen && hasClose;
      }),
  );

  if (!hasValue && !schemaInput?.displayIfEmpty) {
    return null;
  }

  const openHours =
    rawOpenHours && typeof rawOpenHours === "object"
      ? rawOpenHours
      : {};

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <div
      key={schemaInput.id}
      role="group"
      aria-label={schemaInput.label || "Hours of Operation"}
    >
      <h4>{schemaInput.label}</h4>

      <ul className="hours-list">
        {daysOfWeek.map((day) => {
          const rows = Array.isArray(openHours?.[day]) ? openHours[day] : [];

          const validRows = rows.filter((row) => {
            const hasOpen =
              typeof row?.open === "string" && row.open.trim() !== "";
            const hasClose =
              typeof row?.close === "string" && row.close.trim() !== "";
            return hasOpen && hasClose;
          });

          if (validRows.length === 0) {
            return (
              <li key={day} className="inline-row">
                <strong className="label-container">{day}:</strong>
                <div className="value-container">Closed</div>
              </li>
            );
          }

          return validRows.map((row, idx) => (
            <li key={`${day}-${idx}`} className="inline-row">
              {idx === 0 ? (
                <strong className="label-container">{day}:</strong>
              ) : (
                <span className="label-container" aria-hidden="true"></span>
              )}

              <div className="value-container">
                {row.open} – {row.close}
              </div>
            </li>
          ));
        })}
      </ul>
    </div>
  );
}

export default renderHoursInput;