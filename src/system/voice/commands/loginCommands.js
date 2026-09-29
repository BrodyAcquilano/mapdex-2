// login commands

export default [
  {
    command: "show password",
    aliases: ["show password"],
    match: /\bshow password\b/i,
    description: "Show password",
    section: "Login Page",
    handler: () => {
      document.querySelector(".toggle-password")?.click();
    },
  },

  {
    command: "hide password",
    aliases: ["hide password"],
    match: /\bhide password\b/i,
    description: "Hide password",
    section: "Login Page",
    handler: () => {
      document.querySelector(".toggle-password")?.click();
    },
  },

  {
    command: "sign in",
    aliases: ["sign in", "log in", "submit"],
    match: /\b(sign in|log in|submit)\b/i,
    description: "Sign in, Log in, Submit",
    section: "Login Page",
    handler: () => {
      document.querySelector(".primary-btn")?.click();
    },
  },

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
    section: "Login Page",
    handler: () => {
      const el = document.querySelector("#signin-email");
      if (!el) return;

      el.focus();
      window.__voiceFocusedInput = el;
      el.__cursor = el.selectionStart ?? el.value.length;
    },
  },

  {
    command: "forgot password",
    aliases: ["forgot password"],
    match: /\bforgot password\b/i,
    description: "Forgot password",
    section: "Login Page",
    handler: ({ navigate }) => navigate("/reset-password-request"),
  },

  {
    command: "password",
    aliases: ["password", "password field", "enter password", "focus password"],
    match: /\b(password|password field|enter password|focus password)\b/i,
    description: "Password, Password field, Enter password, Focus password",
    section: "Login Page",
    handler: () => {
      const el = document.querySelector("#signin-password");
      if (!el) return;

      el.focus();
      window.__voiceFocusedInput = el;
      el.__cursor = el.selectionStart ?? el.value.length;
    },
  },

  {
    command: "create account",
    aliases: ["create account", "register", "sign up"],
    match: /\b(create account|register|sign up)\b/i,
    description: "Create account, Register, Sign up",
    section: "Login Page",
    handler: ({ navigate }) => navigate("/register"),
  },

  {
    command: "home",
    aliases: ["home", "go home", "home page"],
    match: /\b(home|go home|home page)\b/i,
    description: "Home, Go home, Home page",
    section: "Login Page",
    handler: ({ navigate }) => navigate("/"),
  },
];