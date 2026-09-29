// shared/validation/formValueHelpers.js
import { DateTime } from "luxon";

export function isValidNumber(value, input = {}) {
  if (value === "" || value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;

  const number = Number(value);
  if (!Number.isFinite(number)) return false;

  const minValue = Number(input?.minValue);
  const maxValue = Number(input?.maxValue);

  if (Number.isFinite(minValue) && number < minValue) return false;
  if (Number.isFinite(maxValue) && number > maxValue) return false;

  return true;
}

export function normalizeTag(value) {
  if (typeof value !== "string") return "";

  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";

  return collapsed
    .split(" ")
    .map((word) => {
      if (!word) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function exceedsMaxLength(value, maxLength) {
  if (maxLength == null) return false;
  if (!Number.isFinite(Number(maxLength))) return false;

  return String(value ?? "").length > Number(maxLength);
}

export function parseISOToMs(value) {
  if (typeof value !== "string" || value.trim() === "") return null;

  const dt = DateTime.fromISO(value, { zone: "Etc/UTC" });
  return dt.isValid ? dt.toMillis() : null;
}

export function getDefaultDurationMinutes(time) {
  const n = Number(time?.defaultDurationMinutes);
  if (Number.isFinite(n) && n > 0) return n;
  return 60;
}

export function dateTimeLocalToISO(localStr, tz) {
  if (!localStr) return null;

  const dt = DateTime.fromFormat(localStr, "yyyy-LL-dd'T'HH:mm", {
    zone: tz,
  });

  if (!dt.isValid) return null;

  return dt.toUTC().toISO({ suppressMilliseconds: true });
}

export function parseDatetimeLocalToMs(localStr, tz) {
  if (!localStr) return null;

  const dt = DateTime.fromFormat(localStr, "yyyy-LL-dd'T'HH:mm", {
    zone: tz,
  });

  if (!dt.isValid) return null;

  return dt.toUTC().toMillis();
}

export const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const timeOptionsAMPM = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? "00" : "30";
  const suffix = hour < 12 ? "a.m." : "p.m.";
  const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${formattedHour}:${minutes} ${suffix}`;
});

export function timeAMPMToMinutes(value) {
  if (typeof value !== "string") return null;

  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.)$/);

  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3];

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 1 || hours > 12) return null;
  if (minutes < 0 || minutes > 59) return null;

  if (period === "a.m." && hours === 12) {
    hours = 0;
  }

  if (period === "p.m." && hours !== 12) {
    hours += 12;
  }

  return hours * 60 + minutes;
}

export function createEmptyHoursData() {
  return {
    openHours: Object.fromEntries(daysOfWeek.map((day) => [day, []])),
  };
}