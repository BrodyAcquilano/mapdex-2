import api from "./axios.js";

export const projectChatApi = {
  /* ─────────────────────────────
     GET ALL
  ───────────────────────────── */
  getAll: async (projectId) => {
    if (!projectId) {
      return { data: null, message: "Missing projectId." };
    }

    try {
      const res = await api.post("/api/projectChat/get", { projectId });

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
  add: async (projectId, chatMessage) => {
    if (!projectId || !chatMessage) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.post("/api/projectChat/add", {
        projectId,
        chatMessage,
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