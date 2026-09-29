// src/workspace/community/userColorTheme.js
// Single source of truth for each USER_COLOR_THEME_OPTIONS key's palette.
// `fill`/`stroke`/`pulseColor` are also used for the live presence map
// marker (see GlobalRuntime.jsx, which imports USER_ICON_THEMES from here);
// `text` is used only for rendering a readable username on top of `fill`
// (owner rows, search results, follower/following lists, user profiles).

export const USER_ICON_THEMES = {
  green: {
    pulseColor: "rgb(119, 188, 126)",
    fill: "rgba(26, 203, 53, 0.96)",
    stroke: "rgba(35, 98, 47, 0.8)",
    text: "#157a20",
  },

  blue: {
    pulseColor: "rgba(83, 161, 189, 1)",
    fill: "rgba(132, 223, 248, 0.96)",
    stroke: "rgba(65, 135, 154, 0.8)",
    text: "#1c6f8c",
  },

  red: {
    pulseColor: "rgb(189, 83, 83)",
    fill: "rgba(169, 37, 37, 0.96)",
    stroke: "rgba(143, 27, 37, 0.8)",
    text: "#ffffff",
  },

  yellow: {
    pulseColor: "rgb(189, 205, 98)",
    fill: "rgba(170, 188, 67, 0.96)",
    stroke: "rgba(107, 119, 41, 0.96)",
    text: "#4c5419",
  },

  purple: {
    pulseColor: "rgb(157, 106, 196)",
    fill: "rgba(186, 127, 235, 0.96)",
    stroke: "rgba(112, 61, 152, 0.85)",
    text: "#4a2568",
  },

  pink: {
    pulseColor: "rgb(219, 120, 171)",
    fill: "rgba(244, 143, 197, 0.96)",
    stroke: "rgba(171, 75, 125, 0.85)",
    text: "#7a2c53",
  },

  orange: {
    pulseColor: "rgb(223, 145, 83)",
    fill: "rgba(245, 156, 73, 0.96)",
    stroke: "rgba(176, 101, 31, 0.85)",
    text: "#6b3c12",
  },

  teal: {
    pulseColor: "rgb(76, 175, 164)",
    fill: "rgba(64, 201, 183, 0.96)",
    stroke: "rgba(33, 125, 116, 0.85)",
    text: "#0f5148",
  },

  indigo: {
    pulseColor: "rgb(104, 117, 204)",
    fill: "rgba(112, 127, 238, 0.96)",
    stroke: "rgba(63, 74, 161, 0.85)",
    text: "#ffffff",
  },

  white: {
    pulseColor: "rgba(220, 220, 220, 0.9)",
    fill: "rgba(250, 250, 250, 0.97)",
    stroke: "rgba(97, 94, 94, 0.9)",
    text: "#3a3a3a",
  },

  black: {
    pulseColor: "rgba(90, 90, 90, 0.9)",
    fill: "rgba(40, 40, 40, 0.97)",
    stroke: "rgba(173, 172, 172, 0.95)",
    text: "#ffffff",
  },
};

export function getUserColorTheme(themeKey) {
  return USER_ICON_THEMES[themeKey] || USER_ICON_THEMES.green;
}
