// src/api/guestbookApi.js

import api from "./axios.js";

export const guestbookApi = {
  /* ─────────────────────────────
     GET ALL (by dataItemId)
  ───────────────────────────── */
  getAll: async (projectId, dataItemId, engineKey) => {
    if (!projectId || !dataItemId || !engineKey) {
      return {
        data: null,
        message: "Missing projectId, dataItemId, or engineKey.",
      };
    }

    try {
      const res = await api.post(`/api/guestbook/get/${dataItemId}`, {
        projectId,
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
     ADD ENTRY
  ───────────────────────────── */
  addEntry: async (projectId, dataItemId, engineKey, entry) => {
    if (!projectId || !dataItemId || !engineKey || !entry) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.post(`/api/guestbook/add-entry/${dataItemId}`, {
        projectId,
        engineKey,
        entry,
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
     UPDATE ENTRY
  ───────────────────────────── */
  updateEntry: async (
    projectId,
    dataItemId,
    engineKey,
    entryId,
    updates,
  ) => {
    if (!projectId || !dataItemId || !engineKey || !entryId || !updates) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put(
        `/api/guestbook/update-entry/${dataItemId}/${entryId}`,
        {
          projectId,
          engineKey,
          updates,
        },
      );

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
     TOGGLE MULTIPLE ENTRIES
  ───────────────────────────── */
  toggleEntries: async (
    projectId,
    dataItemId,
    engineKey,
    entryIds,
    status,
  ) => {
    if (
      !projectId ||
      !dataItemId ||
      !engineKey ||
      !Array.isArray(entryIds) ||
      !status
    ) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.put("/api/guestbook/toggle-entries", {
        projectId,
        dataItemId,
        engineKey,
        entryIds,
        status,
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
      const res = await api.post(`/api/guestbook/remove-all/${dataItemId}`, {
        projectId,
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