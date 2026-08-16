import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { spawn } from "child_process";

let mcpProcess: any = null;

export default defineConfig({
  plugins: [
    react(),
    {
      name: "claude-api",
      configureServer(server) {
        // Start MCP server process
        mcpProcess = spawn("python3", [path.join(__dirname, "mcp_server.py")]);

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

                  // Send request to MCP server via stdin
                  const mcpRequest = JSON.stringify({
                    id: Date.now(),
                    method: "call_claude",
                    params: {
                      model: data.model || "claude-sonnet-5",
                      max_tokens: data.max_tokens || 1024,
                      messages: data.messages || [],
                    },
                  });

                  mcpProcess.stdin.write(mcpRequest + "\n");

                  // Wait for response
                  const handleOutput = (data: Buffer) => {
                    try {
                      const response = JSON.parse(data.toString());
                      if (response.result?.error) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: response.result.error }));
                      } else if (response.result?.content) {
                        res.setHeader("Content-Type", "application/json");
                        res.statusCode = 200;
                        res.end(
                          JSON.stringify({
                            content: [{ type: "text", text: response.result.content }],
                            model: response.result.model,
                          })
                        );
                      }
                      mcpProcess.stdout.removeListener("data", handleOutput);
                    } catch (e) {
                      // Wait for next line
                    }
                  };

                  mcpProcess.stdout.once("data", handleOutput);
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
