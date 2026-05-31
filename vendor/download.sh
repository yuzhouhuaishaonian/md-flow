#!/usr/bin/env bash
# 下载第三方依赖到 vendor/ 目录（需联网）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CDN="https://cdn.jsdelivr.net/npm"

mkdir -p "$ROOT/vendor/codemirror"/{lib,theme,mode/markdown}
mkdir -p "$ROOT/vendor"/{marked,dompurify,mermaid,jspdf}

download() {
  local url="$1"
  local out="$2"
  echo "→ $out"
  curl -fsSL -o "$out" "$url"
}

download "$CDN/codemirror@5.65.16/lib/codemirror.min.js"           "$ROOT/vendor/codemirror/lib/codemirror.min.js"
download "$CDN/codemirror@5.65.16/lib/codemirror.min.css"          "$ROOT/vendor/codemirror/lib/codemirror.min.css"
download "$CDN/codemirror@5.65.16/theme/material-darker.min.css"   "$ROOT/vendor/codemirror/theme/material-darker.min.css"
download "$CDN/codemirror@5.65.16/mode/markdown/markdown.min.js"  "$ROOT/vendor/codemirror/mode/markdown/markdown.min.js"
download "$CDN/marked@12.0.2/marked.min.js"                        "$ROOT/vendor/marked/marked.min.js"
download "$CDN/dompurify@3.1.6/dist/purify.min.js"                 "$ROOT/vendor/dompurify/purify.min.js"
download "$CDN/mermaid@10.9.1/dist/mermaid.min.js"                 "$ROOT/vendor/mermaid/mermaid.min.js"
download "$CDN/jspdf@2.5.1/dist/jspdf.umd.min.js"                  "$ROOT/vendor/jspdf/jspdf.umd.min.js"

echo "完成。依赖已保存到 vendor/"
