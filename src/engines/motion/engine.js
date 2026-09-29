// src/engines/motion/engine.js

import AppAdapter from "./AppAdapter.jsx";
import { PagesAdapter, getPagesConfig } from "./PagesAdapter.jsx";
import MapAdapter from "./MapAdapter.jsx";
import GalleryModal from "../../extensions/GalleryModal.jsx";
import BulletinModal from "../../extensions/BulletinModal.jsx";
import ChatPanel from "../../extensions/ChatPanel.jsx";

const LOCKED_MOTION_NAME_FIELDS = [
  "type",
  "isRequired",
  "isFilter",
  "isDisplayed",
  "displayIfEmpty",
  "emptyDisplayText",
  "maxLength",
];

export const MotionEngine = {
  key: "motion",
  label: "Motion",

  geometry: ["LineString"],
  time: "Motion",

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
    timeLockedFields: ["type", "isDisplayed"],

    lockedSections: [
      0, // Motion Details
    ],

    lockedInputs: [
      {
        sectionIndex: 0,
        inputIndex: 0, // Motion Record Name
        lockedFields: [...LOCKED_MOTION_NAME_FIELDS],
      },
    ],

    addableInputTypes: [
      "text",
      "number",
      "percentage",
      "checkbox",
      "dropdown",
      "notes",
    ],
  },

  extensions: {
    Gallery: {
      configurable: true,
    },
    Guestbook: {
      configurable: false,
    },
    Bulletin: {
      configurable: true,
    },
    Chat: {
      configurable: true,
    },
  },
};