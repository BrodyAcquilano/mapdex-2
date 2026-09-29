// src/boundaries/BoundaryList/BoundaryList.jsx

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import "./BoundaryList.css";

/*
 * The Boundaries tab's own list body, shared by the Layers and
 * Aggregates list panels. Only the rows - each panel keeps its own
 * tabs, header and export footer, and keeps rendering its *own* entity
 * (layers / aggregates) itself. This is the one part that was genuinely
 * the same job on both pages.
 *
 * It came from the Aggregates panel's version, which was the better of
 * the two: that panel drove both tabs through one generic row renderer,
 * so boundaries there already had the visibility checkbox and the
 * eye-button opacity popover, while the Layers panel's hand-written
 * boundary rows had neither.
 *
 * The two controls do different jobs and both matter here: the checkbox
 * is what decides whether a boundary is included when exporting, while
 * the opacity slider is purely a display aid for telling overlapping
 * boundaries apart on the map.
 */
export default function BoundaryList({
  boundaries,
  selectedBoundaryId,
  onSelectBoundary,
  onToggleVisible,
  onOpacityChange,
}) {
  const [openOpacityId, setOpenOpacityId] = useState(null);

  function toggleOpacityPopover(id) {
    setOpenOpacityId((prev) => (prev === id ? null : id));
  }

  return (
    <ul className="boundary-list">
      {(boundaries || []).map((boundary) => {
        const isVisible = boundary.visible !== false;

        return (
          <li
            key={boundary._id}
            className={`boundary-list-row ${
              selectedBoundaryId === boundary._id ? "selected" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={isVisible}
              onChange={() => onToggleVisible?.(boundary._id)}
              aria-label={`Toggle ${boundary.name} visibility`}
            />

            <span
              className="boundary-list-swatch"
              style={{
                backgroundColor: boundary.fillColor,
                borderColor: boundary.borderColor,
              }}
            />

            <button
              type="button"
              className="boundary-list-name-button"
              onClick={() => onSelectBoundary?.(boundary._id)}
            >
              {boundary.name}
            </button>

            <button
              type="button"
              className="boundary-list-eye-button"
              onClick={() => toggleOpacityPopover(boundary._id)}
              aria-label={`Adjust ${boundary.name} opacity`}
              aria-expanded={openOpacityId === boundary._id}
            >
              {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>

            {openOpacityId === boundary._id && (
              <div className="boundary-list-opacity-popover">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={boundary.opacity ?? 1}
                  onChange={(event) =>
                    onOpacityChange?.(boundary._id, Number(event.target.value))
                  }
                  className="boundary-list-opacity-slider"
                  aria-label={`${boundary.name} opacity`}
                />
              </div>
            )}
          </li>
        );
      })}

      {(!boundaries || boundaries.length === 0) && (
        <li className="boundary-list-empty-message">No boundaries yet.</li>
      )}
    </ul>
  );
}
