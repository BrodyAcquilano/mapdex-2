// register commands

export const registerCommands = [
 {
    command: "show confirm password",
    aliases: ["show confirm password"],
    match: /\bshow confirm password\b/i,
    description: "Show confirm password",
    section: "Register Page",
    handler: () => {
      document
        .querySelector("#signup-confirm-password + .toggle-password")
        ?.click();
    },
  },

  {
    command: "hide confirm password",
    aliases: ["hide confirm password"],
    match: /\bhide confirm password\b/i,
    description: "Hide confirm password",
    section: "Register Page",
    handler: () => {
      document
        .querySelector("#signup-confirm-password + .toggle-password")
        ?.click();
    },
  },

  {
    command: "show password",
    aliases: ["show password"],
    match: /\bshow password\b/i,
    description: "Show password",
    section: "Register Page",
    handler: () => {
      document.querySelector("#signup-password + .toggle-password")?.click();
    },
  },

  {
    command: "hide password",
    aliases: ["hide password"],
    match: /\bhide password\b/i,
    description: "Hide password",
    section: "Register Page",
    handler: () => {
      document.querySelector("#signup-password + .toggle-password")?.click();
    },
  },

  {
    command: "create account",
    aliases: ["create account", "register", "sign up", "submit"],
    match: /\b(create account|register|sign up|submit)\b/i,
    description: "Create account, Register, Sign up, Submit",
    section: "Register Page",
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
    section: "Register Page",
    handler: () => {
      const el = document.querySelector("#signup-email");
      if (!el) return;

      el.focus();
      window.__voiceFocusedInput = el;
      el.__cursor = el.selectionStart ?? el.value.length;
    },
  },

  {
  command: "username",
  aliases: [
    "user name",
    "user name",
    "user name field",
    "enter user name",
    "focus user name",
  ],
  match: /\b(user name|user name field|enter user name|focus user name)\b/i,
  description:
    "Username, Username field, Enter username, Focus username",
  section: "Register Page",
  handler: () => {
    const el = document.querySelector("#signup-username");
    if (!el) return;

    el.focus();
    window.__voiceFocusedInput = el;
    el.__cursor = el.selectionStart ?? el.value.length;
  },
},

  {
    command: "confirm password",
    aliases: [
      "confirm password",
      "confirm password field",
      "enter confirm password",
      "focus confirm password",
    ],
    match: /\b(confirm password|confirm password field|enter confirm password|focus confirm password)\b/i,
    description:
      "Confirm password, Confirm password field, Enter confirm password, Focus confirm password",
    section: "Register Page",
    handler: () => {
      const el = document.querySelector("#signup-confirm-password");
      if (!el) return;

      el.focus();
      window.__voiceFocusedInput = el;
      el.__cursor = el.selectionStart ?? el.value.length;
    },
  },

  {
    command: "password",
    aliases: ["password", "password field", "enter password", "focus password"],
    match: /\b(password|password field|enter password|focus password)\b/i,
    description: "Password, Password field, Enter password, Focus password",
    section: "Register Page",
    handler: () => {
      const el = document.querySelector("#signup-password");
      if (!el) return;

      el.focus();
      window.__voiceFocusedInput = el;
      el.__cursor = el.selectionStart ?? el.value.length;
    },
  },

  {
    command: "sign in",
    aliases: ["sign in", "log in", "login page", "go to login"],
    match: /\b(sign in|log in|login page|go to login)\b/i,
    description: "Sign in, Log in, Login page, Go to login",
    section: "Register Page",
    handler: ({ navigate }) => navigate("/login"),
  },

  {
    command: "home",
    aliases: ["home", "go home", "home page"],
    match: /\b(home|go home|home page)\b/i,
    description: "Home, Go home, Home page",
    section: "Register Page",
    handler: ({ navigate }) => navigate("/"),
  },
];

export const registerSuccessCommands = [
  {
    command: "sign in",
    aliases: ["sign in", "log in", "login page", "go to login"],
    match: /\b(sign in|log in|login page|go to login)\b/i,
    description: "Sign in, Log in, Login page, Go to login",
    section: "Register Verification Page",
    handler: ({ navigate }) => navigate("/login"),
  },

  {
    command: "home",
    aliases: ["home", "go home", "home page"],
    match: /\b(home|go home|home page)\b/i,
    description: "Home, Go home, Home page",
    section: "Register Verification Page",
    handler: ({ navigate }) => navigate("/"),
  },
];