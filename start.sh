#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8080}"
DIR="$(cd "$(dirname "$0")" && pwd)"

if command -v python3 >/dev/null 2>&1; then
  echo "启动 MD 流程图编辑器：http://localhost:${PORT}"
  echo "按 Ctrl+C 停止服务"
  cd "$DIR"
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  echo "启动 MD 流程图编辑器：http://localhost:${PORT}"
  echo "按 Ctrl+C 停止服务"
  cd "$DIR"
  exec python -m http.server "$PORT"
else
  echo "未找到 Python，请先安装 Python 3，或直接用浏览器打开 index.html（部分导出功能可能受限）。"
  exit 1
fi
