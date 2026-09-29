// src/map/mapbox/layers/GeometryFilterLayer.jsx

import { useEffect, useMemo, useRef } from "react";

import { GEOMETRY_LIMITS } from "../../../../shared/validation/validationConstants.js";
import { useMapboxMapInstance } from "../context/MapboxMapContext.jsx";

const OVERLAY_SOURCE_ID = "mapdex-geometry-filter-overlay";
const OVERLAY_LAYER_ID = "mapdex-geometry-filter-overlay-layer";

const BOUNDARY_SOURCE_ID = "mapdex-geometry-filter-boundary";
const BOUNDARY_LAYER_ID = "mapdex-geometry-filter-boundary-layer";

const OVERLAY_FILL_COLOR = "#070707";
const BOUNDARY_LINE_COLOR = "#90929a";

function emptyCollection() {
  return { type: "FeatureCollection", features: [] };
}

function rectanglePolygon(lngMin, latMin, lngMax, latMax) {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [lngMin, latMin],
          [lngMax, latMin],
          [lngMax, latMax],
          [lngMin, latMax],
          [lngMin, latMin],
        ],
      ],
    },
  };
}

function rectangleOutline(lngMin, latMin, lngMax, latMax) {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [lngMin, latMin],
        [lngMax, latMin],
        [lngMax, latMax],
        [lngMin, latMax],
        [lngMin, latMin],
      ],
    },
  };
}

function verticalLine(lng, latMin, latMax) {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [lng, latMin],
        [lng, latMax],
      ],
    },
  };
}

function horizontalLine(lat, lngMin, lngMax) {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [lngMin, lat],
        [lngMax, lat],
      ],
    },
  };
}

function parseBound(value, min, max) {
  if (value == null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  return Math.max(min, Math.min(max, parsed));
}

/*
 * Builds the two GeoJSON FeatureCollections behind this layer: a
 * filled "overlay" shading the excluded (out of bounds) area, and a
 * "boundary" outline at the filter's edges. Pure geometry, no
 * map-library dependency - mirrors the old Leaflet GeometryFilterLayer
 * exactly, just emitting GeoJSON [lng, lat] features/coordinates
 * instead of react-leaflet <Polygon>/<Rectangle>/<Polyline> elements.
 *
 * The "complete bounding box" case (all four bounds set) uses a
 * single Polygon with a hole rather than four separate overlay
 * rectangles, matching the Leaflet version's own special case for
 * it. Mapbox GL follows the GeoJSON right-hand rule for
 * polygons-with-holes: the outer ring must wind counter-clockwise and
 * the hole clockwise, or the fill renders inverted.
 */
function buildBoxFeatureCollections(filterValue) {
  const worldLngMin = GEOMETRY_LIMITS.longitudeMin;
  const worldLngMax = GEOMETRY_LIMITS.longitudeMax;
  const worldLatMin = GEOMETRY_LIMITS.latitudeMin;
  const worldLatMax = GEOMETRY_LIMITS.latitudeMax;

  const longitudeMin = parseBound(
    filterValue?.longitude?.min,
    worldLngMin,
    worldLngMax,
  );
  const longitudeMax = parseBound(
    filterValue?.longitude?.max,
    worldLngMin,
    worldLngMax,
  );
  const latitudeMin = parseBound(
    filterValue?.latitude?.min,
    worldLatMin,
    worldLatMax,
  );
  const latitudeMax = parseBound(
    filterValue?.latitude?.max,
    worldLatMin,
    worldLatMax,
  );

  const hasLongitudeMin = longitudeMin != null;
  const hasLongitudeMax = longitudeMax != null;
  const hasLatitudeMin = latitudeMin != null;
  const hasLatitudeMax = latitudeMax != null;

  const overlay = emptyCollection();
  const boundary = emptyCollection();

  if (!hasLongitudeMin && !hasLongitudeMax && !hasLatitudeMin && !hasLatitudeMax) {
    return { overlay, boundary };
  }

  const hasBoundingBox =
    hasLongitudeMin && hasLongitudeMax && hasLatitudeMin && hasLatitudeMax;

  const effectiveLngMin = longitudeMin ?? worldLngMin;
  const effectiveLngMax = longitudeMax ?? worldLngMax;
  const effectiveLatMin = latitudeMin ?? worldLatMin;
  const effectiveLatMax = latitudeMax ?? worldLatMax;

  if (hasBoundingBox) {
    overlay.features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          // Outer ring (whole world), counter-clockwise.
          [
            [worldLngMin, worldLatMin],
            [worldLngMax, worldLatMin],
            [worldLngMax, worldLatMax],
            [worldLngMin, worldLatMax],
            [worldLngMin, worldLatMin],
          ],
          // Hole (the filter box), clockwise - opposite winding.
          [
            [longitudeMin, latitudeMin],
            [longitudeMin, latitudeMax],
            [longitudeMax, latitudeMax],
            [longitudeMax, latitudeMin],
            [longitudeMin, latitudeMin],
          ],
        ],
      },
    });

    boundary.features.push(
      rectangleOutline(longitudeMin, latitudeMin, longitudeMax, latitudeMax),
    );

    return { overlay, boundary };
  }

  if (hasLatitudeMin && latitudeMin > worldLatMin) {
    overlay.features.push(
      rectanglePolygon(worldLngMin, worldLatMin, worldLngMax, latitudeMin),
    );
  }

  if (hasLatitudeMax && latitudeMax < worldLatMax) {
    overlay.features.push(
      rectanglePolygon(worldLngMin, latitudeMax, worldLngMax, worldLatMax),
    );
  }

  if (hasLongitudeMin && longitudeMin > worldLngMin) {
    overlay.features.push(
      rectanglePolygon(worldLngMin, effectiveLatMin, longitudeMin, effectiveLatMax),
    );
  }

  if (hasLongitudeMax && longitudeMax < worldLngMax) {
    overlay.features.push(
      rectanglePolygon(longitudeMax, effectiveLatMin, worldLngMax, effectiveLatMax),
    );
  }

  if (hasLongitudeMin) {
    boundary.features.push(
      verticalLine(longitudeMin, effectiveLatMin, effectiveLatMax),
    );
  }

  if (hasLongitudeMax) {
    boundary.features.push(
      verticalLine(longitudeMax, effectiveLatMin, effectiveLatMax),
    );
  }

  if (hasLatitudeMin) {
    boundary.features.push(
      horizontalLine(latitudeMin, effectiveLngMin, effectiveLngMax),
    );
  }

  if (hasLatitudeMax) {
    boundary.features.push(
      horizontalLine(latitudeMax, effectiveLngMin, effectiveLngMax),
    );
  }

  return { overlay, boundary };
}

