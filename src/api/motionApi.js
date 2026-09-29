// src/api/motionApi.js

import api from "./axios.js";

export const motionApi = {
  /* ─────────────────────────────
     GET ALL
  ───────────────────────────── */
  getAll: async (projectId) => {
    if (!projectId) {
      return { data: [], message: "Missing projectId." };
    }

    try {
      const res = await api.post("/api/motion/get", { projectId });

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
      const res = await api.post(`/api/motion/get/${_id}`, {
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
  add: async (projectId, schemaUpdatedAt, motion) => {
    if (!projectId || !schemaUpdatedAt || !motion) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.post("/api/motion/add", {
        projectId,
        schemaUpdatedAt,
        motion,
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
     UPDATE
  ───────────────────────────── */
  update: async (projectId, schemaUpdatedAt, motion) => {
    if (!projectId || !schemaUpdatedAt || !motion?._id) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put(`/api/motion/update/${motion._id}`, {
        projectId,
        schemaUpdatedAt,
        motion,
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
      const res = await api.delete(`/api/motion/remove/${_id}`, {
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
     TOGGLE EXTENSIONS
  ───────────────────────────── */
  toggleExtensions: async (projectId, schemaUpdatedAt, motion) => {
    if (
      !projectId ||
      !schemaUpdatedAt ||
      !motion?._id ||
      !motion?.updatedAt ||
      !motion?.extensions
    ) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put(
        `/api/motion/toggle-extensions/${motion._id}`,
        {
          projectId,
          schemaUpdatedAt,
          extensions: motion.extensions,
          updatedAt: motion.updatedAt,
        },
      );

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