# FLAWED — Quick Start

Your personal Claude relay in Docker. "Flawed" is the alias. The gauge shows the real model.

## 30-Second Setup

```bash
# 1. Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# 2. Start the container
docker-compose up

# 3. Open browser
open http://localhost:5274
```

Done. Type messages, they go to Claude through your API key.

## What You Get

- **Single "Flawed" model** shown in UI
- **Capability gauge** (green=Haiku, red=Opus) showing actual model
- **Stateless relay** — no context overhead, efficient token use
- **Your API key** — full cost control and visibility

## Memory (You Asked!)

By default: **1GB**

To increase:
```bash
FLAWED_MEMORY=2g docker-compose up    # 2GB
FLAWED_MEMORY=4g docker-compose up    # 4GB
```

## Change Model

Set before starting:
```bash
FLAWED_MODEL=claude-haiku-4-5-20241022 docker-compose up    # Fast (green)
FLAWED_MODEL=claude-sonnet-5 docker-compose up              # Balanced
FLAWED_MODEL=claude-opus-5 docker-compose up                # Powerful (red)
```

Or change `FLAWED_MODEL` in docker-compose.yml.

## Cost

Check your actual usage in the Anthropic console. Each message is billed independently. No waste, no context re-reading.

## Stop

```bash
docker-compose down
```

---

See `DOCKER.md` for production deployment, troubleshooting, and scaling.
