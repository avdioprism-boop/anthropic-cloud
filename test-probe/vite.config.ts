import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

                  // Extract model - default to no flag (uses Mythos 5 as configured)
                  const model = data.model || "default";

                  const args = ["-p", fullPrompt];

                  // Only add --model flag if not using default (default is Mythos 5)
                  if (model !== "default") {
                    args.push("--model", model);
                  }

                  const result = spawnSync("claude", args, {
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
