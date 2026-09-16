import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        wireguard: resolve(import.meta.dirname, "wg.html"),
        horloge: resolve(import.meta.dirname, "horloge.html"),
        aPropos: resolve(import.meta.dirname, "HTML/A-Propos.html"),
        matthieu: resolve(import.meta.dirname, "HTML/Matthieu.html")
      }
    }
  }
});
