#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8080}"
DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$DIR/.server.pid"
LOG_FILE="$DIR/server.log"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Server already running (PID $(cat "$PID_FILE")): http://localhost:${PORT}"
  echo "Run ./stop.sh to stop it first."
  exit 0
fi

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python not found. Please install Python 3, or open index.html directly in a browser (some export features may be limited)."
  exit 1
fi

cd "$DIR"
nohup "$PY" -m http.server "$PORT" >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"

echo "MD Flowchart Editor started in background: http://localhost:${PORT}"
echo "PID: $(cat "$PID_FILE")  |  Log: $LOG_FILE"
echo "Run ./stop.sh to stop the server."
