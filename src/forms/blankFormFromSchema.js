import { daysOfWeek } from "../../shared/validation/formValueHelpers.js";

const DEFAULT_LINE_COLOR = "#3388ff";
const DEFAULT_BORDER_COLOR = "#2563eb";
const DEFAULT_FILL_COLOR = "#3b82f6";
const DATA_ITEM_EXTENSION_KEYS = ["Gallery", "Guestbook"];

// ─────────────────────────────────────────────
// Initialization (schema-driven)
// ─────────────────────────────────────────────

function buildBlankInputObject(schemaInput, { forceEmpty = false } = {}) {
  const inputObject = {
    id: schemaInput.id,
  };

  switch (schemaInput.type) {
    case "text":
    case "notes":
    case "website":
    case "phoneNumber":
    case "email":
      inputObject.value = "";
      break;

    case "number":
    case "percentage":
    case "capacity": {
      const allowedModes = Array.isArray(schemaInput.modeOptions)
        ? schemaInput.modeOptions
        : [];

      const defaultMode =
        !forceEmpty && schemaInput.isRequired
          ? allowedModes[0] || "Single Value"
          : "";

      Object.assign(inputObject, {
        mode: defaultMode,
        singleValue:
          defaultMode === "Single Value" ? schemaInput.minValue ?? 0 : null,
        min:
          defaultMode === "Min-Max Range" || defaultMode === "Min Only"
            ? schemaInput.minValue ?? 0
            : null,
        max:
          defaultMode === "Min-Max Range" || defaultMode === "Max Only"
            ? schemaInput.maxValue ?? null
            : null,
      });
      break;
    }

    case "checkbox":
      if (schemaInput.isApplicableOption === true) {
        inputObject.isApplicable = true;
      }
      inputObject.value = false;
      break;

    case "dropdown":
      inputObject.value =
        !forceEmpty && schemaInput.isRequired
          ? schemaInput.options?.[0] || ""
          : "";
      break;

    case "hours":
      inputObject.openHours = Object.fromEntries(
        daysOfWeek.map((day) => [day, []])
      );
      break;

    case "ageRange": {
      const allowedModes = Array.isArray(schemaInput.ageModeOptions)
        ? schemaInput.ageModeOptions
        : [];

      const defaultMode =
        !forceEmpty && schemaInput.isRequired
          ? allowedModes[0] || "All Ages"
          : "";

      Object.assign(inputObject, {
        mode: defaultMode,
        min:
          defaultMode === "Min-Max Range" || defaultMode === "Min Only"
            ? schemaInput.minValue ?? 0
            : null,
        max:
          defaultMode === "Min-Max Range" || defaultMode === "Max Only"
            ? schemaInput.maxValue ?? 150
            : null,
      });
      break;
    }

    case "priceRangeArray":
      inputObject.categories = {};
      break;

    case "tagList":
      inputObject.tags = [];
      break;

    default:
      inputObject.value = "";
      break;
  }

  return inputObject;
}

export function blankFormFromSchema(schema) {
  const formData = {};
  formData._id= null;
  formData.layer=null;
  formData.parentDataItemId=null;

if (schema?.engineKey === "presence") {
  formData.userName = "";
}

formData.geometry = {
  type: schema.geometry.types[0],
};

  formData.time = {
    type: schema.time?.type || "None",
  };

  formData.sections = [];
  formData.extensions = {};

  /* --------------------------------------------------
     Geometry
  -------------------------------------------------- */

if (formData.geometry.type === "Point") {
  formData.geometry.coordinates = ["", ""];
  formData.geometry.borderColor = DEFAULT_BORDER_COLOR;
  formData.geometry.fillColor = DEFAULT_FILL_COLOR;
}

  if (formData.geometry.type === "LineString") {
  formData.geometry.coordinates = [];
  formData.geometry.lineColor = DEFAULT_LINE_COLOR;
  formData.geometry.distance = null;
  formData.geometry.midpoint = null;
  formData.geometry.centroid = null;
}

  if (formData.geometry.type === "Polygon") {
  formData.geometry.coordinates = [[]];
  formData.geometry.bbox = null;
  formData.geometry.centroid = null;
  formData.geometry.borderColor = DEFAULT_BORDER_COLOR;
  formData.geometry.fillColor = DEFAULT_FILL_COLOR;
}

if (formData.geometry.type === "MultiPoint") {
  formData.geometry.coordinates = [];
  formData.geometry.bbox = null;
  formData.geometry.centroid = null;
  formData.geometry.borderColor = DEFAULT_BORDER_COLOR;
  formData.geometry.fillColor = DEFAULT_FILL_COLOR;
}

if (formData.geometry.type === "MultiLineString") {
  formData.geometry.coordinates = [];
  formData.geometry.bbox = null;
  formData.geometry.centroid = null;
  formData.geometry.lineColor = DEFAULT_LINE_COLOR;
}

if (formData.geometry.type === "MultiPolygon") {
  formData.geometry.coordinates = [];
  formData.geometry.bbox = null;
  formData.geometry.centroid = null;
  formData.geometry.borderColor = DEFAULT_BORDER_COLOR;
  formData.geometry.fillColor = DEFAULT_FILL_COLOR;
}

  /* --------------------------------------------------
     Time
  -------------------------------------------------- */

  if (formData.time.type === "None") {
    formData.time.timezone = "";
  }

  if (formData.time.type === "Event") {
    formData.time.mode = schema.time?.modes?.[0] || "Range";
    formData.time.timezone = "";
    formData.time.dates = [];
  }

  if (formData.time.type === "Motion") {
  formData.time.mode = schema.time?.mode || "Sampled";
  formData.time.timezone = "";
  formData.time.samples = [];
}

  /* --------------------------------------------------
     Sections
  -------------------------------------------------- */

  for (const schemaSection of schema.sections || []) {
    const formDataSection = {
      id: schemaSection.id,
      inputs: [],
    };

    const isCheckboxGateSection =
      schemaSection.conditionalSection === "checkboxGate";

    for (const schemaInput of schemaSection.inputs || []) {
      const isConditionalSecondary =
        isCheckboxGateSection &&
        typeof schemaInput.secondaryFor === "string" &&
        schemaInput.secondaryFor.trim() !== "";

      const inputObject = buildBlankInputObject(schemaInput, {
        forceEmpty: isConditionalSecondary,
      });

      formDataSection.inputs.push(inputObject);
    }

    formData.sections.push(formDataSection);
  }

  /* --------------------------------------------------
     Extensions
  -------------------------------------------------- */

  const rawExtensions = schema.extensions || {};

  const dataItemExtensions = DATA_ITEM_EXTENSION_KEYS
    .map((id) => {
      const ext = rawExtensions?.[id];
      return ext ? { id, ...ext } : null;
    })
    .filter(Boolean);

  for (const ext of dataItemExtensions) {
    if (!ext.enabled) {
      formData.extensions[ext.id] = false;
    } else if (!ext.perDataItemToggle) {
      formData.extensions[ext.id] = true;
    } else {
      formData.extensions[ext.id] = false;
    }
  }

  formData.createdAt = null;
  formData.updatedAt = null;

  return formData;
}