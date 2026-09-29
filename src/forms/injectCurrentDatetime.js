// src/forms/injectCurrentDateTime.js

import { DateTime } from "luxon";
import { getDefaultDurationMinutes } from "../../shared/validation/formValueHelpers.js";

import { getViewerTimeZone } from "./getViewerTimezone.js";

export function injectCurrentDateTime(formData, schema) {
  if (!formData?.time || !schema?.time?.type) return;

  const timeType = schema.time.type;
  formData.time.type = timeType;

  const tz = getViewerTimeZone();

  if (timeType === "None") {
    formData.time.timezone = tz;
    return;
  }

  const now = DateTime.now().setZone(tz);

  const durationMin = getDefaultDurationMinutes(schema.time);
  const mode = schema.time.modes?.[0] || "Range";

  let dates = [];

  if (mode === "Range") {
    const start = now;
    const end = now.plus({ minutes: durationMin });

    dates = [
      {
        start: start.toUTC().toISO({ suppressMilliseconds: true }),
        end: end.toUTC().toISO({ suppressMilliseconds: true }),
      },
    ];
  } else if (mode === "Instant") {
    const instant = now.toUTC().toISO({ suppressMilliseconds: true });

    dates = [
      {
        start: instant,
        end: instant,
      },
    ];
  } else if (mode === "Ongoing") {
    dates = [
      {
        start: now.toUTC().toISO({ suppressMilliseconds: true }),
        end: null,
      },
    ];
  }

  formData.time.mode = mode;
  formData.time.timezone = tz;
  formData.time.dates = dates;
}
