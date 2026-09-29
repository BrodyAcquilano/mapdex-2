// src/api/aiApi.js

import api from "./axios.js";

export const aiApi = {
  interpretCommand: async ({ capturedInput, availableCommands }) => {
    try {
      const res = await api.post("/api/ai/interpret-command", {
        capturedInput,
        availableCommands,
      });

      return {
        success: res.data?.success ?? true,
        data: res.data || null,
        message: res.data?.message || "",
      };
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to interpret command.";

      return {
        success: false,
        data: null,
        message,
      };
    }
  },
};