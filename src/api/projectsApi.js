// src/api/projectsApi.js

import api from "./axios.js";

export const projectsApi = {
  /* ─────────────────────────────
     GET ALL PROJECTS
  ───────────────────────────── */
  getProjects: async () => {
    try {
      const res = await api.get("/api/projects/get");

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
   GET PUBLIC PROJECTS
───────────────────────────── */
  getPublicProjects: async (filters = {}) => {
    try {
      const params = new URLSearchParams();

      if (filters.engineKey?.length) {
        params.set("engineKey", filters.engineKey.join(","));
      }
      if (filters.visibility?.length) {
        params.set("visibility", filters.visibility.join(","));
      }
      if (filters.geometryTypes?.length) {
        params.set("geometryTypes", filters.geometryTypes.join(","));
      }
      if (filters.geometryMode) {
        params.set("geometryMode", filters.geometryMode);
      }
      if (filters.name?.trim()) {
        params.set("name", filters.name.trim());
      }
      if (filters.tags?.length) {
        params.set("tags", filters.tags.join(","));
      }
      if (filters.updatedAtFrom) {
        params.set("updatedAtFrom", filters.updatedAtFrom);
      }
      if (filters.updatedAtTo) {
        params.set("updatedAtTo", filters.updatedAtTo);
      }

      const queryString = params.toString();

      const res = await api.get(
        `/api/projects/public${queryString ? `?${queryString}` : ""}`,
      );

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
   GET SHARED PROJECTS
───────────────────────────── */
  getSharedProjects: async () => {
    try {
      const res = await api.get("/api/projects/shared");

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
     GET ONE PROJECT
  ───────────────────────────── */
  getProject: async (_id) => {
    if (!_id) {
      return { data: null, message: "Missing _id." };
    }

    try {
      const res = await api.get(`/api/projects/get/${_id}`);

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
  add: async (project) => {
    if (!project) {
      return { data: null, message: "Missing project data." };
    }

    try {
      const res = await api.post("/api/projects/add", project);

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
   CLONE
───────────────────────────── */
  clone: async (_id) => {
    if (!_id) {
      return { data: null, message: "Missing _id." };
    }

    try {
      const res = await api.post(`/api/projects/clone/${_id}`);

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
     EXPORT
  ───────────────────────────── */
  export: async (_id) => {
    if (!_id) {
      return { data: null, message: "Missing _id." };
    }

    try {
      const res = await api.get(`/api/projects/export/${_id}`, {
        responseType: "blob",
      });

      return {
        data: res.data || null,
        message: "Project exported.",
      };
    } catch (err) {
      let message = "Unable to reach server.";

      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          message = parsed?.error || message;
        } catch {
          message = "Export failed.";
        }
      } else {
        message = err.response?.data?.error || "Unable to reach server.";
      }

      return { data: null, message };
    }
  },


 /* ─────────────────────────────
   UPDATE
───────────────────────────── */
update: async (project) => {
  const _id = project?._id;
  const configUpdatedAt = project?.configUpdatedAt;

  if (!_id || !project || !configUpdatedAt) {
    return {
      data: null,
      message: "Missing _id or configUpdatedAt.",
    };
  }

  try {
    const res = await api.put(`/api/projects/update/${_id}`, {
      project,
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
     REMOVE
  ───────────────────────────── */
  remove: async (_id) => {
    if (!_id) {
      return { data: null, message: "Missing _id." };
    }

    try {
      const res = await api.delete(`/api/projects/remove/${_id}`);

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
   UPDATE VISIBILITY
───────────────────────────── */
updateVisibility: async (_id, visibility, configUpdatedAt) => {
  if (!_id || !visibility || !configUpdatedAt) {
    return {
      data: null,
      message: "Missing _id, visibility, or configUpdatedAt.",
    };
  }

  try {
    const res = await api.patch(`/api/projects/visibility/${_id}`, {
      visibility,
      configUpdatedAt,
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
   Update Project Settings (name, description, tags)
───────────────────────────── */
updateProjectSettings: async (
  _id,
  projectName,
  projectDescription,
  projectTags,
  configUpdatedAt,
) => {
  if (
    !_id ||
    typeof projectName !== "string" ||
    typeof projectDescription !== "string" ||
    !Array.isArray(projectTags) ||
    !configUpdatedAt
  ) {
    return {
      data: null,
      message: "Missing project settings fields.",
    };
  }

  try {
    const res = await api.patch(`/api/projects/settings/${_id}`, {
      projectName,
      projectDescription,
      projectTags,
      configUpdatedAt,
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
   ADD PROJECT ROLE
───────────────────────────── */
addProjectRole: async (_id, role, userName, configUpdatedAt) => {
  const normalizedUserName = String(userName || "").trim();

  if (!_id || !role || !normalizedUserName || !configUpdatedAt) {
    return {
      data: null,
      message: "Missing _id, role, username, or configUpdatedAt.",
    };
  }

  try {
    const res = await api.patch(`/api/projects/roles/add/${_id}`, {
      role,
      userName: normalizedUserName,
      configUpdatedAt,
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
   REMOVE PROJECT ROLE
───────────────────────────── */
removeProjectRole: async (_id, role, roleUser, configUpdatedAt) => {
  const userName = String(roleUser?.userName || "").trim();

  if (!_id || !role || !userName || !configUpdatedAt) {
    return {
      data: null,
      message: "Missing _id, role, username, or configUpdatedAt.",
    };
  }

  try {
    const res = await api.patch(`/api/projects/roles/remove/${_id}`, {
      role,
      userName,
      configUpdatedAt,
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
