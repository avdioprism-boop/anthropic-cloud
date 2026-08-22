/**
 * Production HTTP host for FLAWED.
 *
 * In dev, Vite serves the renderer and mounts the API as middleware. In the
 * packaged app there is no Vite, so this does both jobs: the API handler gets
 * first refusal on every request, and anything it declines is served as a
 * static file out of the built dist/ bundle.
 *
 * Bound to 127.0.0.1 so the surface stays off the local network, on a fixed
 * port so the renderer's localStorage survives a restart (see the comment on
 * PREFERRED_PORT - this is not the arbitrary choice it looks like).
 */

const http = require("http");
const path = require("path");
const fs = require("fs");
const { createApiHandler } = require("./flawed-api.cjs");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json; charset=utf-8",
};

/**
 * @param {object} options
 * @param {string} options.distDir  built renderer bundle
 * @param {string} options.rootDir  writable dir for skills/ and config
 * @param {string} [options.seedFrom]
 * @returns {Promise<{server: import("http").Server, port: number, url: string}>}
 */
function startServer(options) {
  const distDir = options.distDir;
  const api = createApiHandler({
    rootDir: options.rootDir,
    seedFrom: options.seedFrom,
  });

  const indexPath = path.join(distDir, "index.html");

  function serveStatic(req, res) {
    // decodeURIComponent so a hashed asset with escaped characters resolves,
    // then normalise and re-root under distDir. Without the prefix check a
    // request for /../../ walks straight out of the bundle.
    let rel;
    try {
      rel = decodeURIComponent((req.url || "/").split("?")[0]);
    } catch {
      rel = "/";
    }

    const target = path.normalize(path.join(distDir, rel));
    const inside = target === distDir || target.startsWith(distDir + path.sep);

    let file = inside && fs.existsSync(target) && fs.statSync(target).isFile() ? target : null;

    // SPA fallback: any unknown path renders the app shell rather than 404,
    // so client-side routing and a hard reload behave the same.
    if (!file) file = indexPath;

    if (!fs.existsSync(file)) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const ext = path.extname(file).toLowerCase();
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");

    // Hashed assets are immutable; index.html must never be cached or a
    // rebuilt app keeps booting the previous bundle from disk cache.
    res.setHeader(
      "Cache-Control",
      file === indexPath ? "no-store" : "public, max-age=31536000, immutable"
    );

    fs.createReadStream(file)
      .on("error", () => {
        res.statusCode = 500;
        res.end("Read error");
      })
      .pipe(res);
  }

  const server = http.createServer((req, res) => {
    api(req, res)
      .then((handled) => {
        if (!handled) serveStatic(req, res);
      })
      .catch((error) => {
        console.error("[flawed] Request failed:", error);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Internal error");
        }
      });
  });

  // The model can take minutes on a long prompt. Node's default 2-minute
  // headers/request timeouts would kill the socket mid-answer and surface as
  // a bare network error in the UI.
  server.headersTimeout = 0;
  server.requestTimeout = 0;
  server.timeout = 0;

  // A deterministic port, not an OS-assigned one.
  //
  // The renderer keeps conversations, theme, and the active skill set in
  // localStorage, which browsers partition by *origin* - scheme, host, and
  // port. An ephemeral port means a new origin on every launch, so the app
  // would come up with an empty sidebar and the default theme every single
  // time, and the old data would sit there forever, unreachable, under a port
  // number that will never be issued again.
  //
  // So: try PREFERRED_PORT first and walk upward only if something else holds
  // it. Combined with the single-instance lock in electron-main.cjs, the first
  // port is the one in use essentially always.
  const PREFERRED_PORT = options.port || 5274;
  const MAX_ATTEMPTS = 12;

  return new Promise((resolve, reject) => {
    let attempt = 0;

    const listen = () => {
      const port = PREFERRED_PORT + attempt;

      const onError = (err) => {
        if (err.code === "EADDRINUSE" && attempt < MAX_ATTEMPTS - 1) {
          attempt++;
          console.warn(
            "[flawed] Port " + port + " is taken, trying " + (PREFERRED_PORT + attempt)
          );
          server.removeListener("error", onError);
          listen();
          return;
        }
        reject(err);
      };

      server.once("error", onError);
      server.listen(port, "0.0.0.0", () => {
        server.removeListener("error", onError);
        if (attempt > 0) {
          console.warn(
            "[flawed] Serving on fallback port " + port + " - stored conversations " +
              "and theme live under port " + PREFERRED_PORT + " and will not be visible."
          );
        }
        resolve({ server, port, url: "http://0.0.0.0:" + port });
      });
    };

    listen();
  });
}

module.exports = { startServer };
