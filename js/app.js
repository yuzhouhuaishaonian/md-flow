(function () {
  "use strict";

  const STORAGE_KEY = "md-flow-content";

  const DEFAULT_MD = `# 系统维护通告

**发布时间**：2026-05-28
**影响范围**：全体用户

## 操作流程

1. 发布维护通告
2. 用户收到通知
3. 停止写入服务
4. 执行数据库升级
5. 升级是否成功？
6. 成功则恢复服务并通知用户
7. 失败则执行回滚并告警

## 注意事项

- 请提前保存未完成的工作
- 维护期间请勿进行重要操作
- 如有问题请联系运维值班
`;

  let editor;
  let renderTimer;
  let renderLock = Promise.resolve();
  let currentFlowchart = { source: "", extraSources: [], mode: "auto", message: "" };

  const BADGE_LABELS = {
    auto: "自动转换",
    mermaid: "Mermaid",
    sql: "SQL 表结构",
  };

  const previewEl = document.getElementById("preview");
  const diagramStatusEl = document.getElementById("diagram-status");
  const toastEl = document.getElementById("toast");
  const offscreenEl = document.getElementById("offscreen-render");

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove("show"), 2800);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadText(text, filename, mime) {
    downloadBlob(new Blob([text], { type: mime }), filename);
  }

  function getTimestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function sanitizeHtml(html) {
    if (typeof DOMPurify !== "undefined") {
      return DOMPurify.sanitize(html, {
        ADD_TAGS: ["foreignObject"],
        ADD_ATTR: ["target", "xmlns", "viewBox", "preserveAspectRatio", "class", "id"],
      });
    }
    return html;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function checkDependencies() {
    const missing = [];
    if (typeof CodeMirror === "undefined") missing.push("CodeMirror");
    if (typeof marked === "undefined") missing.push("marked");
    if (typeof mermaid === "undefined") missing.push("mermaid");
    return missing;
  }

  function buildFlowchartFromMd(md) {
    return MdToFlowchart.markdownToFlowchart(md);
  }

  function withTimeout(promise, ms, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
    ]);
  }

  async function renderMermaidToElement(source, container) {
    if (!container) {
      throw new Error("找不到流程图渲染容器");
    }

    const run = async () => {
      const id = "mermaid-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      try {
        const { svg } = await mermaid.render(id, source);
        container.innerHTML = svg;
        return container.querySelector("svg");
      } catch (err) {
        container.innerHTML =
          `<pre class="render-error">流程图生成失败：\n${escapeHtml(String(err.message || err))}</pre>`;
        return null;
      }
    };

    renderLock = renderLock.then(run, run);
    return renderLock;
  }

  function buildPreviewShell(mode, message, sources) {
    previewEl.innerHTML = "";

    const bodyWrap = document.createElement("div");
    bodyWrap.className = "md-body-slot";
    previewEl.appendChild(bodyWrap);

    const flowchartWrap = document.createElement("div");
    flowchartWrap.className = "generated-flowchart";

    const header = document.createElement("div");
    header.className = "flowchart-header";
    header.innerHTML =
      `<span class="flowchart-badge ${mode}">${BADGE_LABELS[mode] || mode}</span>` +
      `<span class="flowchart-hint">${escapeHtml(message)}</span>`;

    const block = document.createElement("div");
    block.className = "mermaid-block";

    const renderTargets = [];
    sources.forEach((source, index) => {
      const panel = document.createElement("div");
      panel.className = "flowchart-panel";

      if (sources.length > 1) {
        const title = document.createElement("div");
        title.className = "flowchart-panel-title";
        title.textContent = index === 0 ? "表结构 (erDiagram)" : "索引与约束";
        panel.appendChild(title);
      }

      const renderTarget = document.createElement("div");
      renderTarget.className = "flowchart-render-target";
      panel.appendChild(renderTarget);
      block.appendChild(panel);
      renderTargets.push({ renderTarget, source });
    });

    const details = document.createElement("details");
    details.className = "mermaid-source-panel";
    const sourceText = sources.join("\n\n---\n\n");
    details.innerHTML =
      `<summary>查看生成的 Mermaid 代码</summary><pre><code>${escapeHtml(sourceText)}</code></pre>`;

    flowchartWrap.append(header, block, details);
    previewEl.appendChild(flowchartWrap);

    return { bodyWrap, renderTargets };
  }

  function getDiagramSources(flowchart) {
    return [flowchart.source].concat(flowchart.extraSources || []).filter(Boolean);
  }

  async function updatePreview() {
    try {
      const md = editor.getValue();
      localStorage.setItem(STORAGE_KEY, md);

      currentFlowchart = buildFlowchartFromMd(md);
      diagramStatusEl.textContent = currentFlowchart.message;

      const sources = getDiagramSources(currentFlowchart);
      const { bodyWrap, renderTargets } = buildPreviewShell(
        currentFlowchart.mode,
        currentFlowchart.message,
        sources
      );

      const bodyHtml = renderMarkdownBody(md);
      if (bodyHtml) {
        bodyWrap.innerHTML = sanitizeHtml(bodyHtml);
      } else {
        bodyWrap.remove();
      }

      for (const item of renderTargets) {
        item.renderTarget.innerHTML = `<p class="render-loading">正在生成流程图…</p>`;
        await renderMermaidToElement(item.source, item.renderTarget);
      }
    } catch (err) {
      previewEl.innerHTML =
        `<pre class="render-error">预览失败：\n${escapeHtml(String(err.message || err))}</pre>`;
      diagramStatusEl.textContent = "渲染失败";
    }
  }

  function schedulePreview() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(updatePreview, 300);
  }

  function initEditor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    editor = CodeMirror(document.getElementById("editor"), {
      value: saved || DEFAULT_MD,
      mode: "markdown",
      theme: "material-darker",
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
    });
    editor.on("change", schedulePreview);
  }

  function renderMarkdownBody(md) {
    const bodyMd = MdToFlowchart.stripDiagramContent(md);
    if (!bodyMd) return "";

    return marked.parse(bodyMd, { gfm: true, breaks: true });
  }

  function getFlowchartSvg() {
    return previewEl.querySelector(".flowchart-render-target svg");
  }

  function getAllFlowchartSvgs() {
    return Array.from(previewEl.querySelectorAll(".flowchart-render-target svg"));
  }

  function svgToBlob(svgEl) {
    const clone = svgEl.cloneNode(true);
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    return new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml;charset=utf-8",
    });
  }

  function prepareSvgForExport(svgEl) {
    const clone = svgEl.cloneNode(true);
    clone.querySelectorAll("foreignObject").forEach((el) => el.remove());

    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }

    let width = parseFloat(clone.getAttribute("width"));
    let height = parseFloat(clone.getAttribute("height"));
    const vb = clone.viewBox && clone.viewBox.baseVal;

    if ((!width || !height) && vb && vb.width && vb.height) {
      width = vb.width;
      height = vb.height;
    }
    if (!width || !height) {
      try {
        const bb = svgEl.getBBox();
        width = bb.width;
        height = bb.height;
      } catch (e) {
        width = 800;
        height = 600;
      }
    }

    width = Math.max(1, Math.ceil(width));
    height = Math.max(1, Math.ceil(height));
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    if (!clone.getAttribute("viewBox")) {
      clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    return { clone, width, height };
  }

  function svgToPng(svgEl, scale) {
    scale = scale || 2;
    const { clone, width, height } = prepareSvgForExport(svgEl);
    const outW = Math.ceil(width * scale);
    const outH = Math.ceil(height * scale);
    const svgStr = new XMLSerializer().serializeToString(clone);
    const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);

    return withTimeout(
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function () {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = outW;
            canvas.height = outH;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, outW, outH);
            ctx.drawImage(img, 0, 0, outW, outH);
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("PNG 转换失败"));
              },
              "image/png",
              1
            );
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error("SVG 转 PNG 失败，请尝试导出 SVG"));
        img.src = dataUrl;
      }),
      20000,
      "生成图片超时，请缩小流程图后重试"
    );
  }

  async function ensureFlowchartRendered() {
    let svg = getFlowchartSvg();
    if (svg) return svg;

    currentFlowchart = buildFlowchartFromMd(editor.getValue());
    offscreenEl.innerHTML = "";
    return renderMermaidToElement(currentFlowchart.source, offscreenEl);
  }

  async function renderAllDiagramsForExport() {
    const sources = getDiagramSources(currentFlowchart);
    if (sources.length <= 1) {
      let svg = getFlowchartSvg();
      if (!svg) {
        await updatePreview();
        svg = getFlowchartSvg();
      }
      if (!svg) {
        offscreenEl.innerHTML = "";
        svg = await renderMermaidToElement(currentFlowchart.source, offscreenEl);
      }
      return svg ? [svg] : [];
    }

    let svgs = getAllFlowchartSvgs();
    if (svgs.length === sources.length) return svgs;

    await updatePreview();
    svgs = getAllFlowchartSvgs();
    if (svgs.length === sources.length) return svgs;

    offscreenEl.innerHTML = "";
    const rendered = [];
    for (const source of sources) {
      const container = document.createElement("div");
      offscreenEl.appendChild(container);
      const svg = await renderMermaidToElement(source, container);
      if (svg) rendered.push(svg);
    }
    return rendered;
  }

  function combineSvgsVertically(svgs, gap) {
    gap = gap || 24;
    if (svgs.length === 1) return prepareSvgForExport(svgs[0]);

    const prepared = svgs.map((svg) => prepareSvgForExport(svg));
    const totalWidth = Math.max(...prepared.map((item) => item.width));
    const totalHeight =
      prepared.reduce((sum, item) => sum + item.height, 0) + gap * (prepared.length - 1);

    const combined = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    combined.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    combined.setAttribute("width", String(totalWidth));
    combined.setAttribute("height", String(totalHeight));
    combined.setAttribute("viewBox", `0 0 ${totalWidth} ${totalHeight}`);

    let offsetY = 0;
    prepared.forEach((item) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("transform", `translate(${(totalWidth - item.width) / 2}, ${offsetY})`);
      group.appendChild(item.clone);
      combined.appendChild(group);
      offsetY += item.height + gap;
    });

    return { clone: combined, width: totalWidth, height: totalHeight };
  }

  async function generateImage(format) {
    const buttons = {
      png: document.getElementById("btn-generate"),
      svg: document.getElementById("btn-export-svg"),
      pdf: document.getElementById("btn-export-pdf"),
    };
    const labels = { png: "生成图片", svg: "SVG", pdf: "PDF" };
    const loading = { png: "生成中…", svg: "导出中…", pdf: "导出中…" };
    const btn = buttons[format] || buttons.png;

    Object.values(buttons).forEach((b) => (b.disabled = true));
    btn.textContent = loading[format] || "处理中…";

    try {
      currentFlowchart = buildFlowchartFromMd(editor.getValue());

      const svgs = await renderAllDiagramsForExport();
      if (svgs.length === 0) {
        showToast("无法生成流程图，请检查 Markdown 内容");
        return;
      }

      const combined = combineSvgsVertically(svgs);
      const exportSvg = combined.clone;

      const ts = getTimestamp();
      if (format === "png") {
        const blob = await svgToPng(exportSvg, 2);
        downloadBlob(blob, `flowchart-${ts}.png`);
        showToast("已生成并下载 PNG 图片");
      } else if (format === "svg") {
        downloadBlob(svgToBlob(exportSvg), `flowchart-${ts}.svg`);
        showToast("已导出 SVG 图片");
      } else if (format === "pdf") {
        const { jsPDF } = window.jspdf;
        const pngBlob = await svgToPng(exportSvg, 2);
        const dataUrl = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.onerror = () => rej(new Error("读取图片失败"));
          reader.readAsDataURL(pngBlob);
        });

        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const props = pdf.getImageProperties(dataUrl);

        let imgW = pageW - margin * 2;
        let imgH = (props.height * imgW) / props.width;
        if (imgH > pageH - margin * 2) {
          imgH = pageH - margin * 2;
          imgW = (props.width * imgH) / props.height;
        }

        const x = (pageW - imgW) / 2;
        const y = (pageH - imgH) / 2;
        pdf.addImage(dataUrl, "PNG", x, y, imgW, imgH);
        pdf.save(`flowchart-${ts}.pdf`);
        showToast("已导出 PDF");
      }
    } catch (err) {
      showToast("生成失败：" + (err.message || err));
    } finally {
      Object.entries(buttons).forEach(([key, b]) => {
        b.disabled = false;
        b.textContent = labels[key];
      });
    }
  }

  function saveMarkdown() {
    downloadText(editor.getValue(), `document-${getTimestamp()}.md`, "text/markdown;charset=utf-8");
    showToast("已保存 Markdown 文件");
  }

  function loadMarkdownFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      editor.setValue(e.target.result);
      updatePreview();
      showToast(`已打开：${file.name}`);
    };
    reader.readAsText(file, "UTF-8");
  }

  function initResizer() {
    const resizer = document.getElementById("resizer");
    const editorPanel = document.querySelector(".editor-panel");
    let dragging = false;

    resizer.addEventListener("mousedown", (e) => {
      dragging = true;
      resizer.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const total = document.querySelector(".workspace").clientWidth;
      const pct = Math.min(70, Math.max(25, (e.clientX / total) * 100));
      editorPanel.style.width = pct + "%";
    });

    document.addEventListener("mouseup", () => {
      dragging = false;
      resizer.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    });
  }

  document.getElementById("btn-generate").addEventListener("click", () => generateImage("png"));
  document.getElementById("btn-export-svg").addEventListener("click", () => generateImage("svg"));
  document.getElementById("btn-export-pdf").addEventListener("click", () => generateImage("pdf"));
  document.getElementById("btn-save-md").addEventListener("click", saveMarkdown);
  const SQL_TABLE_MD = `# users 表示例

演示用用户表，用于测试 SQL → erDiagram 自动转换。

\`\`\`sql
CREATE TABLE \`users\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`username\` varchar(50) NOT NULL COMMENT 'login name',
  \`email\` varchar(100) NOT NULL COMMENT 'user email',
  \`status\` varchar(20) NOT NULL DEFAULT 'active' COMMENT 'active / inactive',
  \`role\` varchar(20) NOT NULL DEFAULT 'member' COMMENT 'admin / member',
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`) USING BTREE,
  UNIQUE KEY \`users_idx_email\` (\`email\`) USING BTREE,
  KEY \`users_idx_status_role\` (\`status\`, \`role\`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Demo user table for diagram preview';
\`\`\`
`;

  async function insertSqlTemplate() {
    try {
      const resp = await fetch("examples/sample-table.md");
      if (resp.ok) {
        editor.setValue(await resp.text());
        updatePreview();
        showToast("已加载表结构示例");
        return;
      }
    } catch (err) {
      // file:// 或离线时回退到内置示例
    }
    editor.setValue(SQL_TABLE_MD);
    updatePreview();
    showToast("已加载表结构示例");
  }

  document.getElementById("btn-insert-template").addEventListener("click", () => {
    editor.setValue(DEFAULT_MD);
    updatePreview();
  });
  document.getElementById("btn-insert-sql-template").addEventListener("click", () => {
    insertSqlTemplate();
  });

  document.getElementById("file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) loadMarkdownFile(file);
    e.target.value = "";
  });

  initEditor();
  initResizer();

  const missing = checkDependencies();
  if (missing.length > 0) {
    previewEl.innerHTML =
      `<pre class="render-error">依赖库加载失败：${missing.join("、")}\n请检查网络连接后刷新页面（Cmd+Shift+R）。</pre>`;
  } else {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      flowchart: { useMaxWidth: true, htmlLabels: false, curve: "basis" },
      er: { useMaxWidth: true },
    });
    updatePreview();
  }
})();
