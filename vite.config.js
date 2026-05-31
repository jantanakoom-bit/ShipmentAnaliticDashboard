import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: "./src/test/setup.js",
    include: ["src/**/*.{test,spec}.{js,jsx}", "api/**/*.{test,spec}.{js,jsx}"],
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
