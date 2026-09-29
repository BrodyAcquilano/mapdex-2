// src/api/boundariesApi.js

import api from "./axios.js";

export const boundariesApi = {
  /* ─────────────────────────────
     GET ALL
  ───────────────────────────── */
  getAll: async (projectId) => {
    if (!projectId) {
      return { data: [], message: "Missing projectId." };
    }

    try {
      const res = await api.post("/api/boundaries/get", { projectId });

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
     CREATE (draw or import - both resolve to a raw geometry client-side)
  ───────────────────────────── */
  create: async (boundary) => {
    if (!boundary) {
      return { data: null, message: "Missing boundary." };
    }

    try {
      const res = await api.post("/api/boundaries/create", boundary);

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
     UPDATE (rename only)
  ───────────────────────────── */
  update: async (boundary) => {
    if (!boundary?._id || !boundary?.projectId) {
      return { data: null, message: "Missing _id or projectId." };
    }

    try {
      const res = await api.post("/api/boundaries/update", boundary);

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
     UPDATE GEOMETRY (Move Vertex / Move Boundary map tools - a
     separate route from update() above, which only ever touches name)
  ───────────────────────────── */
  updateGeometry: async (boundary) => {
    if (!boundary?._id || !boundary?.projectId) {
      return { data: null, message: "Missing _id or projectId." };
    }

    try {
      const res = await api.post("/api/boundaries/update-geometry", boundary);

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
      const res = await api.delete(`/api/boundaries/remove/${_id}`, {
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