/*
 * A boundary's own rings. Boundary validation guarantees one ring per
 * polygon entry (a boundary never has holes - see clipToBoundary.js's
 * own comment), so this is simply "the outer ring of each part".
 */
function getBoundaryRings(boundaryGeometry) {
  const coordinates = boundaryGeometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];

  if (boundaryGeometry.type === "Polygon") {
    const ring = coordinates[0];
    return Array.isArray(ring) && ring.length >= 3 ? [ring] : [];
  }

  if (boundaryGeometry.type === "MultiPolygon") {
    return coordinates
      .map((polygonEntry) => polygonEntry?.[0])
      .filter((ring) => Array.isArray(ring) && ring.length >= 3);
  }

  return [];
}

function ringSignedArea(ring) {
  let total = 0;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.[0]);
    const yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]);
    const yj = Number(ring[j]?.[1]);

    if (!Number.isFinite(xi) || !Number.isFinite(yi)) continue;
    if (!Number.isFinite(xj) || !Number.isFinite(yj)) continue;

    total += (xj - xi) * (yj + yi);
  }

  return total;
}

/*
 * Mapbox follows the GeoJSON right-hand rule: a polygon's outer ring
 * must wind counter-clockwise and its holes clockwise, or the fill
 * renders inverted. A stored boundary's winding is whatever its source
 * happened to use - hand-drawn one way, imported another - so each ring
 * is re-oriented here rather than trusted.
 */
function orientRing(ring, wantClockwise) {
  const closed =
    ring.length >= 2 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring
      : [...ring, ring[0]];

  /* Positive signed area here means clockwise, per the formula above. */
  const isClockwise = ringSignedArea(closed) > 0;

  return isClockwise === wantClockwise ? closed : [...closed].reverse();
}

function ringOutline(ring) {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: orientRing(ring, true) },
  };
}

/*
 * Everything outside the boundary, as one world-sized polygon with the
 * boundary's rings punched out as holes - the same trick the complete
 * bounding box case above uses, just with a real shape instead of a
 * rectangle.
 */
function boundaryOverlayFeature(rings) {
  const worldRing = [
    [GEOMETRY_LIMITS.longitudeMin, GEOMETRY_LIMITS.latitudeMin],
    [GEOMETRY_LIMITS.longitudeMax, GEOMETRY_LIMITS.latitudeMin],
    [GEOMETRY_LIMITS.longitudeMax, GEOMETRY_LIMITS.latitudeMax],
    [GEOMETRY_LIMITS.longitudeMin, GEOMETRY_LIMITS.latitudeMax],
    [GEOMETRY_LIMITS.longitudeMin, GEOMETRY_LIMITS.latitudeMin],
  ];

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [worldRing, ...rings.map((ring) => orientRing(ring, true))],
    },
  };
}

