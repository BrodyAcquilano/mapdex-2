import "./Notes.css";
import "../../styles/modals.css";
import "../../styles/panels.css";
export function renderNotesInput({
  input,
  inputValue,
  sectionIndex,
  inputIndex,
  setFormData,
}) {
  return (
    <div key={input.id} className="form-group notes-input">
      <label className="label-container" htmlFor={`input-${input.id}`}>
        {input.label}:
      </label>

      <textarea
        className="value-container"
        id={`input-${input.id}`}
        value={inputValue || ""}
        maxLength={input.maxLength || 1000}
        rows={2}
        onChange={(e) =>
          setFormData((prev) => {
            const next = { ...prev };
            next.sections[sectionIndex].inputs[inputIndex].value =
              e.target.value;
            return next;
          })
        }
      />
    </div>
  );
}

export default renderNotesInput;