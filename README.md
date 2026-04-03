# Pocollector - 设计灵感采集器

一个 Chrome 扩展插件，用于采集 Pinterest、小红书、淘宝等网站的设计灵感，并使用 AI 进行分析，最终上传到飞书表格。

## 功能特性

- **多平台支持**：支持从 Pinterest、小红书、淘宝等网站采集设计灵感
- **截图功能**：支持全屏截图和区域选择截图
- **AI 分析**：扩展内直连通义 DashScope（OpenAI 兼容 `chat/completions`）分析图片
- **飞书集成**：扩展内直连飞书 OpenAPI，将分析结果写入多维表格
- **历史记录**：保存采集历史，方便查看和管理
- **平台识别**：自动识别采集来源平台

## 安装方法（一键使用，无需本地 Next）

1. **Chrome**：打开 `chrome://extensions/`；**Microsoft Edge**：打开 `edge://extensions/`。
2. 开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本仓库中的 `chrome-extension` 目录。
4. 点击扩展图标，在「API 设置」中填写：
   - **通义 DashScope API Key**（必填）
   - **飞书 App ID / App Secret**（若需「上传到飞书」；凭证保存在本机扩展存储中，**仅限内部分发**，勿将扩展包与密钥对外公开）

## 使用指南

1. 打开想要采集灵感的网页（如 Pinterest、小红书、淘宝）
2. 点击浏览器右上角的插件图标
3. 选择是否需要全屏截图（默认开启）
4. 点击「开始采集」按钮
5. 等待插件完成分析（可能需要几秒钟）
6. 在弹出的分析结果页面中，查看 AI 分析结果
7. 可以修改分析结果，然后点击「暂存到历史记录」保存
8. 输入飞书表格链接，点击「上传到飞书」将结果上传到飞书

## 技术栈

- **前端**：HTML、CSS、JavaScript
- **Chrome 扩展**：Manifest V3
- **AI 分析**：DashScope（通义千问视觉模型，如 `qwen-vl-plus`）
- **可选后端**：仓库内 Next.js 仍保留 `app/api/*`，仅供本地开发或自建桥接，**日常使用扩展可不启动**

## 目录结构

```
chrome-extension/       # 扩展插件代码
├── background.js       # 后台脚本（DashScope + 飞书 API）
├── content.js          # 内容脚本
├── popup.html          # 弹出页面
├── popup.js            # 弹出页面脚本
├── result.html         # 分析结果页面
├── result.js           # 分析结果页面脚本
├── preview.html        # 截图预览页面
├── preview.js          # 截图预览页面脚本
├── select-area.html    # 区域选择页面
├── select-area.js      # 区域选择页面脚本
├── manifest.json       # 扩展配置文件
├── icon16.png / icon48.png / icon128.png  # 工具栏图标（由 icon2 缩放生成，可替换）
└── icon2.png           # 可选高清源图
```

## 飞书表格链接

结果页「上传到飞书」时，链接需能解析出应用 token 与表 ID（例如多维表格 URL 中含 `/base/` 与 `tbl` 段）。应用需对目标表格有编辑权限。

## 注意事项

- Key 与 Secret 存在浏览器本地，**内部分发**时请配合账号与权限管控。
- 若 DashScope 或飞书域名有变，可在 `manifest.json` 的 `host_permissions` 中补充对应主机。

## 许可证

MIT License
