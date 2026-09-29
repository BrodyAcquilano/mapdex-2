import { useEffect, useMemo, useState } from "react";
import "../styles/modals.css";

import { validateDataItemPayload } from "../../shared/validation/dataValidation.js";
import { sanitizePolygonGeometry } from "../../shared/validation/polygonValidation.js";

const DEFAULT_BORDER_COLOR = "#2563eb";
const DEFAULT_FILL_COLOR = "#3b82f6";

const DEFAULT_CAPACITY_PER_ASSET = {
  greenSpace: 4000,
  schools: 1000,
  libraries: 8000,
  healthcare: 2500,
  transitStops: 1200,
  communitySpaces: 1500,
};

/*
 * True if any consecutive pair of vertices in `ring` (including the
 * closing edge, once GeoJSON's own first-equals-last convention is
 * accounted for) jumps by more than 180 degrees of longitude - a real
 * antimeridian crossing (e.g. 179 -> -179, an actual ~2 degree step)
 * rather than a legitimate wide shape. Filtered out at import rather
 * than imported-and-flagged-for-cleanup the way other messy source
 * data is, per Brody's own call: unlike a self-intersecting ring
 * (which Mapdex already accepts on import, matching how lines and a
 * MultiPolygon's own separate rings are already allowed to cross), a
 * dateline-crossing shape can't be drawn or edited back through the
 * normal tools at all today - Leaflet has no wraparound rendering for
 * it, and Mapbox's own globe projection drops to flat Mercator well
 * before any usable zoom level - so importing one would leave a
 * neighbourhood with no way to fix it through the app, and could
 * render inconsistently (or not at all) between the two map engines.
 * Keeping this out at the door is simpler than teaching every derived-
 * value calculation and every consumer of the data a new set of
 * wraparound rules for a shape nothing else in the app can actually
 * produce or repair.
 */
function ringCrossesAntimeridian(ring) {
  if (!Array.isArray(ring) || ring.length < 2) return false;

  for (let i = 0; i < ring.length - 1; i += 1) {
    const currentLng = Number(ring[i]?.[0]);
    const nextLng = Number(ring[i + 1]?.[0]);

    if (!Number.isFinite(currentLng) || !Number.isFinite(nextLng)) continue;

    if (Math.abs(nextLng - currentLng) > 180) {
      return true;
    }
  }

  return false;
}

function extractFeatureItems(geojson) {
  const items = [];

  const pushPolygon = (geometry, properties = {}) => {
    if (ringCrossesAntimeridian(geometry?.coordinates?.[0])) return;

    const cleaned = sanitizePolygonGeometry(geometry);
    if (!cleaned) return;

    items.push({
      geometry: cleaned,
      properties:
        properties && typeof properties === "object" ? properties : {},
    });
  };

  const pushGeometry = (geometry, properties = {}) => {
    if (!geometry || typeof geometry !== "object") return;

    if (geometry.type === "Polygon") {
      pushPolygon(geometry, properties);
      return;
    }

    if (geometry.type === "MultiPolygon") {
      if (!Array.isArray(geometry.coordinates)) return;

      geometry.coordinates.forEach((polygonCoords, index) => {
        pushPolygon(
          {
            type: "Polygon",
            coordinates: polygonCoords,
          },
          {
            ...properties,
            _multipartIndex: index,
          },
        );
      });
    }
  };

  if (!geojson || typeof geojson !== "object") {
    return {
      valid: false,
      message: "File is empty or invalid JSON.",
      items: [],
    };
  }

  if (geojson.type === "FeatureCollection") {
    (geojson.features || []).forEach((feature) => {
      if (feature?.type !== "Feature") return;
      pushGeometry(feature.geometry, feature.properties || {});
    });
  } else if (geojson.type === "Feature") {
    pushGeometry(geojson.geometry, geojson.properties || {});
  } else if (geojson.type === "Polygon" || geojson.type === "MultiPolygon") {
    pushGeometry(geojson, {});
  } else {
    return {
      valid: false,
      message:
        "Unsupported GeoJSON format. Upload a Polygon, MultiPolygon, Feature, or FeatureCollection.",
      items: [],
    };
  }

  if (items.length === 0) {
    return {
      valid: false,
      message: "No valid polygon geometry found.",
      items: [],
    };
  }

  return {
    valid: true,
    message: "",
    items,
  };
}

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function firstDefinedNumber(...values) {
  for (const value of values) {
    const normalized = normalizeNumber(value);
    if (normalized !== null) return normalized;
  }

  return null;
}

