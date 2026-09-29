// src/display/geometry/GeometryRenderer.jsx

function formatDistance(distanceMeters) {
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) {
    return null;
  }

  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(2)} km`;
  }

  return `${Math.round(distanceMeters)} m`;
}

export default function renderGeometrySection(selectedDataItem, schema) {
  const geometrySchema = schema?.geometry;
  const geometryData = selectedDataItem?.geometry;

  if (!geometrySchema || !geometryData) return null;
  if (!geometrySchema.isDisplayed) return null;
  if (!geometryData.type) return null;

  const isPoint =
    geometryData.type === "Point";

  const [longitude, latitude] =
    isPoint &&
    Array.isArray(geometryData.coordinates)
      ? geometryData.coordinates
      : [];

  const hasPointCoordinates =
    longitude != null &&
    latitude != null;

  const isLineString =
    geometryData.type === "LineString";

  const distanceLabel = isLineString
    ? formatDistance(geometryData.distance)
    : null;

  return (
    <div className="section" key="geometry-section">
      <h3>{geometrySchema.label || "Geometry"}</h3>

      <div className="form-group">
        <div
          className="inline-row"
          role="group"
          aria-label={`Type: ${geometryData.type}`}
        >
          <span className="label-container">
            Type:
          </span>

          <span className="value-container">
            {geometryData.type}
          </span>
        </div>
      </div>

      {isPoint && hasPointCoordinates && (
        <>
          <div className="form-group">
            <div
              className="inline-row"
              role="group"
              aria-label={`Longitude: ${longitude}`}
            >
              <span className="label-container">
                Longitude:
              </span>

              <span className="value-container">
                {longitude}
              </span>
            </div>
          </div>

          <div className="form-group">
            <div
              className="inline-row"
              role="group"
              aria-label={`Latitude: ${latitude}`}
            >
              <span className="label-container">
                Latitude:
              </span>

              <span className="value-container">
                {latitude}
              </span>
            </div>
          </div>
        </>
      )}

      {isLineString && distanceLabel && (
        <div className="form-group">
          <div
            className="inline-row"
            role="group"
            aria-label={`Distance: ${distanceLabel}`}
          >
            <span className="label-container">
              Distance:
            </span>

            <span className="value-container">
              {distanceLabel}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}