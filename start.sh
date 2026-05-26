#!/bin/bash
# Start Jarvis web UI
cd /opt/jarvis-web

# Load env from telegram config (has all API keys)
set -a
source /opt/claude-telegram/config.env
set +a

export CLAUDE_BIN=/usr/bin/claude
export JARVIS_WORK_DIR=/home/claude/jarvis-workspace
export PORT=3131

# Build if needed
if [ ! -d .next ]; then
  echo "Building Next.js app..."
  npm run build
fi

echo "Starting Jarvis on port $PORT..."
exec npm start -- -p $PORT
