export const RATE_LIMIT_LAYERS = {
  AUTH: "auth",
  ACCOUNT: "account",
  PROJECT: "project",
  DATA: "data",
  EXTENSION: "extension",
};

export const RATE_LIMIT_ACTIONS = {
  // Auth
  LOGIN: "login",
  REGISTER: "register",
  REQUEST_PASSWORD_RESET: "requestPasswordReset",
  VERIFY_PASSWORD_RESET: "verifyPasswordReset",
  RESET_PASSWORD: "resetPassword",
  VERIFY_EMAIL: "verifyEmail",
  RESEND_VERIFICATION_EMAIL: "resendVerificationEmail",
  GUEST_LOGIN: "guestLogin",

  // Account
  CHANGE_PASSWORD: "changePassword",
  CHANGE_USERNAME: "changeUsername",
  CHANGE_EMAIL: "changeEmail",
  UPDATE_USER_THEME: "updateUserTheme",
  DELETE_ACCOUNT: "deleteAccount",

  // Project
  GET_PROJECTS: "getProjects",
  GET_PROJECT: "getProject",
  ADD_PROJECT: "addProject",
  UPDATE_PROJECT: "updateProject",
  DELETE_PROJECT: "deleteProject",
  CLONE_PROJECT: "cloneProject",
  EXPORT_PROJECT: "exportProject",
  EXPORT_FILTERED_PROJECT: "exportFilteredProject",
  UPDATE_PROJECT_PERMISSIONS: "updateProjectPermissions",
  UPDATE_PROJECT_VISIBILITY: "updateProjectVisibility",

  // Data
  GET_DATA: "getData",
  GET_ONE_DATA_ITEM: "getOneDataItem",
  ADD_DATA_ITEM: "addDataItem",
  QUICK_ADD_DATA_ITEM: "quickAddDataItem",
  UPDATE_DATA_ITEM: "updateDataItem",
  DRAG_DATA_ITEM: "dragDataItem",
  DELETE_DATA_ITEM: "deleteDataItem",

  // Extensions
  GET_EXTENSION_DATA: "getExtensionData",
  ADD_GALLERY_IMAGE: "addGalleryImage",
  DELETE_GALLERY_IMAGE: "deleteGalleryImage",
  ADD_GUESTBOOK_ENTRY: "addGuestbookEntry",
  DELETE_GUESTBOOK_ENTRY: "deleteGuestbookEntry",
  ADD_BULLETIN_MESSAGE: "addBulletinMessage",
  DELETE_BULLETIN_MESSAGE: "deleteBulletinMessage",
  ADD_CHAT_MESSAGE: "addChatMessage",
  DELETE_CHAT_MESSAGE: "deleteChatMessage",
};

export const RATE_LIMIT_PRESETS = {
  STRICT: "strict",
  MODERATE: "moderate",
  RELAXED: "relaxed",
  HEAVY: "heavy",
};

