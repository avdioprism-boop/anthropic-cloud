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

                  // Build conversation context from message history
                  const conversationContext = data.messages
                    ?.map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
                    .join("\n\n") || "User: hello";

                  // System prompt to make Claude actually useful
                  const systemPrompt = `You are a helpful AI assistant. Provide clear, thoughtful, and accurate responses. Be conversational and friendly.`;

                  // Use claude CLI with system prompt and conversation context
                  const fullPrompt = `${systemPrompt}\n\n${conversationContext}`;

                  // Extract model or default to Mythos 5
                  const model = data.model || "claude-mythos-5";

                  const result = spawnSync("claude", [
                    "-p",
                    fullPrompt,
                    "--model",
                    model,
                  ], {
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
                      model: model,
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
