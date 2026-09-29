// src/api/usersApi.js

import api from "./axios.js";

export const usersApi = {
  /* ─────────────────────────────
     SEARCH USERS
  ───────────────────────────── */
  searchUsers: async (username = "", page = 1) => {
    try {
      const params = new URLSearchParams();
      if (username.trim()) params.set("username", username.trim());
      params.set("page", String(page));

      const res = await api.get(`/api/users/search?${params.toString()}`);

      return {
        data: res.data?.data || { users: [], total: 0, page: 1, pageSize: 50 },
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return {
        data: { users: [], total: 0, page: 1, pageSize: 50 },
        message,
      };
    }
  },

  /* ─────────────────────────────
     GET USER PROFILE
  ───────────────────────────── */
  getUserProfile: async (userName) => {
    if (!userName) {
      return { data: null, message: "Missing userName." };
    }

    try {
      const res = await api.get(
        `/api/users/profile/${encodeURIComponent(userName)}`,
      );

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
     GET USER PROJECTS (visible to me)
  ───────────────────────────── */
  getUserProjects: async (userName) => {
    if (!userName) {
      return { data: [], message: "Missing userName." };
    }

    try {
      const res = await api.get(
        `/api/users/profile/${encodeURIComponent(userName)}/projects`,
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
     FAVOURITE PROJECTS
  ───────────────────────────── */
  getFavouriteProjects: async () => {
    try {
      const res = await api.get("/api/users/favourites");
      return {
        data: res.data?.data || [],
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { data: [], message };
    }
  },

  getUserFavouriteProjects: async (userName) => {
    if (!userName) return { data: [], message: "Missing userName." };

    try {
      const res = await api.get(
        `/api/users/profile/${encodeURIComponent(userName)}/favourites`,
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

  addFavouriteProject: async (projectId) => {
    if (!projectId) return { data: null, message: "Missing projectId." };

    try {
      const res = await api.post("/api/users/favourites/add", { projectId });
      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  removeFavouriteProject: async (projectId) => {
    if (!projectId) return { message: "Missing projectId." };

    try {
      const res = await api.post("/api/users/favourites/remove", { projectId });
      return { message: res.data?.message || "" };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { message };
    }
  },

  /* ─────────────────────────────
     FOLLOW / UNFOLLOW / REMOVE FOLLOWER
  ───────────────────────────── */
  followUser: async (userName) => {
    if (!userName) return { data: null, message: "Missing userName." };

    try {
      const res = await api.post("/api/users/follow", { userName });
      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { data: null, message };
    }
  },

  unfollowUser: async (userName) => {
    if (!userName) return { message: "Missing userName." };

    try {
      const res = await api.post("/api/users/unfollow", { userName });
      return { message: res.data?.message || "" };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { message };
    }
  },

  removeFollower: async (userName) => {
    if (!userName) return { message: "Missing userName." };

    try {
      const res = await api.post("/api/users/remove-follower", { userName });
      return { message: res.data?.message || "" };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { message };
    }
  },

  /* ─────────────────────────────
     BLOCK / UNBLOCK
  ───────────────────────────── */
  blockUser: async (userName) => {
    if (!userName) return { message: "Missing userName." };

    try {
      const res = await api.post("/api/users/block", { userName });
      return { message: res.data?.message || "" };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { message };
    }
  },

  unblockUser: async (userName) => {
    if (!userName) return { message: "Missing userName." };

    try {
      const res = await api.post("/api/users/unblock", { userName });
      return { message: res.data?.message || "" };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to reach server.";
      return { message };
    }
  },
};