export const RATE_LIMITS = {
  auth: {
    login: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerIp: 10,
      maxRequestsPerAccount: 10,
      preset: RATE_LIMIT_PRESETS.STRICT,
    },
    register: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerIp: 5,
      maxRequestsPerEmail: 3,
      preset: RATE_LIMIT_PRESETS.STRICT,
    },
    requestPasswordReset: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerIp: 5,
      maxRequestsPerEmail: 3,
      preset: RATE_LIMIT_PRESETS.STRICT,
    },
    verifyPasswordReset: {
      windowMs: 15 * 60 * 1000,
      maxRequestsPerIp: 20,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    resetPassword: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerIp: 10,
      maxRequestsPerAccount: 5,
      preset: RATE_LIMIT_PRESETS.STRICT,
    },
    verifyEmail: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerIp: 20,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    resendVerificationEmail: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerIp: 5,
      maxRequestsPerEmail: 3,
      preset: RATE_LIMIT_PRESETS.STRICT,
    },
    guestLogin: {
      windowMs: 15 * 60 * 1000,
      maxRequestsPerIp: 20,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
  },

  account: {
    changePassword: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerUser: 5,
      preset: RATE_LIMIT_PRESETS.STRICT,
    },
    changeUsername: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerUser: 10,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    changeEmail: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerUser: 5,
      preset: RATE_LIMIT_PRESETS.STRICT,
    },
    updateUserTheme: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 30,
      preset: RATE_LIMIT_PRESETS.RELAXED,
    },
    deleteAccount: {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequestsPerUser: 2,
      preset: RATE_LIMIT_PRESETS.STRICT,
    },
  },

  project: {
    getProjects: {
      windowMs: 1 * 60 * 1000,
      maxRequestsPerUser: 120,
      preset: RATE_LIMIT_PRESETS.RELAXED,
    },
    getProject: {
      windowMs: 1 * 60 * 1000,
      maxRequestsPerUser: 120,
      preset: RATE_LIMIT_PRESETS.RELAXED,
    },
    addProject: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerUser: 20,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    updateProject: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 60,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    deleteProject: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerUser: 10,
      preset: RATE_LIMIT_PRESETS.STRICT,
    },
    cloneProject: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerUser: 10,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    exportProject: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerUser: 20,
      preset: RATE_LIMIT_PRESETS.HEAVY,
    },
    exportFilteredProject: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerUser: 20,
      preset: RATE_LIMIT_PRESETS.HEAVY,
    },
    updateProjectPermissions: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerUser: 20,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    updateProjectVisibility: {
      windowMs: 60 * 60 * 1000,
      maxRequestsPerUser: 20,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
  },

  data: {
    getData: {
      windowMs: 1 * 60 * 1000,
      maxRequestsPerUser: 180,
      preset: RATE_LIMIT_PRESETS.RELAXED,
    },
    getOneDataItem: {
      windowMs: 1 * 60 * 1000,
      maxRequestsPerUser: 180,
      preset: RATE_LIMIT_PRESETS.RELAXED,
    },
    addDataItem: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 120,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    quickAddDataItem: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 180,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    updateDataItem: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 180,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    dragDataItem: {
      windowMs: 1 * 60 * 1000,
      maxRequestsPerUser: 300,
      preset: RATE_LIMIT_PRESETS.RELAXED,
    },
    deleteDataItem: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 60,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
  },

  extension: {
    getExtensionData: {
      windowMs: 1 * 60 * 1000,
      maxRequestsPerUser: 180,
      preset: RATE_LIMIT_PRESETS.RELAXED,
    },
    addGalleryImage: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 40,
      preset: RATE_LIMIT_PRESETS.HEAVY,
    },
    deleteGalleryImage: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 60,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    addGuestbookEntry: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 30,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    deleteGuestbookEntry: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 30,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    addBulletinMessage: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 40,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    deleteBulletinMessage: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 40,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
    addChatMessage: {
      windowMs: 1 * 60 * 1000,
      maxRequestsPerUser: 120,
      preset: RATE_LIMIT_PRESETS.RELAXED,
    },
    deleteChatMessage: {
      windowMs: 10 * 60 * 1000,
      maxRequestsPerUser: 60,
      preset: RATE_LIMIT_PRESETS.MODERATE,
    },
  },
};

export const RATE_LIMIT_IDENTIFIERS = {
  ip: "ip",
  user: "user",
  email: "email",
  account: "account",
  project: "project",
};

export const FILE_SIZE_LIMITS = {
  imageUpload: {
    maxBytes: 2 * 1024 * 1024,
    label: "2 MB",
  },
  importFile: {
    maxBytes: 10 * 1024 * 1024,
    label: "10 MB",
  },
};

export const FILE_TYPE_LIMITS = {
  importMimeTypes: [
    "application/json",
    "application/geo+json",
    "application/zip",
    "text/csv",
  ],
};