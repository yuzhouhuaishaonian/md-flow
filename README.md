# MD 流程图 · Markdown 转图片

在本机运行的工具：**输入 Markdown 文档，自动生成流程图并下载为 PNG / SVG / PDF**。

无需 Node.js，无需 Docker。Python 仅用于启动本地静态服务。**JS 依赖已内置在 `vendor/`，可完全离线使用。**

## 快速启动

```bash
cd md-flow
chmod +x start.sh
./start.sh
```

浏览器打开：**http://localhost:8080**

也可以指定端口：

```bash
./start.sh 3000
```

## 使用方式

1. 在左侧输入或粘贴 Markdown
2. 右侧自动生成流程图预览
3. 点击 **生成图片** 下载 PNG（也支持 SVG、PDF）

### Markdown 示例

```markdown
# 系统维护通告

## 操作流程

1. 发布维护通告
2. 用户收到通知
3. 执行数据库升级
4. 升级是否成功？
5. 成功则恢复服务
6. 失败则执行回滚
```

若文档中包含 ` ```mermaid ` 代码块，将直接使用该代码生成图片。

## 转换规则

| Markdown 元素 | 流程图表现 |
|---------------|------------|
| `# 标题` | 起始节点 |
| `## 小节标题` | 分组节点 |
| `1. 2. 3.` 编号列表 | 按顺序连接的步骤 |
| 含「是否」「?」的步骤 | 菱形判断节点 |

## 目录结构

```
md-flow/
├── index.html
├── css/style.css
├── js/
│   ├── md-to-flowchart.js   # Markdown → 流程图
│   └── app.js               # 渲染与导出
├── vendor/                  # 本地 JS/CSS 依赖（离线可用）
│   ├── codemirror/
│   ├── marked/
│   ├── dompurify/
│   ├── mermaid/
│   ├── jspdf/
│   └── download.sh          # 重新下载依赖
└── start.sh                 # 启动脚本（python -m http.server）
```

## 说明

- **完全离线**：依赖已下载到 `vendor/`，无需联网
- 如需更新依赖：`chmod +x vendor/download.sh && ./vendor/download.sh`
- 建议使用 Chrome / Edge 浏览器
