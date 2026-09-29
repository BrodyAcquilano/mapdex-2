export const USER_TOP_LEVEL_FIELDS = [
  "_id",
  "email",
  "passwordHash",
  "emailVerified",
  "emailVerificationToken",
  "emailVerificationExpires",
  "passwordResetToken",
  "passwordResetExpires",
  "isDeleted",
  "deletedAt",
  "accountStatus",
  "oauthProviders",
  "subscriptionTier",
  "voicePlan",
  "userName",
  "userColorTheme",
  "followers",
  "following",
  "blockedUsers",
  "favouriteProjects",
  "createdAt",
  "updatedAt",
];


export const USER_FIELD_TYPES = {
  _id: "objectId",
  email: "string",
  passwordHash: "string",
  emailVerified: "boolean",
  emailVerificationToken: "string",
  emailVerificationExpires: "date",
  passwordResetToken: "string",
  passwordResetExpires: "date",
  isDeleted: "boolean",
  deletedAt: "date|null",
  accountStatus: "string",
  oauthProviders: "array",
  subscriptionTier: "string",
  voicePlan: "string",
  userName: "string",
  userColorTheme: "string",
  followers: "array",
  following: "array",
  blockedUsers: "array",
  favouriteProjects: "array",
  createdAt: "date",
  updatedAt: "date",
};

export const USER_SEARCH_LIMITS = {
  pageSize: 50,
  usernameSearchMaxLength: 24,
};

// Following is something a user actively grows and can be capped to limit
// abuse (mass-following). Followers and blockedUsers are not something the
// user directly controls the size of, so they are left unlimited.
export const USER_RELATIONSHIP_LIMITS = {
  maxFollowing: 5000,
};

// Favoriting is also something a user actively grows, so it gets the same
// kind of cap to limit abuse.
export const USER_FAVOURITE_LIMITS = {
  maxFavouriteProjects: 500,
};


export const RESERVED_USERNAMES = ["guest"];


export const SUBSCRIPTION_TIER_OPTIONS = ["free", "paid"];
export const VOICE_PLAN_OPTIONS = ["free", "paid"];

export const MAP_PLAN_OPTIONS = [
  "Leaflet",
  "Mapbox",
];


export const ACCOUNT_STATUS_OPTIONS = [
  "active",
  "suspended",
  "banned",
  "deleted",
  "deactivated",
];


export const USER_COLOR_THEME_OPTIONS = [
  "green",
  "blue",
  "red",
  "yellow",
  "purple",
  "pink",
  "orange",
  "teal",
  "indigo",
  "white",
  "black",
];


export const USER_TOKEN_FIELDS = [
  "emailVerificationToken",
  "emailVerificationExpires",
  "passwordResetToken",
  "passwordResetExpires",
];


export const USER_BOOLEAN_FIELDS = [
  "emailVerified",
  "isDeleted",
];


export const USER_DATE_FIELDS = [
  "deletedAt",
  "emailVerificationExpires",
  "passwordResetExpires",
  "createdAt",
  "updatedAt",
];


export const AUTH_CONSTANTS = {
  guestJwtExpiresIn: "1d",
  defaultJwtExpiresIn: "7d",
  verificationExpiryMs: 60 * 60 * 1000,
  passwordResetExpiryMs: 60 * 60 * 1000,
};