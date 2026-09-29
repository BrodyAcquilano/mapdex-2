import { timeOptionsAMPM, daysOfWeek } from "../../../shared/validation/formValueHelpers.js";

import "../../styles/modals.css";
import "../../styles/panels.css";
import "./Hours.css";

const DEFAULT_INTERVAL = {
  open: "9:00 a.m.",
  close: "5:00 p.m.",
};

export function renderHoursInput({
  input,
  formData,
  setFormData,
  sectionIndex,
  inputIndex,
}) {
  const hoursData = formData.sections[sectionIndex].inputs[inputIndex];
  const openHours = hoursData?.openHours || {};

  function addInterval(day) {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const slot = next.sections[sectionIndex].inputs[inputIndex];

      if (!slot.openHours || typeof slot.openHours !== "object") {
        slot.openHours = {};
      }

      const current = Array.isArray(slot.openHours[day])
        ? slot.openHours[day]
        : [];

      slot.openHours[day] = [...current, { ...DEFAULT_INTERVAL }];
      return next;
    });
  }

  function removeInterval(day, rowIndex) {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const slot = next.sections[sectionIndex].inputs[inputIndex];

      const current = Array.isArray(slot.openHours?.[day])
        ? [...slot.openHours[day]]
        : [];

      current.splice(rowIndex, 1);
      slot.openHours[day] = current;

      return next;
    });
  }

  function updateInterval(day, rowIndex, field, value) {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const slot = next.sections[sectionIndex].inputs[inputIndex];

      const current = Array.isArray(slot.openHours?.[day])
        ? [...slot.openHours[day]]
        : [];

      const row = { ...(current[rowIndex] || DEFAULT_INTERVAL) };
      row[field] = value;
      current[rowIndex] = row;

      slot.openHours[day] = current;
      return next;
    });
  }

  return (
    <div
      key={input.id}
      className="hours-form-group"
      role="group"
      aria-labelledby={`input-${input.id}-label`}
    >
      <h4 id={`input-${input.id}-label`}>{input.label}</h4>

      <table className="hours-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Open Time</th>
            <th>Close Time</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {daysOfWeek.map((day) => {
            const rows = Array.isArray(openHours[day]) ? openHours[day] : [];

            if (rows.length === 0) {
              return (
                <tr key={day}>
                  <td>{day}</td>
                  <td colSpan={2}>
                    <div className="closed-cell">Closed</div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="hours-action-button hours-add-button"
                      onClick={() => addInterval(day)}
                      aria-label={`Add hours for ${day}`}
                      title={`Add hours for ${day}`}
                    >
                      +
                    </button>
                  </td>
                </tr>
              );
            }

            return rows.map((row, rowIndex) => (
              <tr key={`${day}-${rowIndex}`}>
                {rowIndex === 0 ? (
                  <td rowSpan={rows.length}>{day}</td>
                ) : null}

                <td>
                  <select
                    value={row?.open || DEFAULT_INTERVAL.open}
                    onChange={(e) =>
                      updateInterval(day, rowIndex, "open", e.target.value)
                    }
                  >
                    {timeOptionsAMPM.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </td>

                <td>
                  <select
                    value={row?.close || DEFAULT_INTERVAL.close}
                    onChange={(e) =>
                      updateInterval(day, rowIndex, "close", e.target.value)
                    }
                  >
                    {timeOptionsAMPM.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="hours-action-cell">
                  <button
                    type="button"
                    className="hours-action-button hours-delete-button"
                    onClick={() => removeInterval(day, rowIndex)}
                    aria-label={`Remove interval ${rowIndex + 1} for ${day}`}
                    title="Remove interval"
                  >
                    &minus;
                  </button>

                  {rowIndex === rows.length - 1 && (
                    <button
                      type="button"
                      className="hours-action-button hours-add-button"
                      onClick={() => addInterval(day)}
                      aria-label={`Add interval for ${day}`}
                      title="Add interval"
                    >
                      +
                    </button>
                  )}
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

export default renderHoursInput;