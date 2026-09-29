// src/engines/index.js

import { EventsEngine } from "./events/engine.js";
import { PlacesEngine } from "./places/engine.js";
import { NeighbourhoodsEngine } from "./neighbourhoods/engine.js";
import { PresenceEngine } from "./presence/engine.js";
import { MotionEngine } from "./motion/engine.js";

const ENGINE_REGISTRY = {
  places: PlacesEngine,
  events: EventsEngine,
  neighbourhoods: NeighbourhoodsEngine,
  presence: PresenceEngine,
  motion: MotionEngine,
};

export function getEngine(engineKey) {
  return ENGINE_REGISTRY[engineKey] ?? null;
}

export function getEngineList() {
  return Object.values(ENGINE_REGISTRY).map((engine) => ({
    key: engine.key,
    label: engine.label,
  }));
}