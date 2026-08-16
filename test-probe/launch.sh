#!/bin/bash
# Claude Mythos 5 Chat Interface - Launch Script

set -e

echo "🚀 Starting Claude Mythos 5 Chat Interface..."
echo ""
echo "📍 Access Points:"
echo "   Local:     http://localhost:5173/"
echo "   Tailscale: http://100.81.149.31:5173/"
echo ""
echo "🤖 Default Model: Mythos 5 (Most Powerful)"
echo "   Switch models anytime in the chat UI!"
echo ""
echo "⏹️  To stop: Press Ctrl+C"
echo ""
echo "───────────────────────────────────────────"
echo ""

cd "$(dirname "$0")"
npm run dev
