// src/map/utils/isEditingGeometryPosition.js

function coordinatesDiffer(a, b) {
  if (a === b) return false;
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
}

/*
 * Whether a geometry's position is actively being worked on right
 * now, as opposed to merely selected - used to suspend the
 * track-location camera lock (src/map/leaflet/controllers/UserLocationTracker.jsx,
 * src/map/mapbox/controllers/UserLocationTracker.jsx) so it doesn't
 * fight a user who's flying to or dragging a point/line/polygon that
 * isn't near their own live location.
 *
 * draftGeometry is populated immediately on selecting any editable
 * item (see EditPanel.jsx), not only once an edit actually starts -
 * it also drives live color-preview and lets move/midpoint/remove
 * show vertices instantly when a tool is already active. So "draft
 * exists" alone would suspend tracking on every selection, which is
 * too broad. Instead:
 * - isDrawing covers the entire span of any add or edit tool session
 *   (point/line/polygon add, move/midpoint/remove edit) - true from
 *   the moment the tool is engaged, not just once a drag/click
 *   actually moves something.
 * - Outside any tool, comparing draftGeometry's coordinates against
 *   the selected item's saved coordinates catches the edit panel's
 *   Point lat/lng flyover, the only other way a position edit can
 *   happen without a tool being active.
 */
export function isEditingGeometryPosition({
  draftGeometry,
  selectedDataItem,
  isDrawing,
}) {
  if (isDrawing) return true;

  const savedGeometry = selectedDataItem?.geometry;

  if (!draftGeometry || !savedGeometry) return false;
  if (draftGeometry.type !== savedGeometry.type) return false;

  return coordinatesDiffer(draftGeometry.coordinates, savedGeometry.coordinates);
}
