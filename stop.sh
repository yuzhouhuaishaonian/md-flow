#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$DIR/.server.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "PID file not found, server does not seem to be running."
  exit 0
fi

PID="$(cat "$PID_FILE")"

if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Stopped MD Flowchart Editor (PID $PID)."
else
  echo "Process $PID is not running, cleaning up stale PID file."
fi

rm -f "$PID_FILE"
