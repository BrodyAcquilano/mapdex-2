import api from "./axios.js";

export const neighbourhoodsApi = {
  /* ─────────────────────────────
     GET ALL
  ───────────────────────────── */
  getAll: async (projectId) => {
    if (!projectId) {
      return { data: [], message: "Missing projectId." };
    }

    try {
      const res = await api.post("/api/neighbourhoods/get", { projectId });

      return {
        data: res.data?.data || [],
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.error ||
        "Unable to reach server.";
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
      const res = await api.post(`/api/neighbourhoods/get/${_id}`, {
        projectId,
      });

      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.error ||
        "Unable to reach server.";
      return { data: null, message };
    }
  },

  /* ─────────────────────────────
     ADD ONE
  ───────────────────────────── */
add: async (projectId, schemaUpdatedAt, neighbourhood) => {
  if (!projectId || !schemaUpdatedAt || !neighbourhood) {
    return { data: null, message: "Missing data." };
  }

  try {
    const res = await api.post("/api/neighbourhoods/add", {
      projectId,
      schemaUpdatedAt,
      neighbourhood,
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
     ADD BATCH
  ───────────────────────────── */
  addBatch: async (projectId, neighbourhoods) => {
    if (
      !projectId ||
      !Array.isArray(neighbourhoods) ||
      neighbourhoods.length === 0
    ) {
      return { data: null, message: "Missing data." };
    }

    try {
      const res = await api.post("/api/neighbourhoods/add-batch", {
        projectId,
        neighbourhoods,
      });

      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.error ||
        "Unable to reach server.";
      return { data: null, message };
    }
  },

/* ─────────────────────────────
   UPDATE
───────────────────────────── */
update: async (projectId, schemaUpdatedAt, neighbourhood) => {
  if (!projectId || !schemaUpdatedAt || !neighbourhood?._id) {
    return { data: null, message: "Missing data." };
  }

  try {
    const res = await api.put(`/api/neighbourhoods/update/${neighbourhood._id}`, {
      projectId,
      schemaUpdatedAt,
      neighbourhood,
    });

    return {
      data: res.data || null,
      message: res.data?.message || "",
    };
  } catch (err) {
    const message =
      err.response?.data?.error ||
      "Unable to reach server.";
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
    const res = await api.delete(`/api/neighbourhoods/remove/${_id}`, {
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
    const message =
      err.response?.data?.error ||
      "Unable to reach server.";
    return { data: null, message };
  }
},

  /* ─────────────────────────────
   TOGGLE EXTENSIONS
───────────────────────────── */
toggleExtensions: async (projectId, schemaUpdatedAt, neighbourhood) => {
  if (
    !projectId ||
    !schemaUpdatedAt ||
    !neighbourhood?._id ||
    !neighbourhood?.updatedAt ||
    !neighbourhood?.extensions
  ) {
    return { data: null, message: "Missing data." };
  }

  try {
    const res = await api.put(
      `/api/neighbourhoods/toggle-extensions/${neighbourhood._id}`,
      {
        projectId,
        schemaUpdatedAt,
        extensions: neighbourhood.extensions,
        updatedAt: neighbourhood.updatedAt,
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