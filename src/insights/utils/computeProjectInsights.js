// src/insights/utils/computeProjectInsights.js

/*
 * The whole Insights page's numbers, derived in one place.
 *
 * Everything here is a count of what a project currently holds. It is
 * deliberately cheap and completely read-only - no filtering, no
 * spatial math, no server call - because the Insights page is a
 * dashboard over state the app already has loaded, and because this is
 * meant to be the shell that later analysis modes hang off rather than
 * the analysis itself.
 *
 * Counts run against the FULL data set (`runtime.data`), never the
 * filtered view. A dashboard that silently re-counted whatever the
 * filter panel happened to be set to would report a different project
 * size depending on where you had been, which is not what "how big is
 * this project" means - Brody's own call.
 *
 * Engine-agnostic, like everything else behind the shared spatial tool
 * pages: it reads the schema's own declared geometry types and the four
 * collections every project has, and never asks which engine is loaded.
 */

/*
 * A project's schema declares the geometry types it allows (Point,
 * LineString, Polygon and their Multi- counterparts - see
 * shared/validation/geometryTypeRules.js), and those declared types are
 * the rows the dashboard is really about.
 *
 * Data can still legitimately hold a type the schema does not currently
 * list: the multi-draw tools produce Multi- geometries, and a schema can
 * be narrowed after items already exist. Those are counted too, flagged
 * `declared: false`, so the bars always add up to the real total instead
 * of quietly losing items that do not fit the current allow-list.
 */
function buildGeometryCounts(declaredTypes, dataItems) {
  const counts = new Map();

  for (const type of declaredTypes) {
    counts.set(type, 0);
  }

  let withoutGeometry = 0;

  for (const dataItem of dataItems) {
    const type = dataItem?.geometry?.type;

    if (typeof type !== "string" || !type) {
      withoutGeometry += 1;
      continue;
    }

    counts.set(type, (counts.get(type) || 0) + 1);
  }

  const rows = [...counts.entries()].map(([type, count]) => ({
    type,
    count,
    declared: declaredTypes.includes(type),
  }));

  /*
   * Declared types keep the schema's own order so the chart matches how
   * the project describes itself; anything undeclared is appended after,
   * largest first, since it has no schema order to inherit.
   */
  const declared = rows.filter((row) => row.declared);
  const undeclared = rows
    .filter((row) => !row.declared)
    .sort((a, b) => b.count - a.count);

  return { geometryCounts: [...declared, ...undeclared], withoutGeometry };
}

function toCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

export function computeProjectInsights({
  schema,
  dataItems,
  layers,
  boundaries,
  aggregates,
} = {}) {
  const safeDataItems = Array.isArray(dataItems) ? dataItems : [];

  const declaredTypes = Array.isArray(schema?.geometry?.types)
    ? schema.geometry.types
    : [];

  const { geometryCounts, withoutGeometry } = buildGeometryCounts(
    declaredTypes,
    safeDataItems,
  );

  /*
   * The bar chart scales against the largest single bar rather than
   * against the data-item total, so a project whose items are spread
   * thinly across several types still produces readable bars instead of
   * a row of slivers. 0 when there is nothing to draw, which the page
   * checks before dividing.
   */
  const maxGeometryCount = geometryCounts.reduce(
    (largest, row) => Math.max(largest, row.count),
    0,
  );

  return {
    projectName: schema?.projectName || "",
    projectDescription: schema?.projectDescription || "",

    dataItemCount: safeDataItems.length,
    boundaryCount: toCount(boundaries),
    layerCount: toCount(layers),
    aggregateCount: toCount(aggregates),

    geometryCounts,
    maxGeometryCount,
    withoutGeometry,

    /*
     * Lets the page tell "this project has no items yet" apart from
     * "the schema declares no geometry types", which want different
     * empty states.
     */
    hasDeclaredGeometryTypes: declaredTypes.length > 0,
  };
}
