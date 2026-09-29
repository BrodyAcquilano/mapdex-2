// public/sw.js

// Minimal service worker
// - Makes app installable
// - No caching
// - Always loads fresh content

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

// No fetch handler → no caching → no stale builds
// public/sw.js

