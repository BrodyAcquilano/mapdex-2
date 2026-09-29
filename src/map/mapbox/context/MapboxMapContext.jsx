// src/map/mapbox/context/MapboxMapContext.jsx

import { createContext, useContext } from "react";

/*
 * Exposes the single, session-persistent mapboxgl.Map instance owned
 * by MapboxMapShell.jsx to whichever engine's content is currently
 * mounted inside it, without prop-drilling it through MapShellHost.
 */
const MapboxMapContext = createContext(null);

export function MapboxMapProvider({ mapboxMap, children }) {
  return (
    <MapboxMapContext.Provider value={mapboxMap}>
      {children}
    </MapboxMapContext.Provider>
  );
}

export function useMapboxMapInstance() {
  return useContext(MapboxMapContext);
}
