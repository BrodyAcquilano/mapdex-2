export function getViewerTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || "Etc/UTC";
  } catch {
    return "Etc/UTC";
  }
}
