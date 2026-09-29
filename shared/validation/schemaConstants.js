export const ENGINE_KEYS = [
  "places",
  "events",
  "neighbourhoods",
  "presence",
  "motion",
];

export const ROLE_KEYS = ["viewer", "editor", "admin", "owner"];

export const PROJECT_ROLE_FIELDS = ["adminRole", "editorRole", "viewerRole"];

export const PROJECT_ROLE_PAYLOAD_FIELDS = [
  "role",
  "userName",
  "configUpdatedAt",
];

export const PROJECT_VISIBILITY_PAYLOAD_FIELDS = [
  "visibility",
  "configUpdatedAt",
];


export const PROJECT_FAVOURITE_PAYLOAD_FIELDS = ["projectId"];

export const VISIBILITY_OPTIONS = ["private", "public", "open"];


export const EXTENSION_KEYS = ["Gallery", "Guestbook", "Bulletin", "Chat"];

export const EXTENSION_FIELDS = {
  Gallery: ["enabled", "perDataItemToggle", "maxImages"],
  Guestbook: ["enabled", "perDataItemToggle"],
  Bulletin: ["enabled", "maxMessages", "messageLength"],
  Chat: ["enabled", "maxMessages", "messageLength"],
};

export const SCHEMA_TOP_LEVEL_FIELDS = [
  "_id",
  "projectOwnerId",
  "owner",
  "ownerColorTheme",
  "visibility",
  "viewerRole",
  "editorRole",
  "adminRole",
  "engineKey",
  "projectName",
  "projectDescription",
  "previewText",
  "geometry",
  "time",
  "sections",
  "extensions",
  "createdAt",
  "updatedAt",
  "configUpdatedAt",
  "userRole",
];

export const PROJECT_CREATE_PAYLOAD_FIELDS = [
  "engineKey",
  "projectName",
  "projectDescription",
  "projectTags",
  "visibility",
];

export const PROJECT_UPDATE_PAYLOAD_FIELDS = [
  "_id",
  "engineKey",
  "projectName",
  "projectDescription",
  "projectTags",
  "previewText",
  "geometry",
  "time",
  "sections",
  "extensions",
  "configUpdatedAt",
];

export const PROJECT_SETTINGS_PAYLOAD_FIELDS = [
  "projectName",
  "projectDescription",
  "projectTags",
  "configUpdatedAt",
];

export const SCHEMA_TOP_LEVEL_FIELD_TYPES = {
  _id: "objectId",
  projectOwnerId: "objectId",
  owner: "string",
  ownerColorTheme: "string",
  visibility: "string",
  viewerRole: "roleUser[]",
  editorRole: "roleUser[]",
  adminRole: "roleUser[]",
  engineKey: "string",
  projectName: "string",
  projectDescription: "string",
  projectTags: "string[]",
  previewText: "string",
  geometry: "object",
  time: "object",
  sections: "array",
  extensions: "object",
  createdAt: "date",
  updatedAt: "date",
  configUpdatedAt: "date",
  userRole: "string",
};

export const EDITABLE_SCHEMA_TOP_LEVEL_FIELDS = [
  "engineKey",
  "projectName",
  "projectDescription",
  "previewText",
  "geometry",
  "time",
  "sections",
  "extensions",
];

export const ROUTE_OWNED_SCHEMA_TOP_LEVEL_FIELDS =
  SCHEMA_TOP_LEVEL_FIELDS.filter(
    (field) => !EDITABLE_SCHEMA_TOP_LEVEL_FIELDS.includes(field),
  );

export const STANDARD_SECTION_FIELDS = ["id", "name", "systemKey", "inputs"];

export const CONDITIONAL_SECTION_FIELDS = [
  "id",
  "name",
  "systemKey",
  "conditionalSection",
  "checkboxGateConfig",
  "inputs",
];

export const STANDARD_SECTION_FIELD_TYPES = {
  id: "number",
  name: "string",
  systemKey: "string",
  inputs: "array",
};

export const CONDITIONAL_SECTION_FIELD_TYPES = {
  id: "number",
  name: "string",
  systemKey: "string",
  conditionalSection: "string",
  checkboxGateConfig: "object",
  inputs: "array",
};

export const CONDITIONAL_SECTION_TYPES = ["checkboxGate"];

export const CHECKBOX_GATE_CONFIG_FIELDS = [
  "primaryInputKeys",
  "secondaryInputMap",
];

