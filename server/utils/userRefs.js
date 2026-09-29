// server/utils/userRefs.js
// Strips internal fields (namely _id) from stored user reference objects
// ({ _id, userName, userColorTheme }) before they are sent to the client.
// User ids are never exposed to the frontend so they cannot be targeted or
// spoofed in other API requests.

export function sanitizeUserRefs(userRefs) {
  return Array.isArray(userRefs)
    ? userRefs.map((ref) => ({
        userName: ref?.userName || "",
        userColorTheme: ref?.userColorTheme || "green",
      }))
    : [];
}
