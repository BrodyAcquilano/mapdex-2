// src/engines/presence/engine.js

import AppAdapter from "./AppAdapter.jsx";
import { PagesAdapter, getPagesConfig } from "./PagesAdapter.jsx";
import MapAdapter from "./MapAdapter.jsx";
import GalleryModal from "../../extensions/GalleryModal.jsx";
import BulletinModal from "../../extensions/BulletinModal.jsx";
import ChatPanel from "../../extensions/ChatPanel.jsx";

export const PresenceEngine = {
  key: "presence",
  label: "Presence",
  geometry: ["Point"],
  time: "Event",

  AppAdapter,
  PagesAdapter,
  getPagesConfig,
  MapAdapter,

   extensionModals: {
    Gallery: GalleryModal,
    Bulletin: BulletinModal,
    Chat: ChatPanel,
  },

  schemaRules: {
    geometryLockedFields: ["types", "isFilter"],
    timeLockedFields: ["type", "isFilter", "modes", "defaultDurationMinutes"],

    lockedSections: [
    ],

    lockedInputs: [
    ],

    addableInputTypes: [
      "text",
      "number",
      "percentage",
      "website",
      "phoneNumber",
      "email",
      "checkbox",
      "dropdown",
      "notes",
      "capacity",
      "hours",
      "ageRange",
      "priceRangeArray",
      "tagList"
    ],
  },

  extensions: {
    Gallery: {
      configurable: true,
    },
    Bulletin: {
      configurable: true,
    },
    Chat: {
      configurable: true,
    },
  },
};