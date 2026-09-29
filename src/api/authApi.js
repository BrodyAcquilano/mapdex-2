import api from "./axios.js";

export const authApi = {
  /* ─────────────────────────────
     GET CURRENT USER
  ───────────────────────────── */
  me: async () => {
    try {
      const res = await api.get("/api/auth/me");

      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      return { data: null, message: "Not authenticated." };
    }
  },

  /* ─────────────────────────────
     LOGIN
  ───────────────────────────── */
  login: async (email, password) => {
    if (!email || !password) {
      return { data: null, message: "Missing email or password." };
    }

    try {
      const res = await api.post("/api/auth/login", {
        email,
        password,
      });

      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to login.";

      return { data: null, message };
    }
  },

  /* ─────────────────────────────
     LOGOUT
  ───────────────────────────── */
  logout: async () => {
    try {
      const res = await api.post("/api/auth/logout");

      return {
        data: true,
        message: res.data?.message || "Logged out.",
      };
    } catch (err) {
      return {
        data: false,
        message: "Failed to logout.",
      };
    }
  },

  /* ─────────────────────────────
     REGISTER
  ───────────────────────────── */
  register: async (email, password, userName) => {
    if (!email || !password || !userName) {
      return { data: null, message: "Missing email, password, or username." };
    }

    try {
      const res = await api.post("/api/auth/register", {
        email,
        password,
        userName,
      });

      return {
        data: res.data?.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Unable to register user.";

      return { data: null, message };
    }
  },

  /* ─────────────────────────────
     VERIFY EMAIL
  ───────────────────────────── */
  verifyEmail: async (token) => {
    if (!token) {
      return {
        success: false,
        message: "Verification failed. Please try again.",
      };
    }

    try {
      const encodedToken = encodeURIComponent(token);

      const res = await api.get(
        `/api/auth/verify-email?token=${encodedToken}`,
      );

      return {
        success: res.data?.success ?? true,
        message: res.data?.message || "Email verified.",
      };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Verification failed. Please try again.";

      return {
        success: false,
        message,
      };
    }
  },

  /* ─────────────────────────────
     REQUEST PASSWORD RESET
  ───────────────────────────── */
  requestPasswordReset: async (email) => {
    if (!email) {
      return { data: null, message: "Missing email." };
    }

    try {
      const res = await api.post("/api/auth/request-password-reset", {
        email,
      });

      return {
        data: res.data?.data || null,
        message:
          res.data?.message ||
          "If an account exists, a reset link has been sent.",
      };
    } catch (err) {
      const message =
        err.response?.data?.error ||
        "If an account exists, a reset link has been sent.";

      return { data: null, message };
    }
  },

  /* ─────────────────────────────
     VERIFY PASSWORD RESET TOKEN
  ───────────────────────────── */
  verifyPasswordResetToken: async (token) => {
    if (!token) {
      return { success: false, message: "Invalid reset link." };
    }

    try {
      const res = await api.post("/api/auth/verify-password-reset", {
        token,
      });

      return {
        success: res.data?.success ?? true,
        message: res.data?.message || "Token valid.",
      };
    } catch (err) {
      const message =
        err.response?.data?.message || "Invalid or expired reset link.";

      return {
        success: false,
        message,
      };
    }
  },

  /* ─────────────────────────────
     RESET PASSWORD
  ───────────────────────────── */
  resetPassword: async (token, password) => {
    if (!token || !password) {
      return {
        success: false,
        message: "Missing reset token or password.",
      };
    }

    try {
      const res = await api.post("/api/auth/reset-password", {
        token,
        password,
      });

      return {
        success: res.data?.success ?? true,
        message: res.data?.message || "Password reset successful.",
      };
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to reset password.";

      return {
        success: false,
        message,
      };
    }
  },
};