/*
 * The box and the boundary are independent, cumulative filters (see
 * src/filters/geometry/Geometry.jsx), so their shading is cumulative
 * too - each contributes its own excluded-area overlay rather than one
 * replacing the other.
 */
function buildFilterFeatureCollections(filterValue, filterBoundaryGeometry) {
  const { overlay, boundary } = buildBoxFeatureCollections(filterValue);

  const rings = getBoundaryRings(filterBoundaryGeometry);

  if (rings.length > 0) {
    overlay.features.push(boundaryOverlayFeature(rings));

    for (const ring of rings) {
      boundary.features.push(ringOutline(ring));
    }
  }

  return { overlay, boundary };
}

function addGeometryFilterLayers(mapboxMap) {
  if (!mapboxMap.getSource(OVERLAY_SOURCE_ID)) {
    mapboxMap.addSource(OVERLAY_SOURCE_ID, {
      type: "geojson",
      data: emptyCollection(),
    });

    mapboxMap.addLayer({
      id: OVERLAY_LAYER_ID,
      type: "fill",
      source: OVERLAY_SOURCE_ID,
      slot: "top",
      paint: {
        "fill-color": OVERLAY_FILL_COLOR,
        "fill-opacity": 0.6,
      },
    });
  }

  if (!mapboxMap.getSource(BOUNDARY_SOURCE_ID)) {
    mapboxMap.addSource(BOUNDARY_SOURCE_ID, {
      type: "geojson",
      data: emptyCollection(),
    });

    mapboxMap.addLayer({
      id: BOUNDARY_LAYER_ID,
      type: "line",
      source: BOUNDARY_SOURCE_ID,
      slot: "top",
      paint: {
        "line-color": BOUNDARY_LINE_COLOR,
        "line-width": 2,
        "line-opacity": 0.9,
      },
    });
  }
}

/*
 * Reverses addGeometryFilterLayers: layers must be removed before the
 * sources they reference, or Mapbox throws. Called when this
 * component unmounts (e.g. the active engine changes) so a persistent
 * map instance doesn't accumulate a previous engine's sources/layers.
 */
function removeGeometryFilterLayers(mapboxMap) {
  if (mapboxMap.getLayer(BOUNDARY_LAYER_ID)) {
    mapboxMap.removeLayer(BOUNDARY_LAYER_ID);
  }
  if (mapboxMap.getSource(BOUNDARY_SOURCE_ID)) {
    mapboxMap.removeSource(BOUNDARY_SOURCE_ID);
  }

  if (mapboxMap.getLayer(OVERLAY_LAYER_ID)) {
    mapboxMap.removeLayer(OVERLAY_LAYER_ID);
  }
  if (mapboxMap.getSource(OVERLAY_SOURCE_ID)) {
    mapboxMap.removeSource(OVERLAY_SOURCE_ID);
  }
}

function setSourceData(mapboxMap, sourceId, data) {
  const source = mapboxMap.getSource(sourceId);
  if (source) source.setData(data);
}

export default function GeometryFilterLayer({ filterValue, filterBoundaryGeometry }) {
  const mapboxMap = useMapboxMapInstance();
  const collectionsRef = useRef({ overlay: emptyCollection(), boundary: emptyCollection() });

  const collections = useMemo(
    () => buildFilterFeatureCollections(filterValue, filterBoundaryGeometry),
    [filterValue, filterBoundaryGeometry],
  );

  collectionsRef.current = collections;

  useEffect(() => {
    if (!mapboxMap) return;

    const applyLayers = () => {
      addGeometryFilterLayers(mapboxMap);
      setSourceData(mapboxMap, OVERLAY_SOURCE_ID, collectionsRef.current.overlay);
      setSourceData(mapboxMap, BOUNDARY_SOURCE_ID, collectionsRef.current.boundary);
    };

    applyLayers();
    mapboxMap.on("style.load", applyLayers);

    return () => {
      mapboxMap.off("style.load", applyLayers);
      removeGeometryFilterLayers(mapboxMap);
    };
  }, [mapboxMap]);

  useEffect(() => {
    if (!mapboxMap) return;

    setSourceData(mapboxMap, OVERLAY_SOURCE_ID, collections.overlay);
    setSourceData(mapboxMap, BOUNDARY_SOURCE_ID, collections.boundary);
  }, [mapboxMap, collections]);

  return null;
}
