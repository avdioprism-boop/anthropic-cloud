/**
 * FLAWED Relay - Stateless Claude API relay using desktop Claude app
 * Connects to local claude CLI to use desktop credits
 */

const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const { existsSync } = require("fs");

// Map friendly names to actual models and their positions on the spectrum
// Position: 0 = Haiku (green), 1 = Opus (red)
const MODEL_SPECTRUM = {
  "claude-haiku-4-5-20241022": { actual: "claude-haiku-4-5-20241022", position: 0 },
  "claude-sonnet-5": { actual: "claude-sonnet-5", position: 0.5 },
  "claude-opus-5": { actual: "claude-opus-5", position: 1 },
};

function resolveClaudeBinary() {
  const isWin = process.platform === "win32";
  const exe = isWin ? "claude.exe" : "claude";
  const candidates = isWin
    ? [
        path.join(process.env.APPDATA || "", "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", exe),
        path.join(process.env.ProgramFiles || "", "nodejs", "node_modules", "@anthropic-ai", "claude-code", "bin", exe),
        path.join(process.env.LOCALAPPDATA || "", "Programs", "claude", exe),
      ]
    : [
        "/usr/local/lib/node_modules/@anthropic-ai/claude-code/bin/claude",
        path.join(os.homedir(), ".npm-global/lib/node_modules/@anthropic-ai/claude-code/bin/claude"),
      ];

  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return "claude";
}

function runClaude(bin, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: os.tmpdir(),
      shell: bin === "claude" ? true : false,
      windowsHide: true,
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));

    child.stdin.on("error", () => {});
    child.stdin.end(input, "utf-8");
  });
}

function buildConversation(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return "Operator: hello";

  return messages
    .map((m) => {
      const speaker = m.role === "user" ? "Operator" : "Flawed";
      return speaker + ": " + m.content;
    })
    .join("\n\n");
}

function createRelayHandler(options = {}) {
  return async (req, res) => {
    if (req.method !== "POST" || req.url !== "/api/claude") {
      return false;
    }

    let body = "";
    req.setEncoding("utf-8");
    req.on("data", (chunk) => (body += chunk));

    return new Promise((resolve) => {
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body);
          const { messages, max_tokens = 2048, model = "claude-opus-5" } = payload;

          const modelInfo = MODEL_SPECTRUM[model] || MODEL_SPECTRUM["claude-opus-5"];
          const actualModel = modelInfo.actual;

          console.log(`[relay] ${model} (position: ${modelInfo.position}) - ${messages.length} messages`);

          const conversationContext = buildConversation(messages);
          const claudeBin = resolveClaudeBinary();
          const useShell = claudeBin === "claude";

          const args = [
            "-p",
            "--model", actualModel,
            "--system-prompt", payload.system_prompt || "You are Flawed, a helpful assistant.",
            "--strict-mcp-config",
            "--mcp-config", '{"mcpServers":{}}',
            "--no-session-persistence",
          ];

          const result = await runClaude(claudeBin, args, conversationContext);
          const text = result.stdout.trim();

          if (!text) {
            throw new Error(result.stderr.trim() || `Claude CLI exited with code ${result.code}`);
          }

          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              content: text,
              model: actualModel,
              model_position: modelInfo.position,
            })
          );

          resolve(true);
        } catch (error) {
          console.error("[relay] Error:", error.message);
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error.message }));
          resolve(true);
        }
      });
    });
  };
}

module.exports = { createRelayHandler };
