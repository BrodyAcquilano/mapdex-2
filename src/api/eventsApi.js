// src/api/eventsApi.js

import api from "./axios.js";

export const eventsApi = {
  /* ─────────────────────────────
     GET ALL
  ───────────────────────────── */
  getAll: async (projectId) => {
    if (!projectId) {
      return { data: [], message: "Missing projectId." };
    }

    try {
      const res = await api.post("/api/events/get", { projectId });

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
      const res = await api.post(`/api/events/get/${_id}`, {
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
  add: async (projectId, schemaUpdatedAt, event) => {
    if (!projectId || !schemaUpdatedAt || !event) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.post("/api/events/add", {
        projectId,
        schemaUpdatedAt,
        event,
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
  addBatch: async (projectId, events) => {
    if (!projectId || !Array.isArray(events) || events.length === 0) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.post("/api/events/add-batch", {
        projectId,
        events,
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
  update: async (projectId, schemaUpdatedAt, event) => {
    if (!projectId || !schemaUpdatedAt || !event?._id) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put(`/api/events/update/${event._id}`, {
        projectId,
        schemaUpdatedAt,
        event,
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
      const res = await api.delete(`/api/events/remove/${_id}`, {
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
      const res = await api.put(`/api/events/update-geometry/${_id}`, {
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
  toggleExtensions: async (projectId, schemaUpdatedAt, event) => {
    if (
      !projectId ||
      !schemaUpdatedAt ||
      !event?._id ||
      !event?.updatedAt ||
      !event?.extensions
    ) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put(`/api/events/toggle-extensions/${event._id}`, {
        projectId,
        schemaUpdatedAt,
        extensions: event.extensions,
        updatedAt: event.updatedAt,
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
