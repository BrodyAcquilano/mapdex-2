import api from "./axios.js";

export const accountsApi = {
  /* ─────────────────────────────
     GET USER
  ───────────────────────────── */
  getUser: async () => {
    try {
      const res = await api.get("/api/accounts/user");

      return {
        success: res.data?.success ?? true,
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to load user.";

      return {
        success: false,
        data: null,
        message,
      };
    }
  },

  /* ─────────────────────────────
     CHANGE USERNAME (Authenticated)
  ───────────────────────────── */
  changeUserName: async (newUserName) => {
    if (!newUserName) {
      return {
        success: false,
        message: "Missing new username.",
      };
    }

    try {
      const res = await api.post("/api/accounts/change-username", {
        newUserName,
      });

      return {
        success: res.data?.success ?? true,
        message: res.data?.message || "Username updated successfully.",
      };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to update username.";

      return {
        success: false,
        message,
      };
    }
  },

  /* ─────────────────────────────
     CHANGE PASSWORD (Authenticated)
  ───────────────────────────── */
  changePassword: async (currentPassword, newPassword) => {
    if (!currentPassword || !newPassword) {
      return {
        success: false,
        message: "Missing current or new password.",
      };
    }

    try {
      const res = await api.post("/api/accounts/change-password", {
        currentPassword,
        newPassword,
      });

      return {
        success: res.data?.success ?? true,
        message: res.data?.message || "Password updated successfully.",
      };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to update password.";

      return {
        success: false,
        message,
      };
    }
  },

    /* ─────────────────────────────
     CHANGE USER COLOR THEME (Authenticated)
  ───────────────────────────── */
  changeUserColorTheme: async (userColorTheme) => {
    if (!userColorTheme) {
      return {
        success: false,
        message: "Missing user color theme.",
      };
    }

    try {
      const res = await api.post("/api/accounts/change-user-color-theme", {
        userColorTheme,
      });

      return {
        success: res.data?.success ?? true,
        data: res.data?.data || null,
        message: res.data?.message || "User color theme updated successfully.",
      };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to update user color theme.";

      return {
        success: false,
        data: null,
        message,
      };
    }
  },

  /* ─────────────────────────────
     DELETE ACCOUNT
  ───────────────────────────── */
  deleteAccount: async () => {
    try {
      const res = await api.delete("/api/accounts/delete-account");

      return {
        success: res.data?.success ?? true,
        message: res.data?.message || "Account deleted successfully.",
      };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to delete account.";

      return {
        success: false,
        message,
      };
    }
  },
};