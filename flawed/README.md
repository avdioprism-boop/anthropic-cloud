# FLAWED

A local chat front-end for Claude. Model picker, visible reasoning, file
attachments, saved conversations, reusable **skills**, and eight themes.

Runs as an Electron desktop app or in a plain browser tab — same code either way.

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
npm install       # or: pnpm install
```

**3. Start it**

```bash
npm run dev           # browser at http://localhost:5173/
npm run dev:electron  # desktop window (starts Vite for you)
```

`./launch.sh` also works and detaches the server so it survives closing the
terminal. On Windows use WSL for it, or just run `npm run dev`.

### Why no API key?

Requests go: **browser → local Vite server → `claude` CLI → Anthropic**. The
Vite dev server exposes a small `/api/claude` endpoint that spawns the CLI. The
CLI already holds your credentials, so the app never sees or stores a key.

The tradeoff: the CLI must be installed and logged in on whatever machine runs
the server. Usage bills to that account.

---

## Skills

A **skill** is a named block of instructions you can switch on and off. While
it's on, it's spliced into the system prompt of every message in that
conversation — so "review my code like a senior engineer" stops being something
you retype and becomes a toggle.

Open them with **Ctrl+K**, the ✨ button in the header, or the ✨ in the
composer for a quick on/off list. Active skills show as pills above the input
and as tags on the replies they shaped.

### On disk

Each skill is a folder:

```
skills/
├── code-reviewer/SKILL.md
├── explain-simply/SKILL.md
├── brutal-editor/SKILL.md
└── socratic/SKILL.md
```

And `SKILL.md` is frontmatter plus markdown:

```markdown
---
name: Code Reviewer
description: Reviews code for correctness bugs, edge cases, and cleanup.
icon: ⌗
---

When the user shares code, review it like a senior engineer who has to
maintain it.

**Order findings by severity, worst first.** For each one give:

