// system/voice/commands/resetPasswordCommands.js

export default [
  {
    command: "show confirm password",
    aliases: ["show confirm password, show confirm new password"],
    match: /\bshow confirm password|show confirm new password\b/i,
    description: "Show confirm password, Show confirm new password",
    section: "Reset Password Page",
    handler: () => {
      document
        .querySelector("#confirm-new-password + .toggle-password")
        ?.click();
    },
  },

  {
    command: "hide confirm password",
    aliases: ["hide confirm password, hide confirm new password"],
    match: /\bhide confirm password|hide confirm new password\b/i,
    description: "Hide confirm password, Hide confirm new password",
    section: "Reset Password Page",
    handler: () => {
      document
        .querySelector("#confirm-new-password + .toggle-password")
        ?.click();
    },
  },

  {
    command: "show password",
    aliases: ["show password, show new password"],
    match: /\bshow password|show new password\b/i,
    description: "Show password, Show new password",
    section: "Reset Password Page",
    handler: () => {
      document.querySelector("#new-password + .toggle-password")?.click();
    },
  },

  {
    command: "hide password",
    aliases: ["hide password, hide new password"],
    match: /\bhide password|hide new password\b/i,
    description: "Hide password, Hide new password",
    section: "Reset Password Page",
    handler: () => {
      document.querySelector("#new-password + .toggle-password")?.click();
    },
  },

    {
    command: "reset password",
    aliases: ["reset password", "change password", "submit"],
    match: /\b(reset password|change password|submit)\b/i,
    description: "Reset password, Change password, Submit",
    section: "Reset Password Page",
    handler: () => {
      document.querySelector(".primary-btn")?.click();
    },
  },

  {
    command: "confirm password",
    aliases: [
      "confirm password",
      "confirm password field",
      "enter confirm password",
      "focus confirm password",
      "confirm new password",
      "confirm new password field",
      "enter confirm new password",
      "focus confirm new password",
    ],
    match:
      /\b(confirm password|confirm password field|enter confirm password|focus confirm password|confirm new password|confirm new password field|enter confirm new password|focus confirm new password)\b/i,
    description:
      "Confirm password, Confirm password field, Enter confirm password, Focus confirm password",
    section: "Reset Password Page",
    handler: () => {
      const el = document.querySelector("#confirm-new-password");
      if (!el) return;

      el.focus();
      window.__voiceFocusedInput = el;
      el.__cursor = el.selectionStart ?? el.value.length;
    },
  },

  

  {
    command: "password",
    aliases: [
      "password",
      "password field",
      "enter password",
      "focus password",
      "new password",
      "new password field",
      "enter new password",
      "focus new password",
    ],
    match:
      /\b(password|password field|enter password|focus password|new password|new password field|enter new password|focus new password)\b/i,
    description: "Password, Password field, Enter password, Focus password",
    section: "Reset Password Page",
    handler: () => {
      const el = document.querySelector("#new-password");
      if (!el) return;

      el.focus();
      window.__voiceFocusedInput = el;
      el.__cursor = el.selectionStart ?? el.value.length;
    },
  },


  {
    command: "home",
    aliases: ["home", "go home", "home page"],
    match: /\b(home|go home|home page)\b/i,
    description: "Home, Go home, Home page",
    section: "Reset Password Page",
    handler: ({ navigate }) => navigate("/"),
  },
];