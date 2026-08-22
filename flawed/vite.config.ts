import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import { createRequire } from "module";

// The API used to live in this file as ~600 lines of dev-server middleware,
// which is why the packaged .exe had to boot Vite behind itself just to answer
// /api/claude. It now lives in server/flawed-api.cjs and is shared verbatim
// with electron-main.cjs, so dev and production run the same code path.
//
// createRequire because this config is ESM and the API core is CommonJS - the
// Electron main process cannot consume ESM, and duplicating it for two module
// systems is exactly the drift this refactor was meant to end.
const require = createRequire(import.meta.url);
const { createApiHandler } = require("./server/flawed-api.cjs") as {
  createApiHandler: (options: { rootDir: string }) => (req: unknown, res: unknown) => Promise<boolean>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: "flawed-api",
      configureServer(server) {
        // In dev the repo itself is the writable root, so skills/ and
        // claude-chat.config.json stay next to the source and stay editable
        // with an ordinary text editor.
        const api = createApiHandler({ rootDir: __dirname });

        // Registered before Vite's internal middlewares. Its HTML fallback
        // would otherwise answer these GETs with index.html.
        server.middlewares.use((req, res, next) => {
          api(req, res)
            .then((handled) => {
              if (!handled) next();
            })
            .catch((error: unknown) => {
              console.error("[flawed] API middleware failed:", error);
              next();
            });
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Relative asset URLs. The packaged app is served from a loopback origin on
  // an arbitrary port; absolute "/assets/..." paths would still resolve there,
  // but relative ones also survive the bundle being opened straight off disk,
  // which is the first thing anyone tries when a build looks broken.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    // Not 5173. That port is Vite's default, so every other Vite project on the
    // machine wants it too - and Vite's default behaviour on a collision is to
    // silently move to the next free port. electron-main.cjs then points its
    // window at 5173 and renders whatever unrelated app got there first, which
    // looks exactly like FLAWED being broken. strictPort makes a collision an
    // immediate, loud startup error instead. Keep this in sync with DEV_PORT in
    // electron-main.cjs.
    port: 5273,
    strictPort: true,
  },
});