function getImportedName(properties = {}) {
  return (
    normalizeString(properties.zone_name) ||
    normalizeString(properties.name) ||
    normalizeString(properties.Neighbourhood) ||
    ""
  );
}

function getImportedPopulation(properties = {}) {
  return (
    normalizeNumber(properties.population) ??
    normalizeNumber(properties.pop_2021) ??
    normalizeNumber(properties.target_pop) ??
    normalizeNumber(properties.Population) ??
    null
  );
}

function getImportedMunicipality(properties = {}) {
  return (
    normalizeString(properties.municipality) ||
    normalizeString(properties.source_municipality) ||
    ""
  );
}

function getImportedTotalDwellings(properties = {}) {
  return (
    normalizeNumber(properties.total_private_dwellings_2021) ??
    normalizeNumber(properties.dwellings_total_2021) ??
    null
  );
}

function getImportedOccupiedDwellings(properties = {}) {
  return (
    normalizeNumber(properties.occupied_private_dwellings_2021) ??
    normalizeNumber(properties.dwellings_occupied_2021) ??
    null
  );
}

function getImportedLandArea(properties = {}) {
  return (
    normalizeNumber(properties.land_area_sqkm_2021) ??
    normalizeNumber(properties.LANDAREA) ??
    null
  );
}

function getImportedPopulationDensity(properties = {}) {
  return (
    normalizeNumber(properties.population_density_sqkm_2021) ??
    normalizeNumber(properties.pop_density_sqkm_2021) ??
    null
  );
}

function getImportedGreenSpaceCount(properties = {}) {
  return firstDefinedNumber(
    properties.green_space_count,
    properties.green_spaces,
    properties.green_space,
    properties.parks,
    properties.park_count,
  );
}

function getImportedSchoolCount(properties = {}) {
  return firstDefinedNumber(
    properties.school_count,
    properties.schools,
    properties.schools_count,
  );
}

function getImportedLibraryCount(properties = {}) {
  return firstDefinedNumber(
    properties.library_count,
    properties.libraries,
    properties.libraries_count,
  );
}

function getImportedHealthcareCount(properties = {}) {
  return firstDefinedNumber(
    properties.healthcare_count,
    properties.healthcare,
    properties.health_care,
    properties.clinics,
    properties.health_services,
  );
}

function getImportedTransitStopCount(properties = {}) {
  return firstDefinedNumber(
    properties.transit_stop_count,
    properties.transit_stops,
    properties.transit,
    properties.bus_stops,
  );
}

function getImportedCommunitySpaceCount(properties = {}) {
  return firstDefinedNumber(
    properties.community_space_count,
    properties.community_spaces,
    properties.community_centres,
    properties.community_centers,
    properties.community_space,
  );
}

function getImportedGreenSpaceCapacity(properties = {}) {
  return firstDefinedNumber(
    properties.green_space_capacity,
    properties.green_spaces_capacity,
    properties.parks_capacity,
  );
}

function getImportedSchoolCapacity(properties = {}) {
  return firstDefinedNumber(
    properties.school_capacity,
    properties.schools_capacity,
  );
}

function getImportedLibraryCapacity(properties = {}) {
  return firstDefinedNumber(
    properties.library_capacity,
    properties.libraries_capacity,
  );
}

function getImportedHealthcareCapacity(properties = {}) {
  return firstDefinedNumber(
    properties.healthcare_capacity,
    properties.health_care_capacity,
    properties.clinics_capacity,
  );
}

function getImportedTransitStopCapacity(properties = {}) {
  return firstDefinedNumber(
    properties.transit_stop_capacity,
    properties.transit_stops_capacity,
    properties.transit_capacity,
  );
}

