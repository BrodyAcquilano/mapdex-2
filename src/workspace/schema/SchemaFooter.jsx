import "./Schema.css";
import { validateProjectSchema } from "../../../shared/validation/projectValidation.js";

function buildProjectUpdatePayloadFromSchema(schema) {
  if (!schema) return null;

  return {
    _id: schema._id,
    engineKey: structuredClone(schema.engineKey),
    projectName: structuredClone(schema.projectName),
    projectDescription: structuredClone(schema.projectDescription || ""),
    projectTags: structuredClone(schema.projectTags || []),
    previewText: structuredClone(schema.previewText || ""),
    geometry: structuredClone(schema.geometry),
    time: structuredClone(schema.time),
    sections: structuredClone(schema.sections || []),
    extensions: structuredClone(schema.extensions || {}),
    configUpdatedAt: schema.configUpdatedAt,
  };
}

export default function SchemaFooter({
  draftSchema,
  projectId,
  setProjects,
  apis,
  system,
  previewTextSettings,
  showDrawer,
}) {
  function generatePreviewTextString(draftSchema, previewTextSettings) {
    const displayItems = [];

    (draftSchema.sections || []).forEach((section, sectionIndex) => {
      (section.inputs || []).forEach((input, inputIndex) => {
        const key = `${sectionIndex}_${inputIndex}`;
        const setting = previewTextSettings[key];

        if (setting === "value") {
          displayItems.push(
            `sections[${sectionIndex}].inputs[${inputIndex}].value`,
          );
        } else if (setting === "labelValue") {
          displayItems.push(
            `sections[${sectionIndex}].inputs[${inputIndex}].label`,
          );
          displayItems.push(
            `sections[${sectionIndex}].inputs[${inputIndex}].value`,
          );
        }
      });
    });

    return displayItems.join(" ");
  }

  async function handleSaveProject() {
    if (!projectId) {
      system?.notify?.("No active project.");
      return;
    }

    if (!draftSchema?._id) {
      system?.notify?.("Project id is missing. Reload before saving.");
      return;
    }

    if (!draftSchema?.configUpdatedAt) {
      system?.notify?.(
        "Project config timestamp is missing. Reload before saving.",
      );
      return;
    }

    const updatedSchema = {
      ...draftSchema,
      previewText: generatePreviewTextString(draftSchema, previewTextSettings),
    };

    const payload = buildProjectUpdatePayloadFromSchema(updatedSchema);

    if (!payload?._id || !payload?.configUpdatedAt) {
      system?.notify?.("Project payload is missing required fields.");
      return;
    }

    const validation = validateProjectSchema(payload);

    if (!validation.isValid) {
      validation.errors.forEach((error) => {
        if (error?.trim()) system?.notify?.(error);
      });
      return;
    }

const confirmed = await system.confirm({
  message:
    "Saving will permanently modify this project.\n\n" +
    "Removed sections, inputs, extensions, or geometry types may permanently delete related data.\n\n" +
    "Removing a geometry type will delete data items using that type, including related extension data.\n\n" +
    "Continue?",
  confirmText: "Save Changes",
  cancelText: "Cancel",
});

    if (!confirmed) return;

    try {
      const { data, message } = await apis.projectApi.update(payload);

      if (!data?._id) {
        system?.notify?.("Save failed.");
        return;
      }

      system?.startLoading?.("Reloading Project...");

      setProjects?.((prev) =>
        (prev || []).map((p) =>
          String(p._id) === String(projectId)
            ? {
                ...p,
                projectName: payload.projectName,
                projectDescription: payload.projectDescription,
                projectTags: payload.projectTags,
              }
            : p,
        ),
      );

      if (message) {
        message.split("\n").forEach((line) => {
          if (line.trim()) system?.notify?.(line);
        });
      }
    } catch (err) {
      console.error(err);
      system?.notify?.("Save failed.");
    }
  }

  return (
    <div
      className={`schema-builder-footer-toolbar ${
        showDrawer ? "show-mobile-drawer" : ""
      }`}
    >
      <div className="footer-content-wrapper">
        <button
          className="save-project-button"
          onClick={handleSaveProject}
          title="Save Project"
        >
          Save Project
        </button>
      </div>
    </div>
  );
}
