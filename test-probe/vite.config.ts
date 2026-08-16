import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { execSync } from "child_process";

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
                  const apiHandlerPath = path.join(__dirname, "api_handler.py");
                  const result = execSync(`python3 ${apiHandlerPath}`, {
                    input: body,
                    encoding: "utf-8",
                    stdio: ["pipe", "pipe", "inherit"],
                  });

                  const data = JSON.parse(result);
                  res.setHeader("Content-Type", "application/json");
                  res.statusCode = 200;
                  res.end(JSON.stringify(data));
                } catch (error) {
                  console.error("API Error:", error);
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
