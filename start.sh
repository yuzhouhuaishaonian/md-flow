#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8080}"
DIR="$(cd "$(dirname "$0")" && pwd)"

if command -v python3 >/dev/null 2>&1; then
  echo "Starting MD Flowchart Editor: http://localhost:${PORT}"
  echo "Press Ctrl+C to stop the server"
  cd "$DIR"
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  echo "Starting MD Flowchart Editor: http://localhost:${PORT}"
  echo "Press Ctrl+C to stop the server"
  cd "$DIR"
  exec python -m http.server "$PORT"
else
  echo "Python not found. Please install Python 3, or open index.html directly in a browser (some export features may be limited)."
  exit 1
fi
