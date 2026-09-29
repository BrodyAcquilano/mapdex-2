import "../../styles/modals.css";
import "../../styles/panels.css";

export function renderUserSection({ schema, formData }) {
  if (schema?.engineKey !== "presence") return null;
  if (!formData) return null;

  return (
    <div className="section" role="region" aria-labelledby="user-heading">
      <h3 id="user-heading">User</h3>

      <div className="inline-row">
        <span className="label-container">User Name: </span>
        <span className="value-container">
          {" "}
          {formData.userName || "Unknown User"}
        </span>
      </div>
    </div>
  );
}

export default renderUserSection;
