// shared/validation/geometryBoundaryValidation.js

/*
 * Import-only defense against a shape neither map engine can draw,
 * edit, or render sensibly: a LineString/Polygon edge (or, for a
 * Multi- type, any one of its own parts' edges) that crosses the
 * antimeridian - a jump from a longitude near +180 to one near -180
 * (or vice versa) representing an actual short hop across the
 * dateline, not a genuinely wide shape. Leaflet has no wraparound
 * rendering for this, and Mapbox's own globe projection drops to flat
 * Mercator well before any usable zoom level, so a geometry like this
 * has no way to be drawn, corrected, or even properly viewed through
 * the app once it exists - unlike every other kind of "messy" import
 * data (self-intersection, overlapping parts), which is deliberately
 * let through since the user can still see and fix it with the normal
 * tools. The regular draw tools already prevent building one of these
 * in the first place (src/map/utils/draftGeometry.js's own
 * unwrapRingLongitudes-based self-intersection check happens to catch
 * most antimeridian-crossing attempts as a side effect, but that's a
 * front-end-only draw-tool concern, never applied to add/update), so
 * only the import route(s) - the one path that can hand the app a
 * geometry it never had to draw through those tools - need this
 * extra, explicit check. Used both client-side (src/forms/
 * importGeometryHelpers.js, to decide what's importable before ever
 * building a payload) and server-side (as a defensive re-check in the
 * places/events add-batch routes, the same "the client already
 * filtered this, but never trust it alone" posture every other piece
 * of shared validation already takes).
 */

/*
 * Whether any consecutive pair along `path` (a flat array of
 * [lng, lat] pairs forming one connected line or ring) jumps by more
 * than 180 degrees of longitude. A real antimeridian crossing (e.g.
 * 179 -> -179) is an actual ~2 degree step misrepresented as a ~358
 * degree one by the raw coordinates; anything under 180 degrees is
 * just a wide but legitimate shape.
 */
export function pathCrossesAntimeridian(path) {
  if (!Array.isArray(path) || path.length < 2) return false;

  for (let i = 0; i < path.length - 1; i += 1) {
    const currentLng = Number(path[i]?.[0]);
    const nextLng = Number(path[i + 1]?.[0]);

    if (!Number.isFinite(currentLng) || !Number.isFinite(nextLng)) continue;

    if (Math.abs(nextLng - currentLng) > 180) {
      return true;
    }
  }

  return false;
}

/*
 * Per-type dispatch over an already-finalized single geometry (a
 * whole Point/LineString/Polygon/MultiPoint/MultiLineString/
 * MultiPolygon, not raw GeoJSON that still needs splitting) - true if
 * ANY connected path within it crosses the antimeridian: a
 * LineString's own coordinates, a Polygon's own (single, hole-less)
 * ring, or any one part of a MultiLineString/MultiPolygon. Point/
 * MultiPoint can never cross anything - each of their own points is
 * independent, with no connecting edge to jump across the dateline.
 * This only answers "does a crossing exist somewhere" - it doesn't
 * say which part, so it's meant for a final whole-geometry gate (the
 * server's own defensive re-check on an already-split, already-built
 * item) rather than the per-part keep/discard decisions
 * importGeometryHelpers.js makes while still splitting raw GeoJSON,
 * which call pathCrossesAntimeridian directly per candidate part
 * instead.
 */
export function geometryCrossesAntimeridian(geometry) {
  if (!geometry || typeof geometry !== "object") return false;

  if (geometry.type === "LineString") {
    return pathCrossesAntimeridian(geometry.coordinates);
  }

  if (geometry.type === "Polygon") {
    return pathCrossesAntimeridian(geometry.coordinates?.[0]);
  }

  if (geometry.type === "MultiLineString") {
    return (geometry.coordinates || []).some((line) =>
      pathCrossesAntimeridian(line),
    );
  }

  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates || []).some((part) =>
      pathCrossesAntimeridian(part?.[0]),
    );
  }

  return false;
}
