# FLAWED Docker — Production Claude Relay

A lightweight, stateless Docker container that relays messages to Claude's API using your subscription, with a unified "Flawed" interface and capability spectrum gauge.

## Quick Start

### Prerequisites
- Docker & Docker Compose installed
- `ANTHROPIC_API_KEY` environment variable

### Run

```bash
# Via docker-compose (recommended)
ANTHROPIC_API_KEY=sk-ant-... docker-compose up

# Or standalone
docker build -t flawed .
docker run -e ANTHROPIC_API_KEY=sk-ant-... -p 5274:5274 flawed
```

Then open `http://localhost:5274`

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | *required* | Your Anthropic API key |
| `PORT` | `5274` | Server port |
| `FLAWED_MODEL` | `claude-opus-5` | Default Claude model (haiku, sonnet, opus) |
| `NODE_ENV` | `production` | Node environment |

### Models

The relay supports:
- `claude-haiku-4-5-20241022` (green, position 0)
- `claude-sonnet-5` (yellow, position 0.5)
- `claude-opus-5` (red, position 1)

The capability gauge shows where your model sits on the spectrum.

## Architecture

```
Frontend (React/Vite)
    ↓
Relay Script (flawed-relay.cjs)
    ↓
Anthropic API
```

- **Stateless**: Each request is independent, no context overhead
- **Efficient**: No token waste on re-reading context
- **Single model display**: Always shows "Flawed" to the user
- **Transparent underlying model**: Capability gauge shows which Claude model is actually running

## Building

```bash
# Local development
npm install
npm run dev

# Docker build
docker build -t flawed .
docker run -e ANTHROPIC_API_KEY=sk-ant-... -p 5274:5274 flawed
```

## Scaling

- **Cost control**: Each API call is metered independently
- **Usage limits**: Set spending limits in Anthropic console
- **Model switching**: Change `FLAWED_MODEL` to switch models without rebuilding

## Notes

- The Docker image includes pre-built frontend (dist/)
- Skills and config can be mounted as volumes if needed
- Logs go to stdout (visible via `docker logs`)
- Health check runs every 30s to verify server is responding
