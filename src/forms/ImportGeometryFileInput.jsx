import { forwardRef } from "react";

import {
  splitGeoJsonIntoGeometries,
  buildImportGeometryPayload,
} from "./importGeometryHelpers.js";

function fitImportedBounds(map, docs) {
  if (!map || !Array.isArray(docs) || docs.length === 0) return;

  if (typeof map.fitToData === "function") {
    map.fitToData(docs);
    return;
  }

  if (typeof map.fitBounds === "function") {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    docs.forEach((doc) => {
      const bbox = doc?.geometry?.bbox;
      if (!Array.isArray(bbox) || bbox.length !== 4) return;

      minLng = Math.min(minLng, bbox[0]);
      minLat = Math.min(minLat, bbox[1]);
      maxLng = Math.max(maxLng, bbox[2]);
      maxLat = Math.max(maxLat, bbox[3]);
    });

    if (
      Number.isFinite(minLng) &&
      Number.isFinite(minLat) &&
      Number.isFinite(maxLng) &&
      Number.isFinite(maxLat)
    ) {
      map.fitBounds([
        [minLat, minLng],
        [maxLat, maxLng],
      ]);
    }
  }
}

/*
 * "Import Geometry" - the tool wheel's own IMPORT_TOOLS entry
 * (src/map/tools/GeometryToolWheel.jsx), shared between the places and
 * events engines (both render this from their own Editor.jsx). A
 * one-shot action rather than a mode or a confirmation dialog, per
 * Brody's own call: selecting the tool (Editor.jsx's own
 * handleGeometryToolChange) calls .click() on this component's own
 * hidden file input directly, which opens the OS file picker
 * immediately with no modal in between. Once a file is chosen, this
 * reads it, splits it (importGeometryHelpers.js - keeping only
 * geometry, discarding every one of the file's own properties, and
 * quick-adding each surviving geometry the same way manually drawing
 * one does), and submits the batch - all without ever setting
 * geometryTool to "importGeometry" in the first place (see Editor.jsx
 * own comment), so there's nothing to visually deselect once it's
 * done: pass or fail, the tool was never "active" as a mode, just
 * triggered once and reported on via a plain notification.
 */
const ImportGeometryFileInput = forwardRef(function ImportGeometryFileInput(
  {
    setData,
    schema,
    blankFormTemplate,
    forms,
    dataUtils,
    system,
    apis,
    map,
    activeLayer,
    activeParentDataItemId,
  },
  ref,
) {
  async function handleFileChange(e) {
    const file = e.target.files?.[0] || null;

    /*
     * Reset immediately so picking the SAME file again still fires
     * this handler - a plain file input only fires "change" when its
     * own value actually changes, which browsers treat as unchanged
     * if the same path is re-selected without this.
     */
    e.target.value = "";

    if (!file) return;

    if (!schema || !blankFormTemplate) {
      system.notify("Schema not loaded.");
      return;
    }

    system.startLoading?.("Importing geometry...");

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = splitGeoJsonIntoGeometries(parsed);

      if (!result.valid) {
        system.notify(result.message);
        return;
      }

      const payloads = result.geometries
        .map((geometry) =>
          buildImportGeometryPayload({
            blankFormTemplate,
            forms,
            schema,
            geometry,
            dataUtils,
            activeLayer,
            activeParentDataItemId,
          }),
        )
        .filter(Boolean);

      if (!payloads.length) {
        system.notify("No valid geometry was ready to import.");
        return;
      }

      const { data: apiResponse, message } = await apis.engineApi.addBatch(
        schema._id,
        payloads,
      );

      if (!apiResponse || !Array.isArray(apiResponse.inserted)) {
        const lowerMessage = String(message || "").toLowerCase();

        if (
          lowerMessage.includes("too large") ||
          lowerMessage.includes("payload") ||
          lowerMessage.includes("entity")
        ) {
          system.notify(
            "Import failed: file payload was too large for the server.",
          );
        } else {
          system.notify(message || "Batch import failed.");
        }

        return;
      }

      /*
       * Unlike neighbourhoods' own add-batch (all-or-nothing - every
       * sent item always succeeds together, so insertedIds[i] always
       * matches payloads[i] directly), this route can skip individual
       * items server-side (the same defensive "client already
       * filtered this" posture as every other shared validation - see
       * server/routes/places.js's own /add-batch comment), so each
       * returned entry carries its own original index to map back to
       * the payload it belongs to, rather than assuming a 1:1
       * position match.
       */
      const normalizedDocs = apiResponse.inserted
        .map(({ index, _id, createdAt, updatedAt }) => {
          const payload = payloads[index];
          if (!payload || !_id) return null;

          return dataUtils.normalizeDataItem(schema, {
            _id,
            ...payload,
            type: schema.engineKey === "events" ? "event" : "place",
            userRole: "editor",
            createdAt,
            updatedAt,
          });
        })
        .filter(Boolean);

      normalizedDocs.forEach((doc) => {
        dataUtils.insertDataItemInList(setData, doc);
      });

      if (message) {
        system.notify(message);
      }

      if (normalizedDocs.length > 0) {
        fitImportedBounds(map, normalizedDocs);
        return;
      }

      system.notify("No geometry was imported.");
    } catch (err) {
      console.error("Geometry batch import failed:", err);
      system.notify("Failed to import GeoJSON.");
    } finally {
      system.stopLoading?.();
    }
  }

  return (
    <input
      ref={ref}
      type="file"
      accept=".geojson,.json,application/geo+json,application/json"
      onChange={handleFileChange}
      aria-hidden="true"
      tabIndex={-1}
      style={{ display: "none" }}
    />
  );
});

export default ImportGeometryFileInput;