function getImportedCommunitySpaceCapacity(properties = {}) {
  return firstDefinedNumber(
    properties.community_space_capacity,
    properties.community_spaces_capacity,
    properties.community_centres_capacity,
    properties.community_centers_capacity,
  );
}

function getImportedSingleDetachedHousing(properties = {}) {
  return firstDefinedNumber(
    properties.single_detached_housing_pct,
    properties.single_detached_housing,
    properties.single_detached_pct,
  );
}

function getImportedOvercrowdedHousing(properties = {}) {
  return firstDefinedNumber(
    properties.overcrowded_housing_pct,
    properties.overcrowded_housing,
    properties.overcrowded_pct,
  );
}

function getImportedUnaffordableHousing(properties = {}) {
  return firstDefinedNumber(
    properties.unaffordable_housing_pct,
    properties.unaffordable_housing,
    properties.unaffordable_pct,
  );
}

function getImportedTransitCommuters(properties = {}) {
  return firstDefinedNumber(
    properties.transit_commuters_pct,
    properties.transit_commuters,
    properties.transit_commuter_pct,
  );
}

function getImportedHouseholdsWithChildren(properties = {}) {
  return firstDefinedNumber(
    properties.households_with_children_pct,
    properties.households_with_children,
    properties.children_households_pct,
  );
}

function getImportedLowIncomeHouseholds(properties = {}) {
  return firstDefinedNumber(
    properties.low_income_households_pct,
    properties.low_income_households,
    properties.low_income_pct,
  );
}

function getImportedNonOfficialLanguageSpeakers(properties = {}) {
  return firstDefinedNumber(
    properties.non_official_language_speakers_pct,
    properties.non_official_language_speakers,
    properties.non_official_language_pct,
  );
}

function getImportedVisibleMinorities(properties = {}) {
  return firstDefinedNumber(
    properties.visible_minorities_pct,
    properties.visible_minorities,
    properties.visible_minority_pct,
  );
}

function getImportedColor(properties = {}) {
  const color =
    normalizeString(properties.color) ||
    normalizeString(properties.fillColor) ||
    normalizeString(properties.borderColor) ||
    "";

  return color || null;
}

function assignImportedSingleValue(targetInput, value) {
  if (!targetInput) return;

  if (value === null || value === undefined || value === "") {
    targetInput.mode = "";
    targetInput.singleValue = null;
    targetInput.min = null;
    targetInput.max = null;
    return;
  }

  targetInput.mode = "Single Value";
  targetInput.singleValue = value;
  targetInput.min = null;
  targetInput.max = null;
}

function getEstimatedCapacity(count, averagePerAsset) {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (!Number.isFinite(averagePerAsset) || averagePerAsset <= 0) return 0;

  return count * averagePerAsset;
}

