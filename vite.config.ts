import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: "esnext",
    minify: "esbuild",
    rollupOptions: {
      input: process.env.INPUT || path.resolve(__dirname, "ui/dashboard.html"),
      output: {
        manualChunks: undefined,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "ui/src"),
    },
  },
});