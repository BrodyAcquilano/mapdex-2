// src/forms/geometry/renderGeometry.jsx

import { GEOMETRY_LIMITS } from "../../../shared/validation/validationConstants.js";

const DEFAULT_LINE_COLOR = "#3388ff";
const DEFAULT_BORDER_COLOR = "#2563eb";
const DEFAULT_FILL_COLOR = "#3b82f6";

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function formatDistance(distanceMeters) {
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) {
    return null;
  }

  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(2)} km`;
  }

  return `${Math.round(distanceMeters)} m`;
}

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return fallback;
}

function clampCoordinateStr(raw, { min, max, maxLen, finalize, finalValue }) {
  if (raw == null || raw === "") {
    return finalize ? String(finalValue) : "";
  }

  let s = String(raw).replace(/[^\d.-]/g, "");

  const minusIndex = s.indexOf("-");
  if (minusIndex > 0) {
    s = s.replace(/-/g, "");
  } else if (minusIndex === 0) {
    s = `-${s.slice(1).replace(/-/g, "")}`;
  }

  const dotIndex = s.indexOf(".");
  if (dotIndex !== -1) {
    s = s.slice(0, dotIndex + 1) + s.slice(dotIndex + 1).replace(/\./g, "");
  }

  if (maxLen && s.length > maxLen) {
    s = s.slice(0, maxLen);
  }

  if (!finalize && (s === "-" || s === "." || s === "-.")) {
    return s;
  }

  if (s === "" || s === "-" || s === "." || s === "-.") {
    return finalize ? String(finalValue) : "";
  }

  let n = Number(s);
  if (!Number.isFinite(n)) {
    return finalize ? String(finalValue) : "";
  }

  n = Math.max(min, Math.min(max, n));
  return String(n);
}

function ColorInputRow({
  id,
  label,
  field,
  value,
  fallback,
  geometryType,
  setFormData,
  setDraftGeometry,
}) {
  const normalizedColor = normalizeHexColor(value, fallback);

  function syncDraftColor(nextValue) {
    setDraftGeometry?.((prev) => {
      if (!prev || prev.type !== geometryType) {
        return prev;
      }

      return {
        ...prev,
        [field]: nextValue,
      };
    });
  }

  function updateColor(nextValue) {
    setFormData((prev) => ({
      ...prev,
      geometry: {
        ...prev.geometry,
        [field]: nextValue,
      },
    }));

    if (isHexColor(nextValue)) {
      syncDraftColor(nextValue.trim().toLowerCase());
    }
  }

  function finalizeColor() {
    const finalColor = normalizeHexColor(value, fallback);

    setFormData((prev) => ({
      ...prev,
      geometry: {
        ...prev.geometry,
        [field]: finalColor,
      },
    }));

    syncDraftColor(finalColor);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 56px 1fr 32px",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <label htmlFor={`${id}-color-input`}>{label}:</label>

      <input
        id={`${id}-color-input`}
        type="color"
        value={normalizedColor}
        onChange={(e) => updateColor(e.target.value)}
        style={{
          width: "44px",
          height: "32px",
          padding: "0",
          border: "1px solid #999",
          borderRadius: "6px",
          background: "transparent",
          cursor: "pointer",
        }}
      />

      <input
        type="text"
        value={value || fallback}
        onChange={(e) => updateColor(e.target.value)}
        onBlur={finalizeColor}
        style={{
          minWidth: 0,
        }}
      />

      <div
        aria-hidden="true"
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "4px",
          border: "1px solid #777",
          backgroundColor: normalizedColor,
        }}
      />
    </div>
  );
}

export function renderGeometrySection({
  schema,
  formData,
  setFormData,
  setDraftGeometry,
  onLatLngFinalized,
  forms,
  addEditComponent,
}) {
  if (schema?.engineKey === "presence") {
    return null;
  }

  const geometryType = formData?.geometry?.type || schema?.geometry?.type;

  if (geometryType === "Point") {
    if (addEditComponent === "addPanel") {
      return (
        <div
          className="section"
          role="region"
          aria-labelledby="geometry-heading"
        >
          <h3 id="geometry-heading">{schema.geometry.label}</h3>

          <div className="form-group">
            <div className="inline-row">
              <span className="label-container">Type:</span>

              <span className="value-container">Point</span>
            </div>
          </div>

          <div className="form-group">
            <ColorInputRow
              id="point-border"
              label="Border Color"
              field="borderColor"
              value={formData?.geometry?.borderColor}
              fallback={DEFAULT_BORDER_COLOR}
              geometryType="Point"
              setFormData={setFormData}
              setDraftGeometry={setDraftGeometry}
            />

            <ColorInputRow
              id="point-fill"
              label="Fill Color"
              field="fillColor"
              value={formData?.geometry?.fillColor}
              fallback={DEFAULT_FILL_COLOR}
              geometryType="Point"
              setFormData={setFormData}
              setDraftGeometry={setDraftGeometry}
            />
          </div>
        </div>
      );
    }

    const coords = formData?.geometry?.coordinates;

    const longitude =
      Array.isArray(coords) && coords.length === 2 ? coords[0] : "";

    const latitude =
      Array.isArray(coords) && coords.length === 2 ? coords[1] : "";

    const coordinateMaxLength = GEOMETRY_LIMITS.coordinateMaxLength;

    const longitudeMin = GEOMETRY_LIMITS.longitudeMin;

    const longitudeMax = GEOMETRY_LIMITS.longitudeMax;

    const latitudeMin = GEOMETRY_LIMITS.latitudeMin;

    const latitudeMax = GEOMETRY_LIMITS.latitudeMax;

    function updateCoordinate(index, rawValue) {
      const isLongitude = index === 0;

      const nextValue = clampCoordinateStr(rawValue, {
        min: isLongitude ? longitudeMin : latitudeMin,

        max: isLongitude ? longitudeMax : latitudeMax,

        maxLen: coordinateMaxLength,
        finalize: false,
        finalValue: 0,
      });

      setFormData((prev) => {
        const next = structuredClone(prev);

        if (!next.geometry || typeof next.geometry !== "object") {
          next.geometry = {};
        }

        if (
          !Array.isArray(next.geometry.coordinates) ||
          next.geometry.coordinates.length !== 2
        ) {
          next.geometry.coordinates = ["", ""];
        }

        next.geometry.type = "Point";
        next.geometry.coordinates[index] = nextValue;

        return next;
      });
    }

    function finalizeCoordinates() {
      const lng = Number(
        clampCoordinateStr(longitude, {
          min: longitudeMin,
          max: longitudeMax,
          maxLen: coordinateMaxLength,
          finalize: true,
          finalValue: 0,
        }),
      );

      const lat = Number(
        clampCoordinateStr(latitude, {
          min: latitudeMin,
          max: latitudeMax,
          maxLen: coordinateMaxLength,
          finalize: true,
          finalValue: 0,
        }),
      );

      const finalizedGeometry = {
        ...structuredClone(formData?.geometry || {}),

        type: "Point",

        coordinates: [lng, lat],
      };

      setFormData((prev) => {
        const next = structuredClone(prev);

        if (!next.geometry || typeof next.geometry !== "object") {
          next.geometry = {};
        }

        next.geometry = {
          ...next.geometry,
          ...structuredClone(finalizedGeometry),
        };

        forms?.reapplyTimezoneFromLatLng?.(next);

        return next;
      });

      setDraftGeometry?.(structuredClone(finalizedGeometry));

      if (typeof onLatLngFinalized === "function") {
        onLatLngFinalized({
          geometry: structuredClone(finalizedGeometry),
          lat,
          lng,
        });
      }
    }

    return (
      <div className="section" role="region" aria-labelledby="geometry-heading">
        <h3 id="geometry-heading">{schema.geometry.label}</h3>

        <div className="form-group">
          <div className="inline-row">
            <span className="label-container">Type:</span>

            <span className="value-container">Point</span>
          </div>
        </div>

        <div className="form-group">
          <label className="label-container" htmlFor="geometry-longitude">
            Longitude:
          </label>

          <input
            id="geometry-longitude"
            type="text"
            inputMode="decimal"
            className="value-container"
            value={longitude ?? ""}
            maxLength={coordinateMaxLength}
            onChange={(e) => updateCoordinate(0, e.target.value)}
            onBlur={finalizeCoordinates}
          />
        </div>

        <div className="form-group">
          <label className="label-container" htmlFor="geometry-latitude">
            Latitude:
          </label>

          <input
            id="geometry-latitude"
            type="text"
            inputMode="decimal"
            className="value-container"
            value={latitude ?? ""}
            maxLength={coordinateMaxLength}
            onChange={(e) => updateCoordinate(1, e.target.value)}
            onBlur={finalizeCoordinates}
          />
        </div>

        <div className="form-group">
          <ColorInputRow
            id="point-border"
            label="Border Color"
            field="borderColor"
            value={formData?.geometry?.borderColor}
            fallback={DEFAULT_BORDER_COLOR}
            geometryType="Point"
            setFormData={setFormData}
            setDraftGeometry={setDraftGeometry}
          />

          <ColorInputRow
            id="point-fill"
            label="Fill Color"
            field="fillColor"
            value={formData?.geometry?.fillColor}
            fallback={DEFAULT_FILL_COLOR}
            geometryType="Point"
            setFormData={setFormData}
            setDraftGeometry={setDraftGeometry}
          />
        </div>
      </div>
    );
  }

  if (geometryType === "LineString") {
    const distanceLabel = formatDistance(formData?.geometry?.distance);

    return (
      <div className="section" role="region" aria-labelledby="geometry-heading">
        <h3 id="geometry-heading">{schema.geometry.label}</h3>

        <div className="form-group">
          <div className="inline-row">
            <span className="label-container">Type:</span>

            <span className="value-container">LineString</span>
          </div>
        </div>

        {distanceLabel && (
          <div className="form-group">
            <div
              className="inline-row"
              role="group"
              aria-label={`Distance: ${distanceLabel}`}
            >
              <span className="label-container">Distance:</span>

              <span className="value-container">{distanceLabel}</span>
            </div>
          </div>
        )}

        <div className="form-group">
          <ColorInputRow
            id="linestring-line"
            label="Line Color"
            field="lineColor"
            value={formData?.geometry?.lineColor}
            fallback={DEFAULT_LINE_COLOR}
            geometryType="LineString"
            setFormData={setFormData}
            setDraftGeometry={setDraftGeometry}
          />
        </div>
      </div>
    );
  }

  if (geometryType === "Polygon") {
    return (
      <div className="section" role="region" aria-labelledby="geometry-heading">
        <h3 id="geometry-heading">{schema.geometry.label}</h3>

        <div className="form-group">
          <div className="inline-row">
            <span className="label-container">Type:</span>

            <span className="value-container">Polygon</span>
          </div>
        </div>

        <div className="form-group">
          <ColorInputRow
            id="polygon-border"
            label="Border Color"
            field="borderColor"
            value={formData?.geometry?.borderColor}
            fallback={DEFAULT_BORDER_COLOR}
            geometryType="Polygon"
            setFormData={setFormData}
            setDraftGeometry={setDraftGeometry}
          />

          <ColorInputRow
            id="polygon-fill"
            label="Fill Color"
            field="fillColor"
            value={formData?.geometry?.fillColor}
            fallback={DEFAULT_FILL_COLOR}
            geometryType="Polygon"
            setFormData={setFormData}
            setDraftGeometry={setDraftGeometry}
          />
        </div>
      </div>
    );
  }

  /*
   * The three multi- types below deliberately mirror LineString's/
   * Polygon's own sections exactly - Type row plus color row(s), no
   * coordinate editing UI - per Brody's own call: the edit panel never
   * lets any geometry other than Point have its coordinates typed in
   * directly (Line/Polygon coordinates only ever come from the map's
   * own draw/drag tools), and that stays true for the multi- versions
   * too, coming soon or not.
   */
  if (geometryType === "MultiPoint") {
    return (
      <div className="section" role="region" aria-labelledby="geometry-heading">
        <h3 id="geometry-heading">{schema.geometry.label}</h3>

        <div className="form-group">
          <div className="inline-row">
            <span className="label-container">Type:</span>

            <span className="value-container">MultiPoint</span>
          </div>
        </div>

        <div className="form-group">
          <ColorInputRow
            id="multipoint-border"
            label="Border Color"
            field="borderColor"
            value={formData?.geometry?.borderColor}
            fallback={DEFAULT_BORDER_COLOR}
            geometryType="MultiPoint"
            setFormData={setFormData}
            setDraftGeometry={setDraftGeometry}
          />

          <ColorInputRow
            id="multipoint-fill"
            label="Fill Color"
            field="fillColor"
            value={formData?.geometry?.fillColor}
            fallback={DEFAULT_FILL_COLOR}
            geometryType="MultiPoint"
            setFormData={setFormData}
            setDraftGeometry={setDraftGeometry}
          />
        </div>
      </div>
    );
  }

  if (geometryType === "MultiLineString") {
    return (
      <div className="section" role="region" aria-labelledby="geometry-heading">
        <h3 id="geometry-heading">{schema.geometry.label}</h3>

        <div className="form-group">
          <div className="inline-row">
            <span className="label-container">Type:</span>

            <span className="value-container">MultiLineString</span>
          </div>
        </div>

        <div className="form-group">
          <ColorInputRow
            id="multilinestring-line"
            label="Line Color"
            field="lineColor"
            value={formData?.geometry?.lineColor}
            fallback={DEFAULT_LINE_COLOR}
            geometryType="MultiLineString"
            setFormData={setFormData}
            setDraftGeometry={setDraftGeometry}
          />
        </div>
      </div>
    );
  }

  if (geometryType === "MultiPolygon") {
    return (
      <div className="section" role="region" aria-labelledby="geometry-heading">
        <h3 id="geometry-heading">{schema.geometry.label}</h3>

        <div className="form-group">
          <div className="inline-row">
            <span className="label-container">Type:</span>

            <span className="value-container">MultiPolygon</span>
          </div>
        </div>

        <div className="form-group">
          <ColorInputRow
            id="multipolygon-border"
            label="Border Color"
            field="borderColor"
            value={formData?.geometry?.borderColor}
            fallback={DEFAULT_BORDER_COLOR}
            geometryType="MultiPolygon"
            setFormData={setFormData}
            setDraftGeometry={setDraftGeometry}
          />

          <ColorInputRow
            id="multipolygon-fill"
            label="Fill Color"
            field="fillColor"
            value={formData?.geometry?.fillColor}
            fallback={DEFAULT_FILL_COLOR}
            geometryType="MultiPolygon"
            setFormData={setFormData}
            setDraftGeometry={setDraftGeometry}
          />
        </div>
      </div>
    );
  }

  return null;
}

export default renderGeometrySection;
