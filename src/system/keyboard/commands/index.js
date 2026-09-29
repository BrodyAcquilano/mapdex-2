// system/keyboard/index.js

import authKeyboardCommands from "./authKeyboardCommands";
import globalKeyboardCommands from "./globalKeyboardCommands";

const keyboardCommandSets = {
  globalKeyboardCommands,
  authKeyboardCommands,
};

export function getKeyboardCommands(key) {
  return keyboardCommandSets[key] || [];
}