import path from "path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Rename the output HTML from standalone.html → index.html so the main
 * build can import it at a stable path.
 */
function renameHtml(): Plugin {
  return {
    name: "rename-standalone-html",
    enforce: "post",
    generateBundle(_, bundle) {
      if (bundle["standalone.html"]) {
        bundle["standalone.html"].fileName = "index.html";
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), renameHtml()],

  // Don't copy the public directory into the standalone output
  publicDir: false,

  resolve: {
    alias: [
      // Replace the .NET WASM backend with a type-only shim
      { find: "backend", replacement: path.resolve(__dirname, "src/standalone/backend-shim.ts") },

      // Replace the WASM loader with a no-op shim.
      // Runner.tsx imports from "../utility/loadBackend" — we intercept any
      // resolved path ending in /utility/loadBackend so the real module
      // (which imports the .NET runtime) is never loaded.
      { find: /^.*\/utility\/loadBackend$/, replacement: path.resolve(__dirname, "src/standalone/loadBackend-shim.ts") },
    ],
  },

  build: {
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
    outDir: path.resolve(__dirname, "src/standalone-runner"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "standalone.html"),
    },
  },
});
