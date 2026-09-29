// src/forms/injectCurrentLocation.js

// ─────────────────────────────────────────────
// Location Functions
// ─────────────────────────────────────────────
// Point geometry only

export function injectCurrentLocation(formData) {
  return new Promise((resolve) => {
    if (formData?.geometry?.type !== "Point") return resolve();
    if (!("geolocation" in navigator)) return resolve();

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));

        if (!formData.geometry || formData.geometry.type !== "Point") {
          return resolve();
        }

        formData.geometry.coordinates = [lng, lat];
        resolve();
      },
      (err) => {
        console.warn("Geolocation failed:", err.message);
        resolve();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
}