export const GEOMETRY_FIELDS = ["label", "types", "isFilter", "isDisplayed"];

export const GEOMETRY_FIELD_TYPES = {
  label: "string",
  types: "string[]",
  isFilter: "boolean",
  isDisplayed: "boolean",
};

export const TIME_FIELDS = [
  "label",
  "type",
  "isFilter",
  "isDisplayed",
  "defaultDurationMinutes",
  "modes",
];

export const TIME_FIELD_TYPES = {
  label: "string",
  type: "string",
  isFilter: "boolean",
  isDisplayed: "boolean",
  defaultDurationMinutes: "number",
  modes: "string[]",
};

export const INPUT_TYPES = [
  "text",
  "number",
  "percentage",
  "checkbox",
  "dropdown",
  "website",
  "phoneNumber",
  "email",
  "notes",
  "hours",
  "capacity",
  "ageRange",
  "priceRangeArray",
  "tagList",
];

export const MOTION_INPUT_TYPES = [
  "text",
  "number",
  "percentage",
  "checkbox",
  "dropdown",
  "notes",
];

export const INPUT_FIELDS_BY_TYPE = {
  text: [
    "id",
    "label",
    "type",
    "isRequired",
    "isFilter",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "maxLength",
    "inputKey",
    "secondaryFor",
  ],

  number: [
    "id",
    "label",
    "type",
    "isRequired",
    "isFilter",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "maxLength",
    "minValue",
    "maxValue",
    "modeOptions",
    "inputKey",
    "secondaryFor",
  ],

  percentage: [
    "id",
    "label",
    "type",
    "isRequired",
    "isFilter",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "maxLength",
    "minValue",
    "maxValue",
    "modeOptions",
    "inputKey",
    "secondaryFor",
  ],

  checkbox: [
    "id",
    "label",
    "type",
    "isFilter",
    "displayWhenTrue",
    "displayWhenFalse",
    "trueDisplayText",
    "falseDisplayText",
    "isApplicableOption",
    "notes",
    "inputKey",
    "secondaryFor",
  ],

  dropdown: [
    "id",
    "label",
    "type",
    "isRequired",
    "isFilter",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "options",
    "inputKey",
    "secondaryFor",
  ],

  website: [
    "id",
    "label",
    "type",
    "isRequired",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "maxLength",
    "inputKey",
    "secondaryFor",
  ],

  phoneNumber: [
    "id",
    "label",
    "type",
    "isRequired",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "maxLength",
    "inputKey",
    "secondaryFor",
  ],

  email: [
    "id",
    "label",
    "type",
    "isRequired",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "maxLength",
    "inputKey",
    "secondaryFor",
  ],

  notes: [
    "id",
    "label",
    "type",
    "isRequired",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "maxLength",
    "inputKey",
    "secondaryFor",
  ],

  hours: [
    "id",
    "label",
    "type",
    "isRequired",
    "isFilter",
    "isDisplayed",
    "displayIfEmpty",
    "inputKey",
    "secondaryFor",
  ],

  capacity: [
    "id",
    "label",
    "type",
    "isRequired",
    "isFilter",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "maxLength",
    "minValue",
    "maxValue",
    "modeOptions",
    "inputKey",
    "secondaryFor",
  ],

  ageRange: [
    "id",
    "label",
    "type",
    "isRequired",
    "isFilter",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "maxLength",
    "minValue",
    "maxValue",
    "ageModeOptions",
    "inputKey",
    "secondaryFor",
  ],

  priceRangeArray: [
    "id",
    "label",
    "type",
    "isRequired",
    "isFilter",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "maxLength",
    "minValue",
    "maxValue",
    "maxTotalPriceItems",
    "maxItemsPerCategory",
    "maxCategories",
    "maxUnitsPerCategory",
    "allowCustomCategoriesAndUnits",
    "defaultCategoryOptions",
    "customCategoryOptions",
    "priceModeOptions",
    "defaultPriceUnitOptionsByCategory",
    "customUnitOptionsByCategory",
    "inputKey",
    "secondaryFor",
  ],

  tagList: [
    "id",
    "label",
    "type",
    "isRequired",
    "isFilter",
    "isDisplayed",
    "displayIfEmpty",
    "emptyDisplayText",
    "maxLength",
    "maxItems",
    "allowCustomTags",
    "defaultTags",
    "customTags",
    "inputKey",
    "secondaryFor",
  ],
};
