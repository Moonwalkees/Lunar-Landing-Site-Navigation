import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The classic UI (and its Plotly charts) is only imported once someone switches to it, so Vite's
  // dev server would otherwise discover these late and serve them as "outdated" (504, blank page).
  // Pre-bundling them at startup keeps the CLASSIC VIEW switch working in dev.
  optimizeDeps: {
    include: ["plotly.js", "react-plotly.js/factory"],
  },
});
