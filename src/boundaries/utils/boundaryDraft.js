// src/boundaries/utils/boundaryDraft.js

/*
 * The empty draft a Draw Boundary session starts from.
 *
 * Deliberately not createDraftGeometry("multipolygon") from
 * src/map/utils/draftGeometry.js, even though the two are otherwise the
 * same shape: that one also stamps borderColor/fillColor onto the
 * geometry object, and a boundary's geometry must never carry color
 * keys - aggregateValidation.js's own isValidBoundaryGeometry rejects
 * any key outside type/coordinates/bbox/centroid, so a colored draft
 * fails validation at save time. A boundary's draft colors live
 * separately in draftBoundaryColors instead (see PlacesRuntime.jsx's
 * own comment on why).
 *
 * `coordinates: [[[]]]` is one polygon holding one empty ring - the
 * "current" part the next click appends into, following
 * createDraftGeometry's own empty-part convention. An earlier version
 * of the Layers page seeded `coordinates: []` instead, which left no
 * current part at all: every click was dropped, and canUndoDraftVertex/
 * canCommitCurrentDraftPart/canFinishDraftGeometry all returned false,
 * so BoundaryGeometryActions rendered nothing and the tool looked
 * completely dead. This exists so both pages can never drift on that
 * detail again.
 */
export function createEmptyBoundaryDraft() {
  return {
    type: "MultiPolygon",
    coordinates: [[[]]],
    bbox: null,
    centroid: null,
  };
}

function isValidCoordinate(coordinate) {
  return (
    Array.isArray(coordinate) &&
    coordinate.length === 2 &&
    Number.isFinite(Number(coordinate[0])) &&
    Number.isFinite(Number(coordinate[1]))
  );
}

function isSaveableRing(ring) {
  if (!Array.isArray(ring) || !ring.every(isValidCoordinate)) return false;

  /*
   * A stored ring is closed (last point repeats the first), an
   * in-progress one isn't - either way three *distinct* corners is the
   * minimum that describes an area.
   */
  const isClosed =
    ring.length >= 2 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];

  return (isClosed ? ring.length - 1 : ring.length) >= 3;
}

/*
 * Whether a boundary draft is complete enough to SAVE, as opposed to
 * complete enough to finish DRAWING.
 *
 * Deliberately not draftGeometry.js's own canFinishDraftGeometry, which
 * the Move Vertex/Move Boundary tools used to be gated on. That
 * function additionally runs polygonRingSelfIntersects, a guard that
 * exists to stop someone hand-drawing a bow-tie - a reasonable rule for
 * a shape being clicked out vertex by vertex, and the wrong rule for a
 * shape that already exists. Real imported boundaries are detailed
 * municipal outlines (hundreds to thousands of vertices) and most of
 * them trip that check, so Finish simply never appeared while moving
 * one: six of the eight boundaries in this project's own database fail
 * it. Nothing had gone wrong with them - the import path validates
 * through shared/validation/aggregateValidation.js's own
 * isValidBoundaryGeometry, which has no self-intersection test at all,
 * so those shapes were always legitimately storable.
 *
 * Skipping it is also what keeps dragging responsive:
 * polygonRingSelfIntersects is O(n^2) in ring length, and it was being
 * recomputed on every render of the action row - roughly 5.5 million
 * segment comparisons per frame for the 2352-vertex Kitchener boundary.
 */
export function canSaveBoundaryDraft(geometry) {
  if (geometry?.type === "Polygon") {
    const rings = geometry.coordinates;
    return Array.isArray(rings) && rings.length > 0 && isSaveableRing(rings[0]);
  }

  if (geometry?.type === "MultiPolygon") {
    const parts = geometry.coordinates;

    return (
      Array.isArray(parts) &&
      parts.length > 0 &&
      parts.every((part) => Array.isArray(part) && part.length > 0 && isSaveableRing(part[0]))
    );
  }

  return false;
}
