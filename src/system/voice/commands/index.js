// system/voice/commands/index.js

import global from "./globalCommands";

import landing from "./landingCommands";
import login from "./loginCommands";

import {
  resetPasswordRequestCommands,
  resetPasswordRequestSuccessCommands,
} from "./resetPasswordRequestCommands";

import {
  registerCommands,
  registerSuccessCommands,
} from "./registerCommands";

import resetPassword from "./resetPasswordCommands";

import polygonsMapPanel from "./polygonsMapPanelCommands";
import geometryMapPanel from "./geometryMapPanelCommands";
import map from "./mapCommands";

import trackLocationButton from "./trackLocationButtonCommands";
import settingsToggle from "./settingsToggleCommands";
import settingsModal from "./settingsModalCommands";

const voiceCommandSets = {
  global,
  landing,
  login,

  register: registerCommands,
  registerSuccess: registerSuccessCommands,

  resetPasswordRequest: resetPasswordRequestCommands,
  resetPasswordRequestSuccess: resetPasswordRequestSuccessCommands,

  resetPassword,

  polygonsMapPanel,
  geometryMapPanel,
  map,

  trackLocationButton,
  settingsToggle,
  settingsModal,
};

export function getVoiceCommands(key) {
  return voiceCommandSets[key] || [];
}