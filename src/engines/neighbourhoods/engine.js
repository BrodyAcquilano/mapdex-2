// src/engines/neighbourhoods/engine.js

import AppAdapter from "./AppAdapter.jsx";
import { PagesAdapter, getPagesConfig } from "./PagesAdapter.jsx";
import MapAdapter from "./MapAdapter.jsx";
import BulletinModal from "../../extensions/BulletinModal.jsx";
import ChatPanel from "../../extensions/ChatPanel.jsx";

const LOCKED_COMMON_FIELDS = [
  "isRequired",
  "isFilter",
  "isDisplayed",
  "minValue",
  "maxValue",
  "maxLength",
  "displayIfEmpty",
  "emptyDisplayText",
  "modeOptions",
];

export const NeighbourhoodsEngine = {
  key: "neighbourhoods",
  label: "Neighbourhoods",
  geometry: ["Polygon"],
  time: "None",
  AppAdapter: AppAdapter,
  PagesAdapter: PagesAdapter,
  getPagesConfig: getPagesConfig,
  MapAdapter: MapAdapter,

  extensionModals: {
    Bulletin: BulletinModal,
    Chat: ChatPanel,
  },

  schemaRules: {
    geometryLockedFields: ["types", "isFilter"],
    timeLockedFields: ["type", "isFilter", "isDisplayed"],

    lockedSections: [
      0, // Location
      1, // Census Base Metrics
      2, // Neighbourhood Assets
      3, // Neighbourhood Capacity
      4, // Neighbourhood Profile (%)
    ],

    lockedInputs: [
      // ─────────────────────────────────────────────
      // Location
      // ─────────────────────────────────────────────
      {
        sectionIndex: 0,
        inputIndex: 0, // Neighbourhood
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 0,
        inputIndex: 1, // Population
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },

      // ─────────────────────────────────────────────
      // Census Base Metrics
      // ─────────────────────────────────────────────
      {
        sectionIndex: 1,
        inputIndex: 0, // Municipality
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 1,
        inputIndex: 1, // Total Private Dwellings
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 1,
        inputIndex: 2, // Occupied Private Dwellings
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 1,
        inputIndex: 3, // Land Area (sq km)
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 1,
        inputIndex: 4, // Population Density (per sq km)
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },

      // ─────────────────────────────────────────────
      // Neighbourhood Assets
      // ─────────────────────────────────────────────
      {
        sectionIndex: 2,
        inputIndex: 0, // Green Space
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 2,
        inputIndex: 1, // Schools
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 2,
        inputIndex: 2, // Libraries
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 2,
        inputIndex: 3, // Healthcare
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 2,
        inputIndex: 4, // Transit Stops
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 2,
        inputIndex: 5, // Community Spaces
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },

      // ─────────────────────────────────────────────
      // Neighbourhood Capacity
      // ─────────────────────────────────────────────
      {
        sectionIndex: 3,
        inputIndex: 0, // Green Space Capacity
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 3,
        inputIndex: 1, // School Capacity
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 3,
        inputIndex: 2, // Library Capacity
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 3,
        inputIndex: 3, // Healthcare Capacity
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 3,
        inputIndex: 4, // Transit Stop Capacity
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 3,
        inputIndex: 5, // Community Space Capacity
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },

      // ─────────────────────────────────────────────
      // Neighbourhood Profile (%)
      // ─────────────────────────────────────────────
      {
        sectionIndex: 4,
        inputIndex: 0, // Single-Detached Housing
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 4,
        inputIndex: 1, // Overcrowded Housing
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 4,
        inputIndex: 2, // Unaffordable Housing
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 4,
        inputIndex: 3, // Transit Commuters
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 4,
        inputIndex: 4, // Households with Children
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 4,
        inputIndex: 5, // Low-Income Households
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 4,
        inputIndex: 6, // Non-Official Language Speakers
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
      {
        sectionIndex: 4,
        inputIndex: 7, // Visible Minorities
        lockedFields: [...LOCKED_COMMON_FIELDS],
      },
    ],

    addableInputTypes: [],
  },

  extensions: {
    Bulletin: {
      configurable: true,
    },
    Chat: {
      configurable: true,
    },
  },
};