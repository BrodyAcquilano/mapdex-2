import { useState } from "react";
import { PROJECT_LIMITS } from "../../../../../shared/validation/validationConstants.js";
import { normalizeTag } from "../../../../../shared/validation/formValueHelpers.js";

function ProjectSettingsConfigurator({
  draftSchema,
  setDraftSchema,
}) {
  const [tagInput, setTagInput] = useState("");

  function updateField(field, value) {
    setDraftSchema((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  const projectTags = Array.isArray(draftSchema.projectTags)
    ? draftSchema.projectTags
    : [];

  const normalizedTagInput = normalizeTag(tagInput);

  const tagAlreadyExists = projectTags.some(
    (tag) => tag.toLowerCase() === normalizedTagInput.toLowerCase(),
  );

  const hasReachedMaxTags = projectTags.length >= PROJECT_LIMITS.maxProjectTags;

  const canAddTag =
    normalizedTagInput !== "" && !tagAlreadyExists && !hasReachedMaxTags;

  function handleAddTag() {
    if (!canAddTag) return;
    updateField("projectTags", [...projectTags, normalizedTagInput]);
    setTagInput("");
  }

  function handleDeleteTag(index) {
    updateField(
      "projectTags",
      projectTags.filter((_, idx) => idx !== index),
    );
  }

  return (
    <div className="input-configurator-group">
      <label className="input-configurator-option">
        Project Name:
        <input
          type="text"
          value={draftSchema.projectName ?? ""}
          onChange={(e) => updateField("projectName", e.target.value)}
          maxLength={PROJECT_LIMITS.projectNameMaxLength}
        />
      </label>

      <label className="input-configurator-notes">
        Project Description:
        <textarea
          value={draftSchema.projectDescription ?? ""}
          onChange={(e) =>
            updateField("projectDescription", e.target.value)
          }
          maxLength={PROJECT_LIMITS.projectDescriptionMaxLength}
          rows={1}
        />
      </label>

      <h3 className="input-configurator-subtitle">Project Tags</h3>

      <label className="input-configurator-option">
        <input
          type="text"
          value={tagInput}
          maxLength={PROJECT_LIMITS.projectTagMaxLength}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddTag();
            }
          }}
          placeholder="Type a tag..."
        />
      </label>

      <ul className="input-configurator-dropdown-options">
        {projectTags.map((tag, idx) => (
          <li key={`${tag}-${idx}`} className="input-configurator-dropdown-option-item">
            <span>{tag}</span>

            <span
              className="input-configurator-delete-option"
              onClick={() => handleDeleteTag(idx)}
              title="Delete Tag"
            >
              &minus;
            </span>
          </li>
        ))}
      </ul>

      <button
        className="input-configurator-add-option-button"
        onClick={handleAddTag}
        disabled={!canAddTag}
        title={
          hasReachedMaxTags
            ? `Maximum of ${PROJECT_LIMITS.maxProjectTags} tags reached`
            : tagAlreadyExists
              ? "That tag already exists"
              : "Add Tag"
        }
        style={{
          opacity: canAddTag ? 1 : 0.6,
          cursor: canAddTag ? "pointer" : "not-allowed",
        }}
      >
        Add Tag ➕
      </button>
    </div>
  );
}

export default ProjectSettingsConfigurator;
