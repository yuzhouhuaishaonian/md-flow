(function (global) {
  "use strict";

  function stripMarkdownInline(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/\[(.+?)\]\(.+?\)/g, "$1")
      .trim();
  }

  function sanitizeLabel(text) {
    return stripMarkdownInline(text)
      .replace(/"/g, "'")
      .replace(/[\[\]{}]/g, "")
      .slice(0, 60);
  }

  function isDecisionStep(text) {
    return /是否|吗\s*$|\?\s*$|成功\?|失败\?/.test(text);
  }

  function hasMermaidBlock(md) {
    return /```\s*mermaid[\s\S]*?```/i.test(md);
  }

  function extractMermaidBlocks(md) {
    const regex = /```\s*mermaid[^\n]*\r?\n([\s\S]*?)```/gi;
    const blocks = [];
    let match;
    while ((match = regex.exec(md)) !== null) {
      blocks.push(match[1].trim());
    }
    return blocks;
  }

  function normalizeMermaidSource(md) {
    let text = md.trim();

    if (/^```\s*mermaid/i.test(text)) {
      text = text.replace(/^```\s*mermaid[^\n]*\r?\n/i, "");
      text = text.replace(/\r?\n```\s*$/, "");
    } else if (/^```[\s\S]*?```$/m.test(text) && /^(flowchart|graph)\s/im.test(text.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, ""))) {
      text = text.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "");
    }

    text = text.trim();

    if (!/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline)\b/im.test(text)) {
      if (/(\w+\[|\w+\{|-->)/.test(text)) {
        text = "flowchart TD\n" + text;
      }
    }

    return text;
  }

  function parseMarkdownStructure(md) {
    const lines = md.split("\n");
    const docTitle = { text: "", level: 0 };
    const sections = [];
    let current = null;
    let inCodeBlock = false;

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, "");

      if (/^```/.test(line.trim())) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;
      if (/^>\s/.test(line) || /^---+$/.test(line.trim())) continue;

      const h1 = line.match(/^#\s+(.+)/);
      const h2 = line.match(/^##\s+(.+)/);
      const h3 = line.match(/^###\s+(.+)/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)/);
      const bullet = line.match(/^\s*[-*+]\s+(.+)/);

      if (h1) {
        docTitle.text = stripMarkdownInline(h1[1]);
        docTitle.level = 1;
        continue;
      }

      if (h2 || h3) {
        if (current && (current.title || current.steps.length)) {
          sections.push(current);
        }
        const heading = h2 || h3;
        current = {
          title: stripMarkdownInline(heading[1]),
          steps: [],
        };
        continue;
      }

      if (ordered || bullet) {
        if (!current) {
          current = { title: "", steps: [] };
        }
        const text = stripMarkdownInline((ordered || bullet)[1]);
        if (text) {
          current.steps.push({ text, ordered: !!ordered });
        }
      }
    }

    if (current && (current.title || current.steps.length)) {
      sections.push(current);
    }

    return { docTitle, sections };
  }

  function collectFlowSteps(structure) {
    const steps = [];
    let hasOrdered = false;

    for (const section of structure.sections) {
      const orderedSteps = section.steps.filter((s) => s.ordered);
      if (orderedSteps.length === 0) continue;

      hasOrdered = true;
      if (section.title) {
        steps.push({ text: section.title, kind: "section" });
      }
      for (const step of orderedSteps) {
        steps.push({ text: step.text, kind: "step" });
      }
    }

    if (hasOrdered) return steps;

    for (const section of structure.sections) {
      if (section.title && section.steps.length) {
        steps.push({ text: section.title, kind: "section" });
      }
      for (const step of section.steps) {
        steps.push({ text: step.text, kind: "step" });
      }
    }

    return steps;
  }

  function markdownToFlowchart(md) {
    if (hasMermaidBlock(md)) {
      const blocks = extractMermaidBlocks(md);
      const source = normalizeMermaidSource(blocks[0] || md);
      return {
        source,
        mode: "mermaid",
        message: "检测到 Mermaid 代码块，直接使用",
      };
    }

    const trimmed = md.trim();
    if (/^(flowchart|graph)\s/im.test(trimmed) || (/(\w+\[|\w+\{|-->)/.test(trimmed) && !/^#/.test(trimmed))) {
      return {
        source: normalizeMermaidSource(trimmed),
        mode: "mermaid",
        message: "检测到 Mermaid 语法，直接渲染",
      };
    }

    const structure = parseMarkdownStructure(md);
    const steps = collectFlowSteps(structure);

    if (steps.length === 0) {
      const fallback = structure.docTitle.text || "文档";
      return {
        source: `flowchart TD\n    start["${sanitizeLabel(fallback)}"]`,
        mode: "auto",
        message: "未识别到步骤，已生成单节点流程图",
      };
    }

    const lines = ["flowchart TD"];
    let nodeIndex = 0;
    let prevId = null;

    if (structure.docTitle.text) {
      const id = "n" + nodeIndex++;
      lines.push(`    ${id}["${sanitizeLabel(structure.docTitle.text)}"]`);
      lines.push(`    class ${id} titleNode`);
      prevId = id;
    }

    for (const step of steps) {
      const id = "n" + nodeIndex++;
      const label = sanitizeLabel(step.text);

      if (step.kind === "section") {
        lines.push(`    ${id}["${label}"]`);
        lines.push(`    class ${id} sectionNode`);
      } else if (isDecisionStep(step.text)) {
        lines.push(`    ${id}{"${label}"}`);
        lines.push(`    class ${id} decisionNode`);
      } else {
        lines.push(`    ${id}["${label}"]`);
      }

      if (prevId) {
        lines.push(`    ${prevId} --> ${id}`);
      }
      prevId = id;
    }

    lines.push("    classDef titleNode fill:#4f8cff,color:#fff,stroke:#3a6fd8");
    lines.push("    classDef sectionNode fill:#eef3ff,color:#1a1f2e,stroke:#4f8cff");
    lines.push("    classDef decisionNode fill:#fff3cd,color:#1a1f2e,stroke:#f0ad4e");

    return {
      source: lines.join("\n"),
      mode: "auto",
      message: `已从 Markdown 自动生成流程图（${steps.length} 个节点）`,
    };
  }

  global.MdToFlowchart = {
    markdownToFlowchart,
    hasMermaidBlock,
    extractMermaidBlocks,
    normalizeMermaidSource,
  };
})(window);
