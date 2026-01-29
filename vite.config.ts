import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Deduplicate modules to prevent multiple instances of React Router
    dedupe: ["react", "react-dom", "react-router-dom", "@capacitor/core"],
  },
  optimizeDeps: {
    // Include Capacitor packages in optimization to prevent issues
    include: ["@capacitor/core", "@capacitor/browser", "@capacitor/camera"],
  },
}));
