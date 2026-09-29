import tzLookup from "tz-lookup";
import { DateTime } from "luxon";

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(value) {
  return value * Math.PI / 180;
}

function isValidCoordinate(coordinate) {
  if (
    !Array.isArray(coordinate) ||
    coordinate.length < 2
  ) {
    return false;
  }

  const lng = Number(coordinate[0]);
  const lat = Number(coordinate[1]);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

function getSegmentLengthKm(a, b) {
  if (
    !isValidCoordinate(a) ||
    !isValidCoordinate(b)
  ) {
    return null;
  }

  const lng1 = Number(a[0]);
  const lat1 = Number(a[1]);

  const lng2 = Number(b[0]);
  const lat2 = Number(b[1]);

  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const deltaLat =
    toRadians(lat2 - lat1);

  const deltaLng =
    toRadians(lng2 - lng1);

  const sinLat =
    Math.sin(deltaLat / 2);

  const sinLng =
    Math.sin(deltaLng / 2);

  const haversine =
    sinLat * sinLat +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      sinLng *
      sinLng;

  const centralAngle =
    2 *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine),
    );

  return EARTH_RADIUS_KM * centralAngle;
}

function interpolateLongitude(
  startLng,
  endLng,
  ratio,
) {
  let delta =
    endLng - startLng;

  /*
   * Handle lines crossing the antimeridian.
   *
   * Without this, interpolating from 179°
   * to -179° would incorrectly pass through 0°.
   */
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }

  let lng =
    startLng +
    delta * ratio;

  if (lng > 180) {
    lng -= 360;
  } else if (lng < -180) {
    lng += 360;
  }

  return lng;
}

function getLineMidpoint(geometry) {
  const coordinates =
    geometry?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  ) {
    return null;
  }

  const segments = [];
  let totalLength = 0;

  for (
    let i = 0;
    i < coordinates.length - 1;
    i += 1
  ) {
    const start =
      coordinates[i];

    const end =
      coordinates[i + 1];

    const length =
      getSegmentLengthKm(
        start,
        end,
      );

    if (
      length === null ||
      !Number.isFinite(length)
    ) {
      return null;
    }

    segments.push({
      start,
      end,
      length,
    });

    totalLength += length;
  }

  /*
   * Degenerate line where every coordinate
   * is effectively the same location.
   */
  if (totalLength === 0) {
    const first =
      coordinates[0];

    return {
      lng: Number(first[0]),
      lat: Number(first[1]),
    };
  }

  const targetDistance =
    totalLength / 2;

  let traversed = 0;

  for (const segment of segments) {
    const segmentEnd =
      traversed +
      segment.length;

    if (
      targetDistance <= segmentEnd
    ) {
      const ratio =
        segment.length === 0
          ? 0
          : (
              targetDistance -
              traversed
            ) /
            segment.length;

      const startLng =
        Number(segment.start[0]);

      const startLat =
        Number(segment.start[1]);

      const endLng =
        Number(segment.end[0]);

      const endLat =
        Number(segment.end[1]);

      return {
        lng:
          interpolateLongitude(
            startLng,
            endLng,
            ratio,
          ),

        lat:
          startLat +
          (
            endLat -
            startLat
          ) *
          ratio,
      };
    }

    traversed =
      segmentEnd;
  }

  const last =
    coordinates[
      coordinates.length - 1
    ];

  return {
    lng: Number(last[0]),
    lat: Number(last[1]),
  };
}

function getGeometryLatLng(geometry) {
  const geometryType =
    geometry?.type;

  if (geometryType === "Point") {
    const lng =
      Number(
        geometry?.coordinates?.[0],
      );

    const lat =
      Number(
        geometry?.coordinates?.[1],
      );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    return {
      lat,
      lng,
    };
  }

  if (
    geometryType === "LineString"
  ) {
    return getLineMidpoint(
      geometry,
    );
  }

  if (geometryType === "Polygon") {
    const lat =
      Number(
        geometry?.centroid?.lat,
      );

    const lng =
      Number(
        geometry?.centroid?.lng,
      );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    return {
      lat,
      lng,
    };
  }

  return null;
}

export function reapplyTimezoneFromLatLng(
  formData,
) {
  if (!formData) {
    return;
  }

  const timeType =
    formData?.time?.type;

  const location =
    getGeometryLatLng(
      formData?.geometry,
    );

  if (!location) {
    return;
  }

  const {
    lat,
    lng,
  } = location;

  let newTz;

  try {
    newTz =
      tzLookup(
        lat,
        lng,
      );
  } catch {
    return;
  }

  if (!newTz) {
    return;
  }

  const oldTopLevelTz =
    formData?.time?.timezone ||
    "Etc/UTC";

  if (
    oldTopLevelTz === newTz
  ) {
    return;
  }

  if (
    !formData.time ||
    typeof formData.time !==
      "object"
  ) {
    formData.time = {};
  }

  if (timeType === "None") {
    formData.time.timezone =
      newTz;

    return;
  }

  if (timeType !== "Event") {
    formData.time.timezone =
      newTz;

    return;
  }

  formData.time.timezone =
    newTz;

  const dates =
    formData?.time?.dates;

  if (
    !Array.isArray(dates) ||
    dates.length === 0
  ) {
    formData.time.dates = [];

    return;
  }

  formData.time.dates =
    dates.map((d) => {
      if (!d?.start) {
        return d;
      }

      const start =
        DateTime
          .fromISO(
            d.start,
            {
              zone:
                oldTopLevelTz,
            },
          )
          .setZone(newTz)
          .toISO({
            suppressMilliseconds:
              true,
          });

      const end =
        d.end != null
          ? DateTime
              .fromISO(
                d.end,
                {
                  zone:
                    oldTopLevelTz,
                },
              )
              .setZone(newTz)
              .toISO({
                suppressMilliseconds:
                  true,
              })
          : null;

      return {
        ...d,
        start,
        end,
      };
    });
}