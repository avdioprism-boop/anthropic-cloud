import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_PATH = path.resolve(__dirname, "claude-chat.config.json");

const CONFIG_DEFAULTS = {
  defaultModel: "claude-opus-5",
  models: [
    { id: "claude-opus-5", name: "Opus 5 (Default - Most Capable)" },
    { id: "claude-sonnet-5", name: "Sonnet 5 (Balanced)" },
    { id: "claude-haiku-4-5", name: "Haiku 4.5 (Fast)" },
  ],
  systemPrompt:
    "You are a helpful AI assistant. Provide clear, thoughtful, and accurate responses. Be conversational and friendly.",
  reasoning: {
    enabledByDefault: true,
    instruction:
      "Respond in exactly this format, with no text outside the tags:\n<reasoning>\nWork through the problem step by step here.\n</reasoning>\n<answer>\nYour final response to the user here.\n</answer>",
  },
  maxTokens: 2048,
};

// Read on every request so edits to the config apply without a restart. A
// malformed file falls back to defaults rather than taking the server down.
function loadConfig() {
  try {
    return { ...CONFIG_DEFAULTS, ...JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) };
  } catch (error) {
    console.error("[claude-chat] Could not read config, using defaults:", error);
    return CONFIG_DEFAULTS;
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "claude-api",
      configureServer(server) {
        // Registered before Vite's internal middlewares — its HTML fallback
        // would otherwise answer this GET with index.html.
        server.middlewares.use("/api/config", (req, res, next) => {
          if (req.method !== "GET") return next();
          const config = loadConfig();
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              models: config.models,
              defaultModel: config.defaultModel,
              reasoningEnabledByDefault: config.reasoning.enabledByDefault,
            })
          );
        });

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

                  const config = loadConfig();

                  // When reasoning is on, append the format instruction that asks
                  // the model to write out its steps. Note: this is the model
                  // reasoning on the page, not its internal thinking chain (which
                  // the API returns encrypted and unreadable).
                  const showReasoning =
                    data.reasoning ?? config.reasoning.enabledByDefault;
                  const systemPrompt = showReasoning
                    ? `${config.systemPrompt}\n\n${config.reasoning.instruction}`
                    : config.systemPrompt;

                  // Use claude CLI with system prompt and conversation context
                  const fullPrompt = `${systemPrompt}\n\n${conversationContext}`;

                  const model = data.model || config.defaultModel;

                  const args = ["-p", fullPrompt, "--model", model];

                  const result = spawnSync("claude", args, {
                    encoding: "utf-8",
                    maxBuffer: 10 * 1024 * 1024,
                    input: "",
                  });

                  if (result.error) {
                    throw result.error;
                  }

                  if (result.stderr) {
                    console.error("[Claude CLI Error]", result.stderr);
                    throw new Error(result.stderr);
                  }

                  const raw = result.stdout.trim();

                  // Split the reasoning and answer sections apart. If the model
                  // did not use the tags, fall back to showing the whole reply.
                  const reasoningMatch = raw.match(
                    /<reasoning>([\s\S]*?)<\/reasoning>/
                  );
                  const answerMatch = raw.match(/<answer>([\s\S]*?)<\/answer>/);

                  const reasoning = reasoningMatch
                    ? reasoningMatch[1].trim()
                    : null;
                  const responseText = answerMatch
                    ? answerMatch[1].trim()
                    : raw.replace(/<\/?(reasoning|answer)>/g, "").trim();

                  res.setHeader("Content-Type", "application/json");
                  res.statusCode = 200;
                  res.end(
                    JSON.stringify({
                      content: [{ type: "text", text: responseText }],
                      reasoning: reasoning,
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
