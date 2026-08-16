import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import https from "https";

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

                  const requestBody = JSON.stringify({
                    model: data.model || "claude-sonnet-5",
                    max_tokens: data.max_tokens || 1024,
                    messages: data.messages || [],
                  });

                  const options = {
                    hostname: "api.anthropic.com",
                    port: 443,
                    path: "/v1/messages",
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Content-Length": Buffer.byteLength(requestBody),
                      "anthropic-version": "2023-06-01",
                    },
                    agent: new https.Agent({
                      rejectUnauthorized: false, // Trust custom CA
                    }),
                  };

                  const apiReq = https.request(options, (apiRes) => {
                    let responseBody = "";
                    apiRes.on("data", (chunk) => {
                      responseBody += chunk;
                    });
                    apiRes.on("end", () => {
                      try {
                        const apiResponse = JSON.parse(responseBody);
                        res.setHeader("Content-Type", "application/json");
                        res.statusCode = 200;
                        res.end(JSON.stringify(apiResponse));
                      } catch (e) {
                        res.statusCode = 500;
                        res.end(
                          JSON.stringify({ error: "Failed to parse API response" })
                        );
                      }
                    });
                  });

                  apiReq.on("error", (error) => {
                    res.statusCode = 500;
                    res.end(
                      JSON.stringify({
                        error: error instanceof Error ? error.message : "Request failed",
                      })
                    );
                  });

                  apiReq.write(requestBody);
                  apiReq.end();
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
