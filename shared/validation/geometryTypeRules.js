// shared/validation/geometryTypeRules.js

/*
 * Shared rules for what's allowed given a project's schema.geometry.types
 * allow-list, re-derived independently in several places before this file
 * existed (GeometryToolWheel.jsx, GeometryToolbar.jsx, GeometryConfigurator.jsx,
 * and server-side validateGeometryPayload each had their own inline
 * `allowedTypes.includes(type)` check). Those existing checks are left as
 * they are - this file is specifically for the single/multi pairing rules
 * the add-subgeometry/remove-subgeometry/multi-draw tools need, which none
 * of those simpler checks had to reason about before.
 *
 * Every function here takes the plain allowedTypes ARRAY (schema.geometry.types),
 * not a schema object - that's the shape already threaded through
 * GeometryToolWheel.jsx (as `geometryTypes`) and both GeometryLayer.jsx files
 * (as `schema.geometry.types`), so this matches existing call sites rather
 * than requiring a `{ geometry: { types } }` wrapper.
 */

const SINGLE_TO_MULTI = {
  Point: "MultiPoint",
  LineString: "MultiLineString",
  Polygon: "MultiPolygon",
};

const MULTI_TO_SINGLE = {
  MultiPoint: "Point",
  MultiLineString: "LineString",
  MultiPolygon: "Polygon",
};

export function isGeometryTypeAllowed(allowedTypes, type) {
  return Array.isArray(allowedTypes) && allowedTypes.includes(type);
}

/*
 * The Multi- counterpart of a base geometry type, whether `type` itself is
 * already single or already multi (returns `type` unchanged if it's already
 * multi). Returns null for anything outside the 6 known types.
 */
export function getMultiTypeForBase(type) {
  if (SINGLE_TO_MULTI[type]) return SINGLE_TO_MULTI[type];
  if (MULTI_TO_SINGLE[type]) return type;
  return null;
}

/*
 * The single counterpart of a base geometry type, whether `type` itself is
 * already single (returned unchanged) or already multi.
 */
export function getSingleTypeForBase(type) {
  if (MULTI_TO_SINGLE[type]) return MULTI_TO_SINGLE[type];
  if (SINGLE_TO_MULTI[type]) return type;
  return null;
}

/*
 * Whether at least one of the 3 Multi- types is allowed at all - drives
 * whether the Add Sub-Geometry/Remove Sub-Geometry tools exist as a concept
 * for this project. If a schema only allows single types (Point/LineString/
 * Polygon, no Multi- variant of any of them), there's nothing for either
 * tool to do: nothing to promote a single into, and no Multi- item could
 * ever exist to remove a part from.
 */
export function hasAnyMultiTypeAllowed(allowedTypes) {
  return Object.values(SINGLE_TO_MULTI).some((multiType) =>
    isGeometryTypeAllowed(allowedTypes, multiType),
  );
}

/*
 * Whether Add Sub-Geometry can be used starting from an item of this
 * geometry type - true whenever that type's Multi- counterpart is allowed,
 * regardless of whether the type itself (single or already-multi) is
 * currently in the allow-list, since adding a sub-geometry either promotes
 * a single into multi or grows an existing multi - both outcomes need the
 * multi type allowed, and only that.
 */
export function canAddSubgeometryToItem(allowedTypes, geometryType) {
  return isGeometryTypeAllowed(allowedTypes, getMultiTypeForBase(geometryType));
}

/*
 * Whether Remove Sub-Geometry can be used starting from an item of this
 * geometry type - only true for an already-Multi- item whose own multi
 * type is currently allowed. A plain Point/LineString/Polygon never
 * qualifies (nothing to remove a part from).
 */
export function canSelectForRemoveSubgeometry(allowedTypes, geometryType) {
  if (!MULTI_TO_SINGLE[geometryType]) return false;
  return isGeometryTypeAllowed(allowedTypes, geometryType);
}

/*
 * Whether a Multi- draft/item with exactly 1 member is allowed to finish
 * (draw) or be reduced to (remove-sub-geometry) as its singular type
 * equivalent - only true if that singular type is itself in the allow-list.
 * If it isn't, a 1-member Multi- has nowhere valid to collapse down to, so
 * the caller must instead require >=2 members.
 */
export function isSingleCollapseAllowed(allowedTypes, multiType) {
  return isGeometryTypeAllowed(allowedTypes, getSingleTypeForBase(multiType));
}
