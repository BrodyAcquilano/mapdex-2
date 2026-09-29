// src/map/mapbox/controllers/useDrawController.js

import { useEffect } from "react";

import {
  createDraftGeometry,
  canFinishDraftGeometry,
  wouldPolygonCandidateIntersect,
  wouldMultiPolygonCandidateIntersect,
  canCommitCurrentDraftPart,
  commitCurrentDraftPart,
} from "../../utils/draftGeometry.js";

// Same tolerance Leaflet's DrawController uses; screen-based rather
// than geographic, so zooming in gives finer control over closing a
// polygon near its own starting vertex.
const POLYGON_CLOSE_TOLERANCE_PX = 12;

function coordinatesEqual(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a[0] === b[0] &&
    a[1] === b[1]
  );
}

/*
 * Mapbox counterpart to src/map/leaflet/controllers/DrawController.jsx:
 * listens for map clicks while a draw tool is active and builds up the
 * draft geometry one vertex at a time. The geometry math itself
 * (createDraftGeometry, canFinishDraftGeometry,
 * wouldPolygonCandidateIntersect) is shared, map-library-agnostic code
 * already used by Leaflet - only the click event and pixel-distance
 * APIs differ (Mapbox's click event already gives {lng, lat} and a
 * screen {x, y} point directly, no coordinate flipping needed).
 */