1. The exact location — file and line, or the function name.
2. A concrete failure scenario.
3. The fix, as a diff or a replacement snippet.
```

This is deliberately **the same format Claude Code itself uses**, so a skill
written here can be dropped into `~/.claude/skills/` unchanged, and vice versa.

You can edit skills in the UI or in your editor — the panel's refresh button
re-reads the folder. Four starter skills are seeded on first run if `skills/`
doesn't exist; delete the folder to get them back.

| Field | What it does |
|---|---|
| `name` | Shown in the picker and on message tags |
| `description` | One-line summary, also sent to the model |
| `icon` | Any single character |
| *body* | The actual instructions |

**Cost:** an active skill is re-sent with every message in the conversation,
not once. The panel shows an approximate token count per skill so you can see
what you're carrying.

**Precedence:** skills are inserted after the system prompt and before the
reasoning-format instruction, and the model is told they're binding. Where two
conflict it's asked to prefer the one listed first and say which it followed.

---

## Themes and appearance

**Ctrl+,** → Appearance. Everything here is per-browser (localStorage) and
applies instantly; nothing is written to disk.

- **8 themes** — Flawed (crimson on ink), Obsidian, Clay, Nord, Rosé, Matrix,
  Paper, Daylight. The last two are light.
- **Interface font** — Inter, Space Grotesk, JetBrains Mono, or your system font.
- **Code font** — JetBrains Mono or system mono.
- **Density** — compact / cozy / roomy, scaling the whole interface.
- **Chat style** — bubbles or flat, avatars on/off, ambient glow on/off.

Fonts are bundled locally, so none of this needs a network connection.

Themes are pure CSS custom properties: no component hard-codes a colour, and
syntax highlighting derives from the same tokens, so code blocks recolour with
everything else. Adding a ninth theme means one block in `src/index.css` and one
entry in `src/lib/theme.ts`.

In the Electron shell the window is frameless and the app draws its own header;
the native caption buttons are recoloured over IPC whenever the theme changes.

---

## Conversations

The sidebar keeps your chat history in localStorage — rename, delete, search
across message text. Each conversation remembers its own model.

Attachment *bodies* are stripped before saving (they've already been sent);
without that a few file-heavy chats would blow the ~5 MB storage quota and take
the whole history with them.

---

## Configuration

Edit **`claude-chat.config.json`**, or use **Ctrl+,** → Model. The server
re-reads it on every request, so changes take effect on your next message — no
restart needed.

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
| `defaultModel` | Model selected for a new chat |
| `models` | Populates the dropdown. Add or remove entries freely |
| `systemPrompt` | The persona sent with every message. Skills append after it |
| `reasoning.enabledByDefault` | Initial state of the Reasoning toggle |
| `reasoning.instruction` | The format the model follows when reasoning is on |
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
*Reasoning* panel with the model's step-by-step working.

**An honest caveat about what this is.** Claude's internal thinking chain comes
back from the API *encrypted* — a signature with no readable content. It cannot
be displayed by this app or any other. What you see here is the model writing
its reasoning out explicitly in the response, because the system prompt asks it
to. That's genuine and usually reflects its actual approach, but it is
self-reported, not the hidden chain.

Turning reasoning off skips the format instruction entirely and makes replies
slightly faster.

---

## Shortcuts

| Key | Action |
|---|---|
| `Enter` | Send |
| `Shift + Enter` | New line |
| `Ctrl + K` | Skills |
| `Ctrl + ,` | Settings |
| `Ctrl + N` | New chat |
| `Ctrl + B` | Toggle sidebar |
| `Esc` | Close panel |

Drag files anywhere in the window to attach them, or paste them into the
message box. Text and code files are inlined; binary files are listed but not
sent.

---

## Launcher

```bash
./launch.sh          # start (detached — survives closing the terminal)
./launch.sh stop     # stop
./launch.sh status   # what's running
./launch.sh logs     # tail the log
```

Start brings Tailscale up first if it's installed, then starts the server with
`setsid` so it doesn't die when the shell exits. Logs go to `.claude-chat.log`.

## Access over Tailscale

If both machines are on the same tailnet, reach the app at your host's
Tailscale IP:

```
http://<tailscale-ip>:5173/
```

`./launch.sh status` prints the current IP. The server binds `0.0.0.0`, so it
listens on every interface.

---

## Troubleshooting

**"the 'claude' CLI is not installed"** — Install Claude Code and run `claude`
once to log in.

**Page loads but messages error** — Check `./launch.sh logs`. Usually the CLI
isn't authenticated; confirm with `claude -p "hi"`.

**A skill isn't taking effect** — Check it's toggled on (pill above the
composer). Skills apply from the *next* message; earlier replies in the thread
were generated without them.

**Edited a SKILL.md by hand and don't see it** — Hit refresh in the Skills
panel. The list is read on open, not watched.

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
FLAWED/
├── claude-chat.config.json      ← model list, system prompt, reasoning format
├── skills/<slug>/SKILL.md       ← your skills (gitignored, seeded on first run)
├── electron-main.cjs            ← frameless window, title-bar IPC
├── vite.config.ts               ← /api/claude, /api/config, /api/skills
└── src/
    ├── index.css                ← themes, markdown, syntax highlighting
    ├── lib/
    │   ├── api.ts               ← client, config fetch
    │   ├── theme.ts             ← theme + font registry, appearance store
    │   ├── skills.ts            ← skills client, active-set store
    │   ├── conversations.ts     ← history store
    │   ├── attachments.ts       ← drag/drop, text detection, token estimates
    │   └── export.ts            ← markdown / JSON / plain-text export
    └── components/
        ├── ChatInterface.tsx    ← app shell, send loop, shortcuts
        ├── Sidebar.tsx          ← chat history
        ├── Header.tsx           ← model picker, reasoning, export
        ├── Composer.tsx         ← input, attach, skills popover
        ├── Message.tsx          ← bubble, reasoning panel, actions
        ├── Markdown.tsx         ← renderer + code blocks
        ├── SkillsPanel.tsx      ← skills CRUD
        └── SettingsPanel.tsx    ← appearance / model / about
```

Stack: React 19, TypeScript, Vite 8, Tailwind, Electron 33.
