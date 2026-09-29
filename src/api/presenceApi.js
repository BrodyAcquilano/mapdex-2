// src/api/presenceApi.js

import api from "./axios.js";

export const presenceApi = {
  /* ─────────────────────────────
     GET ALL
  ───────────────────────────── */
  getAll: async (projectId, schemaMetadata = null) => {
    if (!projectId || !schemaMetadata) {
      return { data: null, message: "Missing projectId or schema metadata." };
    }

    try {
      const res = await api.post("/api/presence/get", {
        projectId,
        schemaMetadata,
      });

      return {
        data: res.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
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
      const res = await api.post(`/api/presence/get/${_id}`, {
        projectId,
      });

      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  /* ─────────────────────────────
     ADD
  ───────────────────────────── */
  add: async (projectId, schemaUpdatedAt, presence) => {
    if (!projectId || !schemaUpdatedAt || !presence) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.post("/api/presence/add", {
        projectId,
        schemaUpdatedAt,
        presence,
      });

      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  /* ─────────────────────────────
     UPDATE
  ───────────────────────────── */
  update: async (projectId, schemaUpdatedAt, presence) => {
    if (!projectId || !schemaUpdatedAt || !presence?._id) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put(`/api/presence/update/${presence._id}`, {
        projectId,
        schemaUpdatedAt,
        presence,
      });

      return {
        data: res.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  /* ─────────────────────────────
     PING
  ───────────────────────────── */
  ping: async (_id, projectId, coordinates) => {
    if (
      !_id ||
      !projectId ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2
    ) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put(`/api/presence/ping/${_id}`, {
        projectId,
        coordinates,
      });

      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  /* ─────────────────────────────
     REMOVE
  ───────────────────────────── */
  remove: async (_id, projectId) => {
    if (!_id || !projectId) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.delete(`/api/presence/remove/${_id}`, {
        data: { projectId },
      });

      return {
        data: res.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  toggleExtensions: async (projectId, schemaUpdatedAt, presence) => {
    if (
      !projectId ||
      !schemaUpdatedAt ||
      !presence?._id ||
      !presence?.updatedAt ||
      !presence?.extensions
    ) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put(
        `/api/presence/toggle-extensions/${presence._id}`,
        {
          projectId,
          schemaUpdatedAt,
          extensions: presence.extensions,
          updatedAt: presence.updatedAt,
        },
      );

      return {
        data: res.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },
};