export function useDrawController({
  mapboxMap,
  geometryTool,
  isDrawing,
  draftGeometry,
  setDraftGeometry,
  setGeometryEditHistory,
  setRejectedSegment,
  drawDraft,
  system,
}) {
  useEffect(() => {
    if (!mapboxMap) return;

    const handleClick = (e) => {
      if (!isDrawing) return;

      const coordinate = [
        Number(e.lngLat.lng.toFixed(6)),
        Number(e.lngLat.lat.toFixed(6)),
      ];

      /*
       * The "add sub-geometry" edit tool re-enters this same click-to-
       * add-a-vertex workflow the multipoint/multiline/multipolygon
       * draw tools use below, dispatching on draftGeometry's own type
       * (already converted to the right Multi- one by
       * createAddSubgeometryDraft when the item was selected - see
       * GeometryLayer.jsx) rather than a fixed geometryTool string.
       * Unlike those draw tools, every mutation here pushes a
       * geometryEditHistory snapshot first, so Back can undo what was
       * added - but never past the original, already-converted draft
       * (see createAddSubgeometryDraft's own comment on why nothing is
       * pushed for that initial conversion itself).
       */
      const isAddSubgeometry = geometryTool === "addSubgeometry";

      if (geometryTool === "point") {
        const baseGeometry =
          draftGeometry?.type === "Point"
            ? draftGeometry
            : createDraftGeometry("point");

        const nextGeometry = {
          ...baseGeometry,
          coordinates: coordinate,
        };

        drawDraft(nextGeometry, system);

        return;
      }

      if (geometryTool === "line") {
        const baseGeometry =
          draftGeometry?.type === "LineString"
            ? draftGeometry
            : createDraftGeometry("line");

        const coordinates = Array.isArray(baseGeometry.coordinates)
          ? baseGeometry.coordinates
          : [];

        const lastCoordinate = coordinates[coordinates.length - 1];

        if (lastCoordinate && coordinatesEqual(lastCoordinate, coordinate)) {
          return;
        }

        setDraftGeometry({
          ...baseGeometry,
          coordinates: [...coordinates, coordinate],
        });

        return;
      }

      if (geometryTool === "polygon") {
        const baseGeometry =
          draftGeometry?.type === "Polygon"
            ? draftGeometry
            : createDraftGeometry("polygon");

        const ring = Array.isArray(baseGeometry.coordinates?.[0])
          ? baseGeometry.coordinates[0]
          : [];

        const firstCoordinate = ring[0];
        const lastCoordinate = ring[ring.length - 1];

        /*
         * Once the polygon can be finished, clicking near the
         * starting vertex closes it using the exact original
         * starting coordinate.
         */
        if (firstCoordinate && canFinishDraftGeometry(baseGeometry)) {
          const firstPoint = mapboxMap.project([
            firstCoordinate[0],
            firstCoordinate[1],
          ]);

          const clickedPoint = e.point;

          const dx = firstPoint.x - clickedPoint.x;
          const dy = firstPoint.y - clickedPoint.y;

          if (Math.sqrt(dx * dx + dy * dy) <= POLYGON_CLOSE_TOLERANCE_PX) {
            setRejectedSegment(null);
            drawDraft(baseGeometry, system);
            return;
          }
        }

        if (lastCoordinate && coordinatesEqual(lastCoordinate, coordinate)) {
          return;
        }

        if (wouldPolygonCandidateIntersect(baseGeometry, coordinate)) {
          if (lastCoordinate) {
            setRejectedSegment({
              start: lastCoordinate,
              end: coordinate,
            });
          }

          return;
        }

        setRejectedSegment(null);

        setDraftGeometry({
          ...baseGeometry,
          coordinates: [[...ring, coordinate]],
        });

        return;
      }

      /*
       * Every point in this MultiPoint draft is independent - no
       * "current part," no closing gesture, just one flat array every
       * click appends to (see createDraftGeometry's own comment on
       * why MultiPoint has no parts concept).
       */
      if (
        geometryTool === "multipoint" ||
        (isAddSubgeometry && draftGeometry?.type === "MultiPoint")
      ) {
        const baseGeometry =
          draftGeometry?.type === "MultiPoint"
            ? draftGeometry
            : createDraftGeometry("multipoint");

        const coordinates = Array.isArray(baseGeometry.coordinates)
          ? baseGeometry.coordinates
          : [];

        const lastCoordinate = coordinates[coordinates.length - 1];

        if (lastCoordinate && coordinatesEqual(lastCoordinate, coordinate)) {
          return;
        }

        if (isAddSubgeometry) {
          setGeometryEditHistory?.((current) => [
            ...(current || []),
            structuredClone(baseGeometry),
          ]);
        }

        setDraftGeometry({
          ...baseGeometry,
          coordinates: [...coordinates, coordinate],
        });

        return;
      }

      /*
       * Same append-only behavior the "line" tool's own click handler
       * has above, just targeting the draft's own current (last) part
       * instead of a single flat array - see createDraftGeometry's own
       * comment on that shape. Committing the current part and moving
       * on to the next is EndPartDrawingButton.jsx's own job, not
       * something this click handler does.
       */
      if (
        geometryTool === "multiline" ||
        (isAddSubgeometry && draftGeometry?.type === "MultiLineString")
      ) {
        const baseGeometry =
          draftGeometry?.type === "MultiLineString"
            ? draftGeometry
            : createDraftGeometry("multiline");

        const parts = Array.isArray(baseGeometry.coordinates)
          ? baseGeometry.coordinates
          : [[]];

        const currentIndex = parts.length - 1;

        const currentPart = Array.isArray(parts[currentIndex])
          ? parts[currentIndex]
          : [];

        const lastCoordinate = currentPart[currentPart.length - 1];

        if (lastCoordinate && coordinatesEqual(lastCoordinate, coordinate)) {
          return;
        }

        if (isAddSubgeometry) {
          setGeometryEditHistory?.((current) => [
            ...(current || []),
            structuredClone(baseGeometry),
          ]);
        }

        setDraftGeometry({
          ...baseGeometry,
          coordinates: parts.map((part, index) =>
            index === currentIndex ? [...currentPart, coordinate] : part,
          ),
        });

        return;
      }

      if (
        geometryTool === "multipolygon" ||
        (isAddSubgeometry && draftGeometry?.type === "MultiPolygon")
      ) {
        const baseGeometry =
          draftGeometry?.type === "MultiPolygon"
            ? draftGeometry
            : createDraftGeometry("multipolygon");

        const parts = Array.isArray(baseGeometry.coordinates)
          ? baseGeometry.coordinates
          : [[[]]];

        const currentIndex = parts.length - 1;

        const currentPartWrapped = parts[currentIndex];

        const ring = Array.isArray(currentPartWrapped?.[0])
          ? currentPartWrapped[0]
          : [];

        const firstCoordinate = ring[0];
        const lastCoordinate = ring[ring.length - 1];

        /*
         * Same "click near the current ring's own start point"
         * closing gesture the "polygon" tool's own handler uses above
         * - the difference is this only commits the CURRENT part
         * (EndPartDrawingButton.jsx's own commitCurrentDraftPart,
         * starting a fresh empty part to keep drawing into) rather
         * than finishing the whole draft outright, since there may
         * still be more polygons to add before Finish.
         */
        if (firstCoordinate && canCommitCurrentDraftPart(baseGeometry)) {
          const firstPoint = mapboxMap.project([
            firstCoordinate[0],
            firstCoordinate[1],
          ]);

          const clickedPoint = e.point;

          const dx = firstPoint.x - clickedPoint.x;
          const dy = firstPoint.y - clickedPoint.y;

          if (Math.sqrt(dx * dx + dy * dy) <= POLYGON_CLOSE_TOLERANCE_PX) {
            setRejectedSegment(null);

            if (isAddSubgeometry) {
              setGeometryEditHistory?.((current) => [
                ...(current || []),
                structuredClone(baseGeometry),
              ]);
            }

            setDraftGeometry(commitCurrentDraftPart(baseGeometry));
            return;
          }
        }

        if (lastCoordinate && coordinatesEqual(lastCoordinate, coordinate)) {
          return;
        }

        if (wouldMultiPolygonCandidateIntersect(baseGeometry, coordinate)) {
          if (lastCoordinate) {
            setRejectedSegment({
              start: lastCoordinate,
              end: coordinate,
            });
          }

          return;
        }

        setRejectedSegment(null);

        if (isAddSubgeometry) {
          setGeometryEditHistory?.((current) => [
            ...(current || []),
            structuredClone(baseGeometry),
          ]);
        }

        setDraftGeometry({
          ...baseGeometry,
          coordinates: parts.map((part, index) =>
            index === currentIndex ? [[...ring, coordinate]] : part,
          ),
        });
      }
    };

    mapboxMap.on("click", handleClick);

    return () => {
      mapboxMap.off("click", handleClick);
    };
  }, [
    mapboxMap,
    geometryTool,
    isDrawing,
    draftGeometry,
    setDraftGeometry,
    setGeometryEditHistory,
    setRejectedSegment,
    drawDraft,
    system,
  ]);
}
