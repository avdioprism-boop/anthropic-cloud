# Claude Mythos 5 Chat Interface

A powerful web-based chat interface using Claude Mythos 5 running in the Claude Code remote environment via Tailscale.

## ✨ Features

- **Model Selection**: Switch between Mythos 5, Opus 5, Sonnet 5, and Haiku 4.5
- **Real-time Chat**: Multi-turn conversations with full context
- **Dark Mode**: Beautiful dark theme by default
- **Tailscale Access**: Accessible from any device on your Tailscale network
- **No API Keys Needed**: Uses Claude Code's built-in session authentication
- **System Prompt**: Configured to be a helpful assistant (not just intro-ing itself)

## 🚀 Quick Start

### Installation

```bash
cd /home/user/anthropic-cloud/test-probe
npm install
```

### Launch

```bash
npm run dev
```

The server will start and be accessible at:
- **Local**: http://localhost:5173/
- **Tailscale**: http://100.81.149.31:5173/

## 📍 Access Points

### Windows Desktop Shortcut
File: `Claude Chat.url` (in this folder)  
Just double-click to launch in browser!

### Command Line
```bash
# From this directory
npm run dev

# From anywhere
cd /home/user/anthropic-cloud/test-probe && npm run dev
```

### Tailscale (from any device on network)
Open browser and go to: `http://100.81.149.31:5173/`

## 🏗️ How It Works

1. You type in the web interface
2. Frontend sends message to `/api/claude` endpoint
3. Vite middleware calls `claude` CLI with your message
4. Claude CLI uses session auth from Claude Code environment
5. Response comes back as JSON
6. Chat displays the response

**No manual API keys needed** — it all works through Claude Code's session authentication!

## 🤖 Models

| Model | Use Case | Speed |
|-------|----------|-------|
| **Mythos 5** (Default) | Complex reasoning, creative work | Medium |
| **Opus 5** | Professional/technical tasks | Medium |
| **Sonnet 5** | Balanced speed & quality | Fast |
| **Haiku 4.5** | Quick responses | Very Fast |

Switch models anytime using the dropdown in the top-right of the chat!

## 💾 Keep It Running Long-Term

### Option 1: Simple (Manual Launch)
```bash
cd /home/user/anthropic-cloud/test-probe && npm run dev
```

### Option 2: Systemd Service (Always Running)
Create `/etc/systemd/system/claude-chat.service`:
```ini
[Unit]
Description=Claude Mythos 5 Chat
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/user/anthropic-cloud/test-probe
ExecStart=/usr/bin/npm run dev
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable claude-chat
sudo systemctl start claude-chat
# Check status: sudo systemctl status claude-chat
```

### Option 3: Background Session (tmux)
```bash
tmux new-session -d -s claude -c /home/user/anthropic-cloud/test-probe "npm run dev"

# Reconnect later: tmux attach -t claude
# List sessions: tmux list-sessions
```

## 🛠️ Customization

### Change Default Model
Edit `src/lib/api.ts`:
```typescript
export const DEFAULT_MODEL = "claude-opus-5";
```

### Modify System Prompt
Edit `vite.config.ts`, find this line and change it:
```typescript
const systemPrompt = `You are a helpful AI assistant...`;
```

### Change Styling
Edit `tailwind.config.js` and `src/index.css`

## 📁 Project Structure

```
test-probe/
├── src/
│   ├── App.tsx                 # Main component
│   ├── components/
│   │   └── ChatInterface.tsx   # Chat UI
│   ├── lib/
│   │   └── api.ts              # API client
│   ├── main.tsx
│   └── index.css
├── vite.config.ts              # Vite + API middleware
├── package.json
├── tailwind.config.js
├── Claude Chat.url             # Windows shortcut
└── README.md
```

## 🔧 Troubleshooting

**Port 5173 already in use?**
- Vite auto-increments to 5174, 5175, etc.
- Or kill: `lsof -ti:5173 | xargs kill -9`

**Can't connect via Tailscale?**
- Check: `tailscale status`
- Get IP: `tailscale ip`
- Use that IP: `http://[your-ip]:5173/`

**Claude not responding?**
- Check logs: `tail -f /tmp/vite-dev.log`
- Test CLI: `claude -p "test"`

**Model not recognized?**
- Verify in Claude Code environment: `claude --version`
- Mythos 5 is default—others are fallback options

## 📦 Build for Production

```bash
npm run build
# Outputs to: dist/

# Preview build
npm run preview
```

## 📚 Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Vite + Node.js middleware
- **Authentication**: Claude Code session auth
- **Components**: shadcn/ui
- **Build Tool**: Vite

## 🔗 Repository

- **Repo**: https://github.com/avdioprism-boop/anthropic-cloud
- **Branch**: `claude/new-session-z17i0b`

To update:
```bash
git pull origin claude/new-session-z17i0b
npm install
```

## ✅ Ready to Use!

Your Mythos 5 chat interface is fully set up and ready for work, testing, and exploration. Just run `npm run dev` and start chatting!

---

**Status**: ✅ Fully Functional  
**Model**: Mythos 5 (Default)  
**Access**: Tailscale network  
**Updated**: August 16, 2026
