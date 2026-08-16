import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "claude-api",
      configureServer(server) {
        return () => {
          server.middlewares.use("/api/claude", async (req, res, next) => {
            if (req.method === "POST") {
              let body = "";
              req.on("data", (chunk) => {
                body += chunk;
              });
              req.on("end", async () => {
                try {
                  const response = await fetch(
                    "https://api.anthropic.com/v1/messages",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "anthropic-version": "2023-06-01",
                      },
                      body: body,
                    }
                  );
                  const data = await response.json();
                  res.setHeader("Content-Type", "application/json");
                  res.statusCode = response.status;
                  res.end(JSON.stringify(data));
                } catch (error) {
                  res.statusCode = 500;
                  res.end(
                    JSON.stringify({
                      error:
                        error instanceof Error ? error.message : "Unknown error",
                    })
                  );
                }
              });
            } else {
              next();
            }
          });
        };
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
