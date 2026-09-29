import { USER_COLOR_THEME_OPTIONS } from "./userConstants.js";

export function validateUserColorTheme(userColorTheme) {
  if (typeof userColorTheme !== "string") {
    return "User color theme must be text.";
  }

  const normalizedUserColorTheme = userColorTheme.trim();

  if (!normalizedUserColorTheme) {
    return "User color theme is required.";
  }

  if (!USER_COLOR_THEME_OPTIONS.includes(normalizedUserColorTheme)) {
    return "Invalid user color theme.";
  }

  return null;
}