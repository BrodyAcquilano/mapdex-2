// system/voice/commands/polygonsMapPanelCommands.js

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function zoomMap(map, delta) {
  if (!map) return;

  const currentZoom = map.getZoom?.();
  const minZoom = map.getMinZoom?.();
  const maxZoom = map.getMaxZoom?.();

  if (
    typeof currentZoom !== "number" ||
    typeof minZoom !== "number" ||
    typeof maxZoom !== "number"
  ) {
    return;
  }

  const nextZoom = clamp(currentZoom + delta, minZoom, maxZoom);
  map.setZoom(nextZoom);
}

export default [
  {
    command: "zoom in",
    aliases: ["zoom in", "zoom closer", "increase zoom"],
    match: /\b(zoom in|zoom closer|increase zoom)\b/i,
    description: "Zoom in, Zoom closer, Increase zoom",
    section: "Map",
    handler: ({ map }) => {
      zoomMap(map, 1);
    },
  },
  {
    command: "zoom out",
    aliases: ["zoom out", "zoom farther", "decrease zoom"],
    match: /\b(zoom out|zoom farther|decrease zoom)\b/i,
    description: "Zoom out, Zoom farther, Decrease zoom",
    section: "Map",
    handler: ({ map }) => {
      zoomMap(map, -1);
    },
  },
  {
    command: "pan up",
    aliases: ["pan up", "move north", "pan north", "go north"],
    match: /\b(pan up|move north|pan north|go north)\b/i,
    description: "Pan up, Move north, Pan north, Go north",
    section: "Map",
    handler: ({ map }) => {
      map?.panNorth?.();
    },
  },
  {
    command: "pan down",
    aliases: ["pan down", "move south", "pan south", "go south"],
    match: /\b(pan down|move south|pan south|go south)\b/i,
    description: "Pan down, Move south, Pan south, Go south",
    section: "Map",
    handler: ({ map }) => {
      map?.panSouth?.();
    },
  },
  {
    command: "pan left",
    aliases: ["pan left", "move west", "pan west", "go west"],
    match: /\b(pan left|move west|pan west|go west)\b/i,
    description: "Pan left, Move west, Pan west, Go west",
    section: "Map",
    handler: ({ map }) => {
      map?.panWest?.();
    },
  },
  {
    command: "pan right",
    aliases: ["pan right", "move east", "pan east", "go east"],
    match: /\b(pan right|move east|pan east|go east)\b/i,
    description: "Pan right, Move east, Pan east, Go east",
    section: "Map",
    handler: ({ map }) => {
      map?.panEast?.();
    },
  },
  {
    command: "fit to data",
    aliases: [
      "fit to data",
      "show all polygons",
      "fit polygons",
      "center on polygons",
      "recenter on data",
    ],
    match: /\b(fit to data|show all polygons|fit polygons|center on polygons|recenter on data)\b/i,
    description: "Fit to data, Show all polygons, Fit polygons, Center on polygons, Recenter on data",
    section: "Map",
    handler: ({ map, data }) => {
      map?.fitToData?.(data || []);
    },
  },
  {
    command: "close popup",
    aliases: ["close popup", "hide popup"],
    match: /\b(close popup|hide popup)\b/i,
    description: "Close popup, Hide popup",
    section: "Map",
    handler: ({ map }) => {
      map?.closePopup?.();
    },
  },
    {
    command: "deselect polygon",
    aliases: [
      "deselect polygon",
      "clear selection",
      "unselect polygon",
      "deselect",
    ],
    match: /\b(deselect polygon|clear selection|unselect polygon|deselect)\b/i,
    description:
      "Deselect polygon, Clear selection, Unselect polygon, Deselect",
    section: "Map",
    handler: ({ setSelectedDataItem, map }) => {
      setSelectedDataItem?.(null);
      map?.closePopup?.();
    },
  },
];