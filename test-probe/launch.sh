#!/usr/bin/env bash
# Starts Claude Chat and, if available, brings Tailscale up first so the app
# is reachable from other machines on your tailnet.
#
#   ./launch.sh          start (detached, survives closing this terminal)
#   ./launch.sh stop     stop the server
#   ./launch.sh status   show what is running
#   ./launch.sh logs     tail the server log

set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${APP_DIR}/.claude-chat.log"
PORT=5173

start_tailscale() {
  command -v tailscale >/dev/null 2>&1 || return 0

  if tailscale status >/dev/null 2>&1; then
    echo "  Tailscale: already up ($(tailscale ip -4 2>/dev/null | head -1))"
    return 0
  fi

  echo "  Tailscale: daemon not running, starting it..."
  if command -v systemctl >/dev/null 2>&1 && systemctl start tailscaled 2>/dev/null; then
    :
  else
    # No systemd (containers, WSL): run the daemon directly.
    sudo -n tailscaled --state=/var/lib/tailscale/tailscaled.state \
      >/dev/null 2>&1 &
  fi

  # Give the daemon a moment to come up and register.
  for _ in $(seq 1 10); do
    sleep 1
    if tailscale status >/dev/null 2>&1; then
      echo "  Tailscale: up ($(tailscale ip -4 2>/dev/null | head -1))"
      return 0
    fi
  done

  echo "  Tailscale: could not start — the app will still work locally."
}

case "${1:-start}" in
  stop)
    # The process line is "node <APP_DIR>/node_modules/.../vite.js", so the
    # app directory comes before "vite" in the pattern.
    pkill -f "${APP_DIR}.*vite" 2>/dev/null && echo "Stopped." || echo "Not running."
    ;;

  status)
    if pgrep -f "vite" >/dev/null 2>&1; then
      echo "Server: running on http://localhost:${PORT}"
    else
      echo "Server: not running"
    fi
    command -v tailscale >/dev/null 2>&1 && {
      tailscale status >/dev/null 2>&1 \
        && echo "Tailscale: up ($(tailscale ip -4 2>/dev/null | head -1))" \
        || echo "Tailscale: down"
    }
    ;;

  logs)
    tail -f "${LOG_FILE}"
    ;;

  start)
    echo "Starting Claude Chat..."

    if ! command -v claude >/dev/null 2>&1; then
      echo "  ERROR: the 'claude' CLI is not installed or not on your PATH."
      echo "  Install it from https://claude.com/claude-code, run 'claude' once"
      echo "  to log in, then try again."
      exit 1
    fi

    start_tailscale

    if pgrep -f "vite" >/dev/null 2>&1; then
      echo "  Server: already running"
    else
      cd "${APP_DIR}" || exit 1
      # setsid detaches the server from this shell so it keeps running after
      # the terminal closes. Without it the server dies with its parent.
      setsid nohup npm run dev >"${LOG_FILE}" 2>&1 < /dev/null &
      sleep 4
      pgrep -f "vite" >/dev/null 2>&1 \
        && echo "  Server: started" \
        || { echo "  Server: FAILED to start — see ${LOG_FILE}"; exit 1; }
    fi

    echo ""
    echo "  Local:     http://localhost:${PORT}/"
    command -v tailscale >/dev/null 2>&1 && {
      TS_IP="$(tailscale ip -4 2>/dev/null | head -1)"
      [ -n "${TS_IP}" ] && echo "  Tailscale: http://${TS_IP}:${PORT}/"
    }
    echo ""
    echo "  Edit claude-chat.config.json to change models and prompts."
    echo "  ./launch.sh stop | status | logs"
    ;;

  *)
    echo "Usage: ./launch.sh [start|stop|status|logs]"
    exit 1
    ;;
esac
