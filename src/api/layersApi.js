// src/api/layersApi.js

import api from "./axios.js";

export const layersApi = {
  /* ─────────────────────────────
     GET ALL
  ───────────────────────────── */
  getAll: async (projectId) => {
    if (!projectId) {
      return { data: [], message: "Missing projectId." };
    }

    try {
      const res = await api.post("/api/layers/get", { projectId });

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
     CREATE
  ───────────────────────────── */
  create: async (layer) => {
    if (!layer) {
      return { data: null, message: "Missing layer." };
    }

    try {
      const res = await api.post("/api/layers/create", layer);

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
  update: async (layer) => {
    if (!layer?._id || !layer?.projectId) {
      return { data: null, message: "Missing _id or projectId." };
    }

    try {
      const res = await api.post("/api/layers/update", layer);

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
     DELETE
  ───────────────────────────── */
  remove: async (_id, projectId) => {
    if (!_id || !projectId) {
      return { data: null, message: "Missing _id or projectId." };
    }

    try {
      const res = await api.delete(`/api/layers/remove/${_id}`, {
        data: { projectId },
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


};
