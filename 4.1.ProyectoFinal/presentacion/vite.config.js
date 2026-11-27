import { defineConfig } from "vite";
import { resolve } from "node:path";

// Relative base: the build works at any path (GitHub Pages serves it under /<repo>/).
// Two pages: the presentation and the presenter script (guion.html).
export default defineConfig({
  base: "./",
  build: {
    chunkSizeWarningLimit: 4500,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        guion: resolve(import.meta.dirname, "guion.html"),
      },
    },
  },
});
