// src/runtime/index.js

import { useGlobalRuntime } from "./GlobalRuntime";
import { useEventsRuntime } from "./EventRuntime";
import { usePlacesRuntime } from "./PlacesRuntime";
import { useNeighbourhoodsRuntime } from "./NeighbourhoodsRuntime";
import { usePresenceRuntime } from "./PresenceRuntime";
import { useMotionRuntime } from "./MotionRuntime";

export function useAllRuntime() {
  const global = useGlobalRuntime();

  const places = usePlacesRuntime({
    schema: global.schema,
    setData: global.setData,
    trackLocation: global.trackLocation,
    setTrackLocation: global.setTrackLocation,
    dataUtils: global.dataUtils,
    blankFormTemplate: global.blankFormTemplate,
  });

  const events = useEventsRuntime({
    schema: global.schema,
    setData: global.setData,
    trackLocation: global.trackLocation,
    setTrackLocation: global.setTrackLocation,
    dataUtils: global.dataUtils,
    blankFormTemplate: global.blankFormTemplate,
  });

  const neighbourhoods = useNeighbourhoodsRuntime({
    schema: global.schema,
    filteredData: global.filteredData,
    trackLocation: global.trackLocation,
    setTrackLocation: global.setTrackLocation,
  });

  const presence = usePresenceRuntime({
    trackLocation: global.trackLocation,
    setTrackLocation: global.setTrackLocation,
  });

  const motion = useMotionRuntime({
    trackLocation: global.trackLocation,
    setTrackLocation: global.setTrackLocation,
  });

  return {
    global,
    places,
    events,
    neighbourhoods,
    presence,
    motion,
  };
}
