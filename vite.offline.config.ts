import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: process.env.YOL1_OFFLINE_OUT_DIR || ".offline-dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    minify: true,
    target: "es2020",
    lib: {
      entry: fileURLToPath(new URL("./src/offline/offline-entry.tsx", import.meta.url)),
      name: "YOL1Offline",
      formats: ["iife"],
      fileName: () => "yol1-offline.js",
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
  resolve: { alias: { "@": projectRoot } },
});

