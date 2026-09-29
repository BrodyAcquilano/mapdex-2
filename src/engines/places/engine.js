// src/engines/places/engine.js

import AppAdapter from "./AppAdapter.jsx";
import { PagesAdapter, getPagesConfig } from "./PagesAdapter.jsx";
import MapAdapter from "./MapAdapter.jsx";
import GalleryModal from "../../extensions/GalleryModal.jsx";
import GuestbookModal from "../../extensions/GuestbookModal.jsx";
import BulletinModal from "../../extensions/BulletinModal.jsx";
import ChatPanel from "../../extensions/ChatPanel.jsx";

export const PlacesEngine = {
  key: "places",
  label: "Places",
  geometry: [
    "Point",
    "LineString",
    "Polygon",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
  ],
  time: "None",

  AppAdapter: AppAdapter,
  PagesAdapter: PagesAdapter,
  getPagesConfig: getPagesConfig,
  MapAdapter: MapAdapter,

  extensionModals: {
    Gallery: GalleryModal,
    Guestbook: GuestbookModal,
    Bulletin: BulletinModal,
    Chat: ChatPanel,
  },

  schemaRules: {
    geometryLockedFields: ["isFilter"],
    timeLockedFields: ["type", "isFilter", "isDisplayed"],

    lockedSections: [],

    lockedInputs: [],

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
      "tagList",
    ],
  },

  extensions: {
    Gallery: {
      configurable: true,
    },
    Guestbook: {
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
