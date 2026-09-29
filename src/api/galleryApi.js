// src/api/galleryApi.js

import api from "./axios.js";

export const galleryApi = {
  /* ─────────────────────────────
     GET ALL (by dataItemId)
  ───────────────────────────── */
  getAll: async (projectId, dataItemId, engineKey) => {
    if (!projectId || !dataItemId || !engineKey) {
      return {
        data: [],
        message: "Missing projectId, dataItemId, or engineKey.",
      };
    }

    try {
      const res = await api.post("/api/gallery/get", {
        projectId,
        dataItemId,
        engineKey,
      });

      return {
        data: res.data?.data || [],
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.error || "Unable to reach server.";
      return { data: [], message };
    }
  },

  /* ─────────────────────────────
     ADD (upload image)
  ───────────────────────────── */
  add: async (projectId, dataItemId, engineKey, file) => {
    if (!projectId || !dataItemId || !engineKey || !file) {
      return { data: null, message: "Missing data." };
    }

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("projectId", projectId);
      formData.append("dataItemId", dataItemId);
      formData.append("engineKey", engineKey);

      const res = await api.post("/api/gallery/add", formData, {
        headers: { "Content-Type": "multipart/form-data" },
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
     REMOVE (single image doc)
  ───────────────────────────── */
  remove: async (projectId, imageId, engineKey) => {
    if (!projectId || !imageId || !engineKey) {
      return {
        data: null,
        message: "Missing projectId, imageId, or engineKey.",
      };
    }

    try {
      const res = await api.post("/api/gallery/remove", {
        projectId,
        imageId,
        engineKey,
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
     REMOVE ALL (by dataItemId)
  ───────────────────────────── */
  removeAll: async (projectId, dataItemId, engineKey) => {
    if (!projectId || !dataItemId || !engineKey) {
      return {
        data: null,
        message: "Missing projectId, dataItemId, or engineKey.",
      };
    }

    try {
      const res = await api.post("/api/gallery/remove-all", {
        projectId,
        dataItemId,
        engineKey,
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