function overwriteImportedFields(
  sections,
  importedName,
  importedPopulation,
  properties = {},
) {
  if (!Array.isArray(sections)) return;

  const locationInputs = sections[0]?.inputs;
  if (Array.isArray(locationInputs)) {
    if (locationInputs[0]) {
      locationInputs[0].value = importedName || "";
    }

    if (locationInputs[1]) {
      assignImportedSingleValue(locationInputs[1], importedPopulation);
    }
  }

  const censusInputs = sections[1]?.inputs;
  if (Array.isArray(censusInputs)) {
    const importedMunicipality = getImportedMunicipality(properties);
    const importedTotalDwellings = getImportedTotalDwellings(properties);
    const importedOccupiedDwellings = getImportedOccupiedDwellings(properties);
    const importedLandArea = getImportedLandArea(properties);
    const importedPopulationDensity = getImportedPopulationDensity(properties);

    if (censusInputs[0]) {
      censusInputs[0].value = importedMunicipality || "";
    }

    if (censusInputs[1]) {
      assignImportedSingleValue(censusInputs[1], importedTotalDwellings);
    }

    if (censusInputs[2]) {
      assignImportedSingleValue(censusInputs[2], importedOccupiedDwellings);
    }

    if (censusInputs[3]) {
      assignImportedSingleValue(censusInputs[3], importedLandArea);
    }

    if (censusInputs[4]) {
      assignImportedSingleValue(censusInputs[4], importedPopulationDensity);
    }
  }

  const assetInputs = sections[2]?.inputs;

  let greenSpaceCount = 0;
  let schoolCount = 0;
  let libraryCount = 0;
  let healthcareCount = 0;
  let transitStopCount = 0;
  let communitySpaceCount = 0;

  if (Array.isArray(assetInputs)) {
    greenSpaceCount = getImportedGreenSpaceCount(properties) ?? 0;
    schoolCount = getImportedSchoolCount(properties) ?? 0;
    libraryCount = getImportedLibraryCount(properties) ?? 0;
    healthcareCount = getImportedHealthcareCount(properties) ?? 0;
    transitStopCount = getImportedTransitStopCount(properties) ?? 0;
    communitySpaceCount = getImportedCommunitySpaceCount(properties) ?? 0;

    if (assetInputs[0]) {
      assignImportedSingleValue(assetInputs[0], greenSpaceCount);
    }

    if (assetInputs[1]) {
      assignImportedSingleValue(assetInputs[1], schoolCount);
    }

    if (assetInputs[2]) {
      assignImportedSingleValue(assetInputs[2], libraryCount);
    }

    if (assetInputs[3]) {
      assignImportedSingleValue(assetInputs[3], healthcareCount);
    }

    if (assetInputs[4]) {
      assignImportedSingleValue(assetInputs[4], transitStopCount);
    }

    if (assetInputs[5]) {
      assignImportedSingleValue(assetInputs[5], communitySpaceCount);
    }
  }

  const capacityInputs = sections[3]?.inputs;
  if (Array.isArray(capacityInputs)) {
    const importedGreenSpaceCapacity =
      getImportedGreenSpaceCapacity(properties) ??
      getEstimatedCapacity(
        greenSpaceCount,
        DEFAULT_CAPACITY_PER_ASSET.greenSpace,
      );

    const importedSchoolCapacity =
      getImportedSchoolCapacity(properties) ??
      getEstimatedCapacity(schoolCount, DEFAULT_CAPACITY_PER_ASSET.schools);

    const importedLibraryCapacity =
      getImportedLibraryCapacity(properties) ??
      getEstimatedCapacity(libraryCount, DEFAULT_CAPACITY_PER_ASSET.libraries);

    const importedHealthcareCapacity =
      getImportedHealthcareCapacity(properties) ??
      getEstimatedCapacity(
        healthcareCount,
        DEFAULT_CAPACITY_PER_ASSET.healthcare,
      );

    const importedTransitStopCapacity =
      getImportedTransitStopCapacity(properties) ??
      getEstimatedCapacity(
        transitStopCount,
        DEFAULT_CAPACITY_PER_ASSET.transitStops,
      );

    const importedCommunitySpaceCapacity =
      getImportedCommunitySpaceCapacity(properties) ??
      getEstimatedCapacity(
        communitySpaceCount,
        DEFAULT_CAPACITY_PER_ASSET.communitySpaces,
      );

    if (capacityInputs[0]) {
      assignImportedSingleValue(capacityInputs[0], importedGreenSpaceCapacity);
    }

    if (capacityInputs[1]) {
      assignImportedSingleValue(capacityInputs[1], importedSchoolCapacity);
    }

    if (capacityInputs[2]) {
      assignImportedSingleValue(capacityInputs[2], importedLibraryCapacity);
    }

    if (capacityInputs[3]) {
      assignImportedSingleValue(capacityInputs[3], importedHealthcareCapacity);
    }

    if (capacityInputs[4]) {
      assignImportedSingleValue(capacityInputs[4], importedTransitStopCapacity);
    }

    if (capacityInputs[5]) {
      assignImportedSingleValue(
        capacityInputs[5],
        importedCommunitySpaceCapacity,
      );
    }
  }

  const profileInputs = sections[4]?.inputs;
  if (Array.isArray(profileInputs)) {
    const importedSingleDetachedHousing =
      getImportedSingleDetachedHousing(properties);
    const importedOvercrowdedHousing =
      getImportedOvercrowdedHousing(properties);
    const importedUnaffordableHousing =
      getImportedUnaffordableHousing(properties);
    const importedTransitCommuters = getImportedTransitCommuters(properties);
    const importedHouseholdsWithChildren =
      getImportedHouseholdsWithChildren(properties);
    const importedLowIncomeHouseholds =
      getImportedLowIncomeHouseholds(properties);
    const importedNonOfficialLanguageSpeakers =
      getImportedNonOfficialLanguageSpeakers(properties);
    const importedVisibleMinorities = getImportedVisibleMinorities(properties);

    if (profileInputs[0]) {
      assignImportedSingleValue(
        profileInputs[0],
        importedSingleDetachedHousing,
      );
    }

    if (profileInputs[1]) {
      assignImportedSingleValue(profileInputs[1], importedOvercrowdedHousing);
    }

    if (profileInputs[2]) {
      assignImportedSingleValue(profileInputs[2], importedUnaffordableHousing);
    }

    if (profileInputs[3]) {
      assignImportedSingleValue(profileInputs[3], importedTransitCommuters);
    }

    if (profileInputs[4]) {
      assignImportedSingleValue(
        profileInputs[4],
        importedHouseholdsWithChildren,
      );
    }

    if (profileInputs[5]) {
      assignImportedSingleValue(profileInputs[5], importedLowIncomeHouseholds);
    }

    if (profileInputs[6]) {
      assignImportedSingleValue(
        profileInputs[6],
        importedNonOfficialLanguageSpeakers,
      );
    }

    if (profileInputs[7]) {
      assignImportedSingleValue(profileInputs[7], importedVisibleMinorities);
    }
  }
}

