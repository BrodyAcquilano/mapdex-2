// src/api/placesApi.js

import api from "./axios.js";

export const placesApi = {
  /* ─────────────────────────────
     GET ALL
  ───────────────────────────── */
  getAll: async (projectId) => {
    if (!projectId) {
      return { data: [], message: "Missing projectId." };
    }

    try {
      const res = await api.post("/api/places/get", { projectId });

      return {
        data: res.data?.data || [],
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { data: [], message };
    }
  },

  /* ─────────────────────────────
     GET ONE
  ───────────────────────────── */
  getOne: async (_id, projectId) => {
    if (!_id || !projectId) {
      return { data: null, message: "Missing _id or projectId." };
    }

    try {
      const res = await api.post(`/api/places/get/${_id}`, {
        projectId,
      });

      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  /* ─────────────────────────────
     ADD
  ───────────────────────────── */
  add: async (projectId, schemaUpdatedAt, place) => {
    if (!projectId || !schemaUpdatedAt || !place) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.post("/api/places/add", {
        projectId,
        schemaUpdatedAt,
        place,
      });

      return {
        data: res.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  /* ─────────────────────────────
     ADD BATCH
  ───────────────────────────── */
  addBatch: async (projectId, places) => {
    if (!projectId || !Array.isArray(places) || places.length === 0) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.post("/api/places/add-batch", {
        projectId,
        places,
      });

      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  /* ─────────────────────────────
   UPDATE
───────────────────────────── */
  update: async (projectId, schemaUpdatedAt, place) => {
    if (!projectId || !schemaUpdatedAt || !place?._id) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put(`/api/places/update/${place._id}`, {
        projectId,
        schemaUpdatedAt,
        place,
      });

      return {
        data: res.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  /* ─────────────────────────────
   REMOVE
───────────────────────────── */
  remove: async (_id, projectId, schemaUpdatedAt, updatedAt) => {
    if (!_id || !projectId || !schemaUpdatedAt || !updatedAt) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.delete(`/api/places/remove/${_id}`, {
        data: {
          projectId,
          schemaUpdatedAt,
          updatedAt,
        },
      });

      return {
        data: res.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  /* ─────────────────────────────
   UPDATE GEOMETRY
───────────────────────────── */
  updateGeometry: async (projectId, schemaUpdatedAt, _id, geometry, updatedAt) => {
    if (!projectId || !schemaUpdatedAt || !_id || !geometry || !updatedAt) {
      return {
        data: null,
        message: "Missing data.",
      };
    }

    try {
      const res = await api.put(`/api/places/update-geometry/${_id}`, {
        projectId,
        schemaUpdatedAt,
        geometry,
        updatedAt,
      });

      return {
        data: res.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";

      return {
        data: null,
        message,
      };
    }
  },

  /* ─────────────────────────────
   TOGGLE EXTENSIONS
───────────────────────────── */
  toggleExtensions: async (projectId, schemaUpdatedAt, place) => {
    if (
      !projectId ||
      !schemaUpdatedAt ||
      !place?._id ||
      !place?.updatedAt ||
      !place?.extensions
    ) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put(`/api/places/toggle-extensions/${place._id}`, {
        projectId,
        schemaUpdatedAt,
        extensions: place.extensions,
        updatedAt: place.updatedAt,
      });

      return {
        data: res.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },
};
