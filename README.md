# MD Flowchart · Markdown to Image

A locally-run tool: **enter a Markdown document, auto-generate a flowchart, and download it as PNG / SVG / PDF**.

No Node.js required, no Docker required. Python is only used to start a local static server. **JS dependencies are bundled in `vendor/`, so it works fully offline.**

## Quick Start

```bash
cd md-flow
chmod +x start.sh
./start.sh
```

Open in your browser: **http://localhost:8080**

You can also specify a port:

```bash
./start.sh 3000
```

On Windows you can use the bundled scripts instead:

```bat
start.bat
```

Or run the Node.js server directly:

```bash
node start.js
```

## Usage

1. Enter or paste Markdown on the left
2. The flowchart preview is generated automatically on the right
3. Click **Generate image** to download a PNG (SVG and PDF are also supported)

### Markdown Example

```markdown
# System Maintenance Notice

## Operation Flow

1. Publish maintenance notice
2. Users receive notification
3. Run database upgrade
4. Did the upgrade succeed?
5. If success, restore service
6. If failed, roll back
```

If the document contains a ` ```mermaid ` code block, that code is used directly to generate the image.

## Conversion Rules

| Markdown element | Flowchart representation |
|------------------|--------------------------|
| `# Title` | Start node |
| `## Section title` | Group node |
| `1. 2. 3.` numbered list | Steps connected in order |
| Steps with "?" / words like "whether", "if" | Diamond decision node |

## Directory Structure

```
md-flow/
├── index.html
├── css/style.css
├── js/
│   ├── md-to-flowchart.js   # Markdown -> flowchart
│   └── app.js               # rendering and export
├── vendor/                  # local JS/CSS dependencies (offline-ready)
│   ├── codemirror/
│   ├── marked/
│   ├── dompurify/
│   ├── mermaid/
│   ├── jspdf/
│   └── download.sh          # re-download dependencies
├── start.sh                 # start script (python -m http.server)
├── start.bat                # Windows start script (Node.js / Python)
└── start.js                 # Node.js static server
```

## Notes

- **Fully offline**: dependencies are downloaded into `vendor/`, no network needed
- To update dependencies: `chmod +x vendor/download.sh && ./vendor/download.sh`
- Chrome / Edge browsers are recommended