function buildNeighbourhoodPayload(
  blankFormTemplate,
  forms,
  schema,
  geometry,
  properties = {},
  dataUtils,
  activeLayer,
  activeParentDataItemId,
) {
  const cleanedGeometry = sanitizePolygonGeometry(geometry);
  if (!cleanedGeometry) return null;

  const form = structuredClone(blankFormTemplate);
  const importedColor = getImportedColor(properties);

  forms.injectLayer?.(form, activeLayer || 1, activeParentDataItemId || null);

  form.geometry = {
    ...structuredClone(cleanedGeometry),
    borderColor:
      importedColor || cleanedGeometry.borderColor || DEFAULT_BORDER_COLOR,
    fillColor: importedColor || cleanedGeometry.fillColor || DEFAULT_FILL_COLOR,
  };

  forms.injectRequiredDefaults?.(form, schema);
  forms.reapplyTimezoneFromLatLng?.(form);

  const importedName = getImportedName(properties);
  const importedPopulation = getImportedPopulation(properties);

  overwriteImportedFields(
    form.sections,
    importedName,
    importedPopulation,
    properties,
  );

  const payload = dataUtils.buildAddPayloadFromForm(form);
  if (!payload) return null;

  const validation = validateDataItemPayload({
    schema,
    dataItem: payload,
    mode: "add",
  });

  if (!validation.isValid) {
    return null;
  }

  return payload;
}

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

