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
                  const data = JSON.parse(body);
                  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

                  const payload = {
                    model: data.model || "claude-opus-5",
                    max_tokens: data.max_tokens || 1024,
                    messages: data.messages || [],
                  };

                  // Make request through proxy - send empty x-api-key so proxy injects real one
                  const response = await fetch(`${baseUrl}/v1/messages`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "anthropic-version": "2023-06-01",
                      "x-api-key": "", // Empty key triggers proxy injection
                    },
                    body: JSON.stringify(payload),
                  });

                  const apiResponse = await response.json();

                  if (!response.ok) {
                    res.statusCode = response.status;
                    res.end(JSON.stringify({ error: apiResponse.error }));
                  } else if (apiResponse.content?.length > 0) {
                    res.setHeader("Content-Type", "application/json");
                    res.statusCode = 200;
                    res.end(
                      JSON.stringify({
                        content: [{ type: "text", text: apiResponse.content[0].text }],
                        model: apiResponse.model,
                      })
                    );
                  } else {
                    throw new Error(`Unexpected response: ${JSON.stringify(apiResponse)}`);
                  }
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
