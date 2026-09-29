// landing commands

export default [
  {
    command: "sign in",
    aliases: ["sign in", "login", "access account"],
    match: /\b(sign in|login|access account)\b/i,
    description: "Sign in, Login, Access account",
    section: "Landing Page",
    handler: ({ navigate }) => navigate("/login"),
  },
  {
    command: "create account",
    aliases: ["create account", "register", "sign up"],
    match: /\b(create account|register|sign up)\b/i,
    description: "Create account, Register, Sign up",
    section: "Landing Page",
    handler: ({ navigate }) => navigate("/register"),
  },
];