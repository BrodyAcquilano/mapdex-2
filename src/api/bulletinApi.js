import api from "./axios.js";

export const bulletinApi = {
  /* ─────────────────────────────
     GET ALL
  ───────────────────────────── */
  getAll: async (projectId) => {
    if (!projectId) {
      return { data: null, message: "Missing projectId." };
    }

    try {
      const res = await api.post("/api/bulletin/get", { projectId });

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
  add: async (projectId, bulletinMessage) => {
    if (!projectId || !bulletinMessage) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.post("/api/bulletin/add", {
        projectId,
        bulletinMessage,
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
  update: async (projectId, messageId, updates) => {
    if (!projectId || !messageId || !updates) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put("/api/bulletin/update", {
        projectId,
        messageId,
        updates,
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
  remove: async (projectId, messageId) => {
    if (!projectId || !messageId) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.delete("/api/bulletin/remove", {
        data: { projectId, messageId },
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
};