function NeighbourhoodAddModal({
  isOpen,
  onClose,
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
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedItems, setParsedItems] = useState([]);
  const [parseError, setParseError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedFile(null);
    setParsedItems([]);
    setParseError("");
    setIsImporting(false);
  }, [isOpen]);

  const importCountLabel = useMemo(() => {
    if (!parsedItems.length) return "No polygons loaded";
    if (parsedItems.length === 1) return "1 polygon ready to import";

    return `${parsedItems.length} polygons ready to import`;
  }, [parsedItems]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0] || null;

    setSelectedFile(file);
    setParsedItems([]);
    setParseError("");

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = extractFeatureItems(parsed);

      if (!result.valid) {
        setParseError(result.message);
        return;
      }

      setParsedItems(result.items);
    } catch (err) {
      console.error("GeoJSON parse error:", err);
      setParseError("Failed to read or parse the GeoJSON file.");
    }
  };

  const handleSubmit = async () => {
    if (!schema || !blankFormTemplate || !parsedItems.length) {
      system.notify("Please choose a valid GeoJSON file first.");
      return;
    }

    setIsImporting(true);
    system.startLoading?.("Importing neighbourhood polygons...");

    try {
      const neighbourhoods = parsedItems
        .map((item) =>
          buildNeighbourhoodPayload(
            blankFormTemplate,
            forms,
            schema,
            item.geometry,
            item.properties,
            dataUtils,
            activeLayer,
            activeParentDataItemId,
          ),
        )
        .filter(Boolean);

      if (!neighbourhoods.length) {
        system.notify("No valid polygons were ready to import.");
        return;
      }

      const { data: apiResponse, message } = await apis.engineApi.addBatch(
        schema._id,
        neighbourhoods,
      );

      if (!apiResponse || !Array.isArray(apiResponse.insertedIds)) {
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

      if (message) {
        system.notify(message);
      }

      const insertedIds = apiResponse?.insertedIds || [];

      if (
        !Array.isArray(insertedIds) ||
        insertedIds.length !== neighbourhoods.length
      ) {
        system.notify("Batch import returned an unexpected id count.");
        return;
      }

      const normalizedDocs = neighbourhoods
        .map((payload, index) => {
          const insertedId = insertedIds[index];
          if (!insertedId?._id) return null;

          return dataUtils.normalizeDataItem(schema, {
            _id: insertedId._id,
            ...payload,
            type: "neighbourhood",
            userRole: "editor",
          });
        })
        .filter(Boolean);

      normalizedDocs.forEach((doc) => {
        dataUtils.insertDataItemInList(setData, doc);
      });

      if (normalizedDocs.length > 0) {
        fitImportedBounds(map, normalizedDocs);
        onClose();
        return;
      }

      system.notify("No polygons were imported.");
    } catch (err) {
      console.error("Neighbourhood batch import failed:", err);
      system.notify("Failed to import neighbourhood GeoJSON.");
    } finally {
      setIsImporting(false);
      system.stopLoading?.();
    }
  };

  if (!isOpen || !schema) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose} aria-hidden="true">
      <div
        className="modal-overlay centered-modal-overlay"
        onMouseDown={(e) => e.stopPropagation()}
        aria-hidden={!isOpen}
      >
        <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={onClose} aria-label="Exit">
            ×
          </button>

          <h2 id="add-modal-heading">Import Neighbourhood GeoJSON</h2>

          <div className="modal-section">
            <p>
              Upload a GeoJSON file containing polygon boundaries. The file is
              read in the browser, converted into neighbourhood documents,
              uploaded in one batch, then discarded.
            </p>

            <label htmlFor="neighbourhood-geojson-upload">GeoJSON File</label>
            <input
              id="neighbourhood-geojson-upload"
              type="file"
              accept=".geojson,.json,application/geo+json,application/json"
              onChange={handleFileChange}
              aria-label="Choose GeoJSON file"
            />

            {selectedFile && (
              <p>
                <strong>Selected:</strong> {selectedFile.name}
              </p>
            )}

            <p>
              <strong>Status:</strong> {importCountLabel}
            </p>

            {parseError && (
              <p role="alert" className="form-error-text">
                {parseError}
              </p>
            )}

            {parsedItems.length > 0 && (
              <div className="modal-preview-list">
                <p>
                  <strong>Preview:</strong>
                </p>
                <ul>
                  {parsedItems.slice(0, 10).map((item, index) => {
                    const importedName = getImportedName(item.properties);
                    const importedPopulation = getImportedPopulation(
                      item.properties,
                    );

                    return (
                      <li key={index}>
                        {importedName || `Polygon ${index + 1}`}
                        {importedPopulation !== null
                          ? ` — Population ${importedPopulation}`
                          : ""}
                      </li>
                    );
                  })}
                </ul>

                {parsedItems.length > 10 && (
                  <p>...and {parsedItems.length - 10} more.</p>
                )}
              </div>
            )}
          </div>

          <div className="buttons-container">
            <button
              onClick={onClose}
              aria-label="Cancel"
              disabled={isImporting}
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              aria-label="Import GeoJSON"
              disabled={isImporting || parsedItems.length === 0}
            >
              {isImporting ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NeighbourhoodAddModal;
