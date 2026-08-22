#!/usr/bin/env node
/**
 * FLAWED production server entry point.
 * Starts the HTTP server with dist bundle and API handler.
 */

const http = require("http");
const path = require("path");
const fs = require("fs");
const { createApiHandler } = require("./flawed-api.cjs");

const PORT = process.env.PORT || 5274;
const distDir = path.join(__dirname, "..", "dist");
const rootDir = process.env.FLAWED_ROOT || process.cwd();

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

console.log(`[FLAWED] Starting server...`);
console.log(`  distDir: ${distDir}`);
console.log(`  rootDir: ${rootDir}`);
console.log(`  port: ${PORT}`);

const api = createApiHandler({ rootDir });
const indexPath = path.join(distDir, "index.html");

function serveStatic(req, res) {
  let rel;
  try {
    rel = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch {
    rel = "/";
  }

  const target = path.normalize(path.join(distDir, rel));
  const inside = target === distDir || target.startsWith(distDir + path.sep);
  let file = inside && fs.existsSync(target) && fs.statSync(target).isFile() ? target : null;

  if (!file) file = indexPath;

  if (!fs.existsSync(file)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  const ext = path.extname(file).toLowerCase();
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
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

server.headersTimeout = 0;
server.requestTimeout = 0;
server.timeout = 0;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[FLAWED] Server running at http://0.0.0.0:${PORT}`);
});

server.on("error", (err) => {
  console.error(`[FLAWED] Server error:`, err);
  process.exit(1);
});
