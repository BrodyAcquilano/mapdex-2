// src/exports/utils/downloadGeoJSON.js

/*
 * Turns a GeoJSON object into a file the browser saves.
 *
 * One definition, because every export used to repeat it: each call
 * site built its own Blob, created an <a>, clicked it, removed it and
 * revoked the object URL, and each one sanitised the filename with its
 * own copy of the same regex.
 *
 * Pretty-printed with a 2-space indent, matching what the server used
 * to send. Compact output is about half the size (206 KB against 106 KB
 * on this project's own data), but these files are read and checked by
 * people far more often than they are fed to a machine, and a single
 * unbroken line is nearly impossible to verify by eye. Brody's own
 * call: legibility wins over the bytes.
 */

const FORBIDDEN_FILENAME_CHARACTERS = /[<>:"/\\|?*]/g;

/*
 * Windows forbids <>:"/\|?* in filenames and every platform dislikes
 * control characters; spaces become hyphens so the name survives a
 * shell without quoting.
 *
 * Control characters are dropped by character code rather than by a
 * regex range - the equivalent pattern trips ESLint's own
 * no-control-regex, which every copy of this in the codebase used to
 * suppress with an inline disable.
 */
export function toSafeFileName(name, fallback = "export") {
  const safe = String(name || "")
    .trim()
    .replace(FORBIDDEN_FILENAME_CHARACTERS, "")
    .split("")
    .filter((character) => character.charCodeAt(0) > 31)
    .join("")
    .replace(/\s+/g, "-");

  return safe || fallback;
}

export function downloadGeoJSON(geojson, fileName) {
  const blob = new Blob([JSON.stringify(geojson, null, 2)], {
    type: "application/geo+json;charset=utf-8",
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${toSafeFileName(fileName, "export")}.geojson`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  /*
   * Without this the blob is held for the life of the document - it is
   * the one piece of cleanup the old call sites did remember, and the
   * one most easily lost in a rewrite.
   */
  window.URL.revokeObjectURL(url);
}
