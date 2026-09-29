import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  optimizeDeps: {
    exclude: ["mapbox-gl"],
  },

  worker: {
    format: "es",
  },

  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },

  build: {
    minify: "esbuild",
    sourcemap: process.env.NODE_ENV !== "production",
  },
});