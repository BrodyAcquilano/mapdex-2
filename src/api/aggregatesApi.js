// src/api/aggregatesApi.js

import api from "./axios.js";

export const aggregatesApi = {
  /* ─────────────────────────────
     GET ALL
  ───────────────────────────── */
  getAll: async (projectId) => {
    if (!projectId) {
      return { data: [], message: "Missing projectId." };
    }

    try {
      const res = await api.post("/api/aggregates/get", { projectId });

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
  create: async (aggregate) => {
    if (!aggregate) {
      return { data: null, message: "Missing aggregate." };
    }

    try {
      const res = await api.post("/api/aggregates/create", aggregate);

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
     UPDATE (metadata only)
  ───────────────────────────── */
  update: async (aggregate) => {
    if (!aggregate?._id || !aggregate?.projectId) {
      return { data: null, message: "Missing _id or projectId." };
    }

    try {
      const res = await api.post("/api/aggregates/update", aggregate);

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
      const res = await api.delete(`/api/aggregates/remove/${_id}`, {
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
