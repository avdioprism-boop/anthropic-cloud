# Claude Chat

A web chat interface for Claude with a model picker, visible reasoning, and a
config file you can edit without touching code.

---

## Running it on your own machine

This app has **no API key and no server dependency of its own**. It shells out
to the `claude` CLI, which uses whatever account you're already logged into.
That means it runs anywhere Claude Code runs — your laptop included.

**1. Install Claude Code and log in**

Get it from <https://claude.com/claude-code>, then run `claude` once and sign
in. Verify it works:

```bash
claude -p "say hi"
```

If that prints a reply, you're set. Everything else below depends only on this.

**2. Get the code and its dependencies**

```bash
git clone https://github.com/flawed-it/anthropic-cloud.git
cd anthropic-cloud/test-probe
npm install       # or: pnpm install
```

**3. Start it**

```bash
./launch.sh
```

Then open <http://localhost:5173/>.

On Windows, use WSL for `launch.sh`, or run `npm run dev` directly from
PowerShell — the launcher is a convenience, not a requirement.

### Why no API key?

Requests go: **browser → local Vite server → `claude` CLI → Anthropic**. The
Vite dev server exposes a small `/api/claude` endpoint that spawns the CLI. The
CLI already holds your credentials, so the app never sees or stores a key.

The tradeoff: the CLI must be installed and logged in on whatever machine runs
the server. Usage bills to that account.

---

## Configuration

Edit **`claude-chat.config.json`**. The server re-reads it on every request, so
changes take effect on your next message — no restart needed.

```json
{
  "defaultModel": "claude-opus-5",
  "models": [
    { "id": "claude-opus-5",   "name": "Opus 5 (Default - Most Capable)" },
    { "id": "claude-sonnet-5", "name": "Sonnet 5 (Balanced)" },
    { "id": "claude-haiku-4-5", "name": "Haiku 4.5 (Fast)" }
  ],
  "systemPrompt": "You are a helpful AI assistant...",
  "reasoning": {
    "enabledByDefault": true,
    "instruction": "Respond in exactly this format..."
  },
  "maxTokens": 2048
}
```

| Field | What it does |
|---|---|
| `defaultModel` | Model selected when the page loads |
| `models` | Populates the dropdown. Add or remove entries freely |
| `systemPrompt` | The persona/instructions sent with every message |
| `reasoning.enabledByDefault` | Initial state of the Reasoning checkbox |
| `reasoning.instruction` | The format the model is asked to follow when reasoning is on |
| `maxTokens` | Response length ceiling |

A malformed file falls back to built-in defaults and logs the error rather than
crashing the server.

To add a model, add its ID to `models` — anything your account can reach via
`claude --model <id>` will work. Verify first:

```bash
claude -p "hello" --model some-model-id
```

---

## Reasoning

Toggle **Reasoning** in the header. When on, each reply gets a collapsible
*Show reasoning* panel with the model's step-by-step working.

**An honest caveat about what this is.** Claude's internal thinking chain comes
back from the API *encrypted* — a signature with no readable content. It cannot
be displayed by this app or any other. What you see here is the model writing
its reasoning out explicitly in the response, because the system prompt asks it
to. That's genuine and usually reflects its actual approach, but it is
self-reported, not the hidden chain.

Turning reasoning off skips the format instruction entirely and makes replies
slightly faster.

---

## Launcher

```bash
./launch.sh          # start (detached — survives closing the terminal)
./launch.sh stop     # stop
./launch.sh status   # what's running
./launch.sh logs     # tail the log
```

Start brings Tailscale up first if it's installed, then starts the server with
`setsid` so it doesn't die when the shell exits. Logs go to
`.claude-chat.log`.

---

## Access over Tailscale

If both machines are on the same tailnet, reach the app at your host's
Tailscale IP:

```
http://<tailscale-ip>:5173/
```

`./launch.sh status` prints the current IP. The server binds `0.0.0.0`, so it
listens on every interface.

---

## API Scope Notes

The Claude Chat app shells out to the `claude` CLI for authentication. GitHub API calls from Claude Code sessions are restricted to repository-scoped endpoints (`repos/{owner}/{repo}/...`). User-level endpoints like follow are not available due to session-level architectural constraints.

---

## Troubleshooting

**"the 'claude' CLI is not installed"** — Install Claude Code and run `claude`
once to log in.

**Page loads but messages error** — Check `./launch.sh logs`. Usually the CLI
isn't authenticated; confirm with `claude -p "hi"`.

**Can't reach it over Tailscale** — Run `./launch.sh status`. If Tailscale is
down, `sudo tailscaled --state=/var/lib/tailscale/tailscaled.state &` then
`tailscale up`.

**Port 5173 in use** — Vite silently shifts to 5174 and the URL you had stops
working. `./launch.sh stop` clears stale servers; the startup output always
shows the real port.

**A model errors** — Your account may not have access to it. Test with
`claude -p "hi" --model <id>` and remove it from `models` if unavailable.

---

## Layout

```
test-probe/
├── claude-chat.config.json      ← edit this
├── launch.sh
├── vite.config.ts               ← /api/claude + /api/config endpoints
└── src/
    ├── App.tsx
    ├── lib/api.ts               ← client, config fetch
    └── components/
        └── ChatInterface.tsx    ← UI, reasoning panel
```

Stack: React 19, TypeScript, Vite 8, Tailwind, shadcn/ui.
