// system/voice/commands/resetPasswordRequestCommands.js

export const resetPasswordRequestCommands = [
  {
    command: "email",
    aliases: [
      "email",
      "e-mail",
      "email field",
      "e-mail field",
      "enter email",
      "enter e-mail",
      "focus email",
      "focus e-mail",
    ],
    match: /\b(email|e-mail|email field|e-mail field|enter email|enter e-mail|focus email|focus e-mail)\b/i,
    description: "Email, Email field, Enter email, Focus email",
    section: "Reset Password Request Page",
    handler: () => {
      const el = document.querySelector("#reset-email");
      if (!el) return;

      el.focus();
      window.__voiceFocusedInput = el;
      el.__cursor = el.selectionStart ?? el.value.length;
    },
  },

  {
    command: "reset password",
    aliases: [
      "reset password",
      "send reset link",
      "send link",
      "submit",
    ],
    match: /\b(reset password|send reset link|send link|submit)\b/i,
    description: "Reset password, Send reset link, Send link, Submit",
    section: "Reset Password Request Page",
    handler: () => {
      document.querySelector(".primary-btn")?.click();
    },
  },

  {
    command: "home",
    aliases: ["home", "go home", "home page"],
    match: /\b(home|go home|home page)\b/i,
    description: "Home, Go home, Home page",
    section: "Reset Password Request Page",
    handler: ({ navigate }) => navigate("/"),
  },

  {
    command: "sign in",
    aliases: ["sign in", "log in", "login page", "go to login"],
    match: /\b(sign in|log in|login page|go to login)\b/i,
    description: "Sign in, Log in, Login page, Go to login",
    section: "Reset Password Request Page",
    handler: ({ navigate }) => navigate("/login"),
  },
];

export const resetPasswordRequestSuccessCommands = [
  {
    command: "home",
    aliases: ["home", "go home", "home page"],
    match: /\b(home|go home|home page)\b/i,
    description: "Home, Go home, Home page",
    section: "Reset Password Request Success Page",
    handler: ({ navigate }) => navigate("/"),
  },

  {
    command: "sign in",
    aliases: ["sign in", "log in", "login page", "go to login"],
    match: /\b(sign in|log in|login page|go to login)\b/i,
    description: "Sign in, Log in, Login page, Go to login",
    section: "Reset Password Request Success Page",
    handler: ({ navigate }) => navigate("/login"),
  },
];