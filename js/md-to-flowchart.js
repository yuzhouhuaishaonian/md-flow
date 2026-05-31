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
    return /\?\s*$|\bwhether\b|\bif\b|success\?|fail(?:ed|ure)?\?/i.test(text);
  }

  const MERMAID_DIAGRAM_TYPES =
    "flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline";

  function isMermaidSource(text) {
    return new RegExp("^(" + MERMAID_DIAGRAM_TYPES + ")\\b", "im").test(String(text || "").trim());
  }

  function trimMermaidTail(text) {
    let result = text.trim();
    const cutPatterns = [/\n#{1,6}\s+/, /\n---+\s*(?:\n|$)/, /\n```\s/];
    for (const pattern of cutPatterns) {
      const cut = result.search(pattern);
      if (cut > 0) result = result.slice(0, cut);
    }
    return result.trim();
  }

  function extractMermaidDiagram(md) {
    const fenced = extractMermaidBlocks(md);
    if (fenced.length) return normalizeMermaidSource(fenced[0]);

    for (const block of extractCodeBlocks(md)) {
      if (isMermaidSource(block)) return normalizeMermaidSource(block);
    }

    const startRe = new RegExp("^[ \\t]*(" + MERMAID_DIAGRAM_TYPES + ")\\b", "im");
    const startMatch = md.search(startRe);
    if (startMatch < 0) return null;

    return normalizeMermaidSource(trimMermaidTail(md.slice(startMatch)));
  }

  function stripDiagramContent(md) {
    let result = md.replace(/```\s*mermaid[\s\S]*?```/gi, "");

    result = result.replace(/```[^\n]*\r?\n[\s\S]*?```/gi, function (block) {
      const inner = block.replace(/^```[^\n]*\r?\n/i, "").replace(/\r?\n```\s*$/i, "");
      if (isMermaidSource(inner) || /create\s+table/i.test(inner)) return "";
      return block;
    });

    const startRe = new RegExp("^[ \\t]*(" + MERMAID_DIAGRAM_TYPES + ")\\b", "im");
    const mermaidStart = result.search(startRe);
    if (mermaidStart >= 0) result = result.slice(0, mermaidStart);

    const createTableStart = result.search(/\bcreate\s+table\b/i);
    if (createTableStart >= 0) result = result.slice(0, createTableStart);

    return result.trim();
  }

  function hasMermaidBlock(md) {
    return /```\s*mermaid[\s\S]*?```/i.test(md) || !!extractMermaidDiagram(md);
  }

  function hasCreateTableSql(md) {
    return /\bcreate\s+table\s+/i.test(md);
  }

  function extractCodeBlocks(md) {
    const regex = /```[^\n]*\r?\n([\s\S]*?)```/gi;
    const blocks = [];
    let match;
    while ((match = regex.exec(md)) !== null) {
      blocks.push(match[1].trim());
    }
    return blocks;
  }

  function normalizeCreateTableSql(raw) {
    if (!raw) return null;

    let sql = raw.trim();
    sql = sql.replace(/^```[^\n]*\r?\n/i, "").replace(/\r?\n```\s*$/, "");
    sql = sql.trim();

    const start = sql.search(/\bcreate\s+table\s+/i);
    if (start < 0) return null;
    sql = sql.slice(start);

    const endMatch = sql.match(/\)[^;]*;\s*$/i);
    if (endMatch) {
      sql = sql.slice(0, endMatch.index + endMatch[0].length);
    } else {
      const closeParen = sql.lastIndexOf(")");
      if (closeParen > 0) {
        sql = sql.slice(0, closeParen + 1);
      }
      if (!/;\s*$/.test(sql)) sql += ";";
    }

    return sql.trim();
  }

  function extractCreateTableSql(md) {
    for (const block of extractCodeBlocks(md)) {
      if (/create\s+table/i.test(block)) {
        const sql = normalizeCreateTableSql(block);
        if (sql) return sql;
      }
    }

    const inline = md.match(/\bcreate\s+table[\s\S]*/i);
    if (inline) {
      const sql = normalizeCreateTableSql(inline[0]);
      if (sql) return sql;
    }

    return null;
  }

  function splitByCommaRespectingParens(text) {
    const parts = [];
    let current = "";
    let depth = 0;

    for (const ch of text) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }

    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  function extractTableBody(sql) {
    const open = sql.search(/\(\s*[`"]?\w/);
    if (open < 0) return null;

    let depth = 0;
    for (let i = open; i < sql.length; i++) {
      if (sql[i] === "(") depth++;
      else if (sql[i] === ")") {
        depth--;
        if (depth === 0) return sql.slice(open + 1, i);
      }
    }
    return null;
  }

  function parseColumnList(listText) {
    return listText
      .split(",")
      .map((item) => item.replace(/^[`"\s]+|[`"\s]+$/g, "").trim())
      .filter(Boolean);
  }

  function simplifyColumnType(rawType) {
    const base = rawType.replace(/\s+/g, " ").trim();
    const match = base.match(/^(\w+(?:\([^)]*\))?)/i);
    return match ? match[1].toLowerCase() : base.toLowerCase();
  }

  function parseCreateTable(sql) {
    const tableMatch = sql.match(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?[`"]?(\w+)[`"]?\s*\(/i
    );
    if (!tableMatch) return null;

    const tableName = tableMatch[1];
    const body = extractTableBody(sql);
    if (!body) return null;

    const tableCommentMatch = sql.match(/comment\s*=\s*'((?:\\'|[^'])*)'/i);
    const tableComment = tableCommentMatch
      ? tableCommentMatch[1].replace(/\\'/g, "'")
      : "";

    const columns = {};
    const columnOrder = [];
    const primaryKey = [];
    const uniqueKeys = [];
    const indexes = [];

    for (const part of splitByCommaRespectingParens(body)) {
      const upper = part.trim().toUpperCase();

      if (upper.startsWith("PRIMARY KEY")) {
        const cols = part.match(/\(([^)]+)\)/);
        if (cols) primaryKey.push(...parseColumnList(cols[1]));
        continue;
      }

      if (upper.startsWith("UNIQUE KEY") || upper.startsWith("UNIQUE INDEX")) {
        const nameMatch = part.match(/unique\s+(?:key|index)\s+[`"]?(\w+)[`"]?/i);
        const cols = part.match(/\(([^)]+)\)/);
        if (cols) {
          uniqueKeys.push({
            name: nameMatch ? nameMatch[1] : "unique_" + (uniqueKeys.length + 1),
            columns: parseColumnList(cols[1]),
          });
        }
        continue;
      }

      if (/^(KEY|INDEX)\s/i.test(part)) {
        const nameMatch = part.match(/(?:key|index)\s+[`"]?(\w+)[`"]?/i);
        const cols = part.match(/\(([^)]+)\)/);
        if (cols) {
          indexes.push({
            name: nameMatch ? nameMatch[1] : "idx_" + (indexes.length + 1),
            columns: parseColumnList(cols[1]),
          });
        }
        continue;
      }

      if (/^(CONSTRAINT|FOREIGN KEY|CHECK|FULLTEXT|SPATIAL)\s/i.test(part)) {
        continue;
      }

      const colMatch = part.match(/^[`"]?(\w+)[`"]?\s+(.+)$/s);
      if (!colMatch) continue;

      const name = colMatch[1];
      const rest = colMatch[2].trim();
      const typeMatch = rest.match(/^(\w+(?:\([^)]*\))?)/i);
      if (!typeMatch) continue;

      const rawType = typeMatch[1];
      const attrs = rest.slice(rawType.length).trim();
      const commentMatch = attrs.match(/comment\s+'((?:\\'|[^'])*)'/i);
      const comment = commentMatch ? commentMatch[1].replace(/\\'/g, "'") : "";

      const meta = [];
      if (/not\s+null/i.test(attrs)) meta.push("NOT NULL");
      if (/auto_increment/i.test(attrs)) meta.push("AUTO_INCREMENT");
      const defaultMatch = attrs.match(/default\s+('(?:\\'|[^'])*'|\S+)/i);
      if (defaultMatch) meta.push("DEFAULT " + defaultMatch[1]);

      columns[name] = {
        name,
        type: simplifyColumnType(rawType),
        comment,
        meta,
      };
      columnOrder.push(name);
    }

    if (columnOrder.length === 0) return null;

    const uniqueColumns = new Set(uniqueKeys.flatMap((key) => key.columns));

    return {
      tableName,
      tableComment,
      columns,
      columnOrder,
      primaryKey,
      uniqueKeys,
      indexes,
      uniqueColumns,
    };
  }

  function buildColumnNote(col) {
    const notes = [];
    if (col.meta.length) notes.push(col.meta.join(", "));
    if (col.comment) notes.push(col.comment);
    return notes.length ? sanitizeLabel(notes.join(" · ")) : "";
  }

  function createTableToErDiagram(schema) {
    const lines = ["erDiagram"];
    lines.push("    " + schema.tableName + " {");

    for (const columnName of schema.columnOrder) {
      const col = schema.columns[columnName];
      let keyTag = "";
      if (schema.primaryKey.includes(columnName)) keyTag = " PK";
      else if (schema.uniqueColumns.has(columnName)) keyTag = " UK";

      const note = buildColumnNote(col);
      const notePart = note ? ` "${note}"` : "";
      lines.push(`        ${col.type} ${columnName}${keyTag}${notePart}`);
    }

    lines.push("    }");
    return lines.join("\n");
  }

  function createTableToIndexFlowchart(schema) {
    if (schema.primaryKey.length === 0 && schema.uniqueKeys.length === 0 && schema.indexes.length === 0) {
      return null;
    }

    const lines = ["flowchart TB"];
    lines.push(`    T["${sanitizeLabel(schema.tableName)}"]`);

    if (schema.primaryKey.length) {
      lines.push(`    PK["Primary Key\\n${schema.primaryKey.join(", ")}"]`);
      lines.push("    T --> PK");
    }

    schema.uniqueKeys.forEach((key, index) => {
      const id = "UK" + index;
      lines.push(`    ${id}["UNIQUE ${sanitizeLabel(key.name)}\\n${key.columns.join(", ")}"]`);
      lines.push(`    T --> ${id}`);
    });

    schema.indexes.forEach((key, index) => {
      const id = "IDX" + index;
      lines.push(`    ${id}["INDEX ${sanitizeLabel(key.name)}\\n${key.columns.join(", ")}"]`);
      lines.push(`    T --> ${id}`);
    });

    return lines.join("\n");
  }

  function sqlCreateTableToMermaid(sql) {
    const schema = parseCreateTable(sql);
    if (!schema) return null;

    const erDiagram = createTableToErDiagram(schema);
    const indexFlow = createTableToIndexFlowchart(schema);
    const parts = [erDiagram];

    if (indexFlow) parts.push(indexFlow);

    const messageParts = [
      `Generated table schema diagram from SQL: ${schema.tableName}`,
      `${schema.columnOrder.length} columns`,
    ];
    if (schema.tableComment) messageParts.push(schema.tableComment);
    if (schema.uniqueKeys.length) messageParts.push(`${schema.uniqueKeys.length} unique keys`);
    if (schema.indexes.length) messageParts.push(`${schema.indexes.length} indexes`);

    return {
      source: parts[0],
      extraSources: parts.slice(1),
      mode: "sql",
      message: messageParts.join(" · "),
      schema,
    };
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
    } else if (/^```[\s\S]*?```$/m.test(text)) {
      const inner = text.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "");
      if (isMermaidSource(inner)) text = inner;
    }

    text = text.trim();

    if (!new RegExp("^(" + MERMAID_DIAGRAM_TYPES + ")\\b", "im").test(text)) {
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
    const mermaidSource = extractMermaidDiagram(md);
    if (mermaidSource) {
      const diagramType = mermaidSource.match(new RegExp("^(" + MERMAID_DIAGRAM_TYPES + ")\\b", "i"));
      const typeLabel = diagramType ? diagramType[1] : "Mermaid";
      return {
        source: mermaidSource,
        extraSources: [],
        mode: "mermaid",
        message: `Detected ${typeLabel} diagram, rendering directly`,
      };
    }

    if (hasCreateTableSql(md)) {
      const sql = extractCreateTableSql(md);
      if (sql) {
        const result = sqlCreateTableToMermaid(sql);
        if (result) return result;
      }
    }

    const trimmed = md.trim();
    if (isMermaidSource(trimmed)) {
      return {
        source: normalizeMermaidSource(trimmed),
        extraSources: [],
        mode: "mermaid",
        message: "Detected Mermaid syntax, rendering directly",
      };
    }

    const structure = parseMarkdownStructure(md);
    const steps = collectFlowSteps(structure);

    if (steps.length === 0) {
      const fallback = structure.docTitle.text || "Document";
      return {
        source: `flowchart TD\n    start["${sanitizeLabel(fallback)}"]`,
        extraSources: [],
        mode: "auto",
        message: "No steps detected, generated a single-node flowchart",
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
      extraSources: [],
      mode: "auto",
      message: `Generated flowchart from Markdown (${steps.length} nodes)`,
    };
  }

  global.MdToFlowchart = {
    markdownToFlowchart,
    hasMermaidBlock,
    hasCreateTableSql,
    isMermaidSource,
    extractMermaidDiagram,
    stripDiagramContent,
    extractMermaidBlocks,
    extractCodeBlocks,
    extractCreateTableSql,
    parseCreateTable,
    sqlCreateTableToMermaid,
    normalizeMermaidSource,
  };
})(window);
