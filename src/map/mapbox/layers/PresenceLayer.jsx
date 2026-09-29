// src/map/mapbox/layers/PresenceLayer.jsx

import { useEffect, useRef } from "react";
import * as mapboxgl from "mapbox-gl/esm";

import { createUserMarkerElement } from "../icons/createUserMarkerElement.js";
import MapboxSelectedItemPopup from "../popup/MapboxSelectedItemPopup.jsx";

const DEFAULT_USER_COLOR_THEME = {
  pulseColor: "rgb(119, 188, 126)",
  fill: "rgba(26, 203, 53, 0.96)",
  stroke: "rgba(35, 98, 47, 0.8)",
};

function isFiniteCoordinatePair(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return false;

  return (
    Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]))
  );
}

/*
 * Every presence data item IS someone's live location, the same way
 * track-location's own single "you are here" marker is one person's -
 * so this renders each one with that exact same pulsing marker element
 * (createUserMarkerElement, shared with UserLayer.jsx) as an imperative
 * mapboxgl.Marker, instead of the plain static GL circle layer this
 * used to be. Mirrors the old Leaflet PresenceLayer.jsx (deleted along
 * with the rest of src/map/leaflet/), which used the same pulsing icon
 * for every item via react-leaflet's own declarative <Marker>.
 */
export default function MapboxPresenceLayer({
  mapboxMap,
  map,
  data,
  selectedDataItem,
  setSelectedDataItem,
  USER_ICON_THEMES,
  currentPage,
  dataUtils,
  schema,
}) {
  const dataRef = useRef(data || []);
  const markersRef = useRef(new Map());

  const isEditorPage = currentPage === "editor";

  useEffect(() => {
    dataRef.current = Array.isArray(data) ? data : [];
  }, [data]);

  /*
   * On the editor page there's always exactly one presence item (the
   * current user's own draft). Keep it selected automatically,
   * mirroring the old Leaflet PresenceLayer.
   */
  useEffect(() => {
    if (!isEditorPage) return;
    if (!Array.isArray(data) || data.length !== 1) return;

    const onlyItem = data[0];
    if (!onlyItem?._id) return;

    if (String(selectedDataItem?._id || "") !== String(onlyItem._id)) {
      setSelectedDataItem(onlyItem);
    }
  }, [isEditorPage, data, selectedDataItem?._id, setSelectedDataItem]);

  /*
   * Flies the camera to whichever item is currently selected - a
   * one-time fly-to on selection, not a continuous camera lock the way
   * track-location's own lock is elsewhere (Presence's own trackLocation
   * means "I'm broadcasting," never a camera follow - see
   * src/engines/presence/MapAdapter.jsx's own comment). On the editor
   * page this fires the moment the lone draft item auto-selects above,
   * reading as "jump to your own draft location" - mirrors the old
   * Leaflet PresenceLayer.jsx exactly, which had no isEditorPage gate
   * either, so a click-to-select on the ordinary Presence view flies to
   * that user too.
   */
  useEffect(() => {
    if (!selectedDataItem?._id) return;

    const lng = selectedDataItem?.geometry?.coordinates?.[0];
    const lat = selectedDataItem?.geometry?.coordinates?.[1];

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    map?.focus(lat, lng, selectedDataItem._id, 0.4);
  }, [selectedDataItem?._id, map]);

  /*
   * Creates/updates/removes one mapboxgl.Marker per presence item.
   * Markers are keyed by id so an existing one just gets its position
   * (and selected-state class) updated in place rather than being torn
   * down and recreated on every data refresh - only ids no longer
   * present get removed, and only new ids get a freshly-built marker.
   */
  useEffect(() => {
    if (!mapboxMap) {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      return;
    }

    const markers = markersRef.current;
    const nextIds = new Set();

    const selectedId =
      selectedDataItem?._id != null ? String(selectedDataItem._id) : null;

    for (const dataItem of data || []) {
      const coordinates = dataItem?.geometry?.coordinates;
      if (!isFiniteCoordinatePair(coordinates)) continue;

      const id = String(dataItem._id);
      nextIds.add(id);

      const isSelected = selectedId !== null && selectedId === id;
      const theme = USER_ICON_THEMES?.[dataItem?.userColorTheme] || DEFAULT_USER_COLOR_THEME;

      const existing = markers.get(id);

      if (existing) {
        existing.marker.setLngLat(coordinates);

        if (existing.isSelected !== isSelected) {
          existing.element.className = `pulse-user-icon ${isSelected ? "pulse-user-icon-selected" : ""}`;
          existing.isSelected = isSelected;
        }

        continue;
      }

      const element = createUserMarkerElement(theme, { isSelected });
      element.style.cursor = "pointer";

      element.addEventListener("click", () => {
        if (isEditorPage) {
          setSelectedDataItem(dataItem);
          return;
        }

        const currentlySelected = markers.get(id)?.isSelected;
        setSelectedDataItem(currentlySelected ? null : dataItem);
      });

      const marker = new mapboxgl.Marker({ element, anchor: "center" })
        .setLngLat(coordinates)
        .addTo(mapboxMap);

      markers.set(id, { marker, element, isSelected });
    }

    markers.forEach(({ marker }, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    });
  }, [mapboxMap, data, selectedDataItem?._id, USER_ICON_THEMES, isEditorPage, setSelectedDataItem]);

  // Cleanup on unmount.
  useEffect(() => {
    const markers = markersRef.current;

    return () => {
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
    };
  }, []);

  return (
    <MapboxSelectedItemPopup
      mapboxMap={mapboxMap}
      selectedDataItem={selectedDataItem}
      enabled={!isEditorPage}
      getGeometry={(dataItem) => dataItem?.geometry}
      getHeaderText={(dataItem) =>
        `User Name: ${dataItem.userName || "Unknown User"}`
      }
      dataUtils={dataUtils}
      schema={schema}
    />
  );
}
