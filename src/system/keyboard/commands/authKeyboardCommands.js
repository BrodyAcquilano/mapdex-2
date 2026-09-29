// system/keyboard/commands/authKeyboardCommands.js

export default [
  {
    key: "down",
    handler: () => {
      const focusables = document.querySelectorAll(
        "input, button, a"
      );

      const active = document.activeElement;
      const index = Array.from(focusables).indexOf(active);

      const next = focusables[index + 1] || focusables[0];
      next?.focus();
    },
  },
  {
    key: "up",
    handler: () => {
      const focusables = document.querySelectorAll(
        "input, button, a"
      );

      const active = document.activeElement;
      const index = Array.from(focusables).indexOf(active);

      const prev = focusables[index - 1] || focusables[focusables.length - 1];
      prev?.focus();
    },
  },
];