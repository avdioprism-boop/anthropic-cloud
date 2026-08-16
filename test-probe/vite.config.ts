import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { spawnSync } from "child_process";

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
                  const data = JSON.parse(body);

                  // Extract the user's message from the messages array
                  const userMessage = data.messages
                    ?.find((m: any) => m.role === "user")
                    ?.content || "hello";

                  // Use claude CLI to call Claude directly
                  // The CLI has access to session auth in the Claude Code environment
                  const result = spawnSync("claude", ["-p", userMessage], {
                    encoding: "utf-8",
                    maxBuffer: 10 * 1024 * 1024,
                  });

                  if (result.error) {
                    throw result.error;
                  }

                  if (result.stderr) {
                    console.error("[Claude CLI Error]", result.stderr);
                    throw new Error(result.stderr);
                  }

                  const responseText = result.stdout.trim();

                  res.setHeader("Content-Type", "application/json");
                  res.statusCode = 200;
                  res.end(
                    JSON.stringify({
                      content: [{ type: "text", text: responseText }],
                      model: data.model || "claude-opus-5",
                    })
                  );
                } catch (error) {
                  console.error("[Claude API Error]", error);
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
