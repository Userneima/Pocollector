# Pocollector - 设计灵感采集器

一个 Chrome 扩展插件，用于采集 Pinterest、小红书、淘宝等网站的设计灵感，并使用 AI 进行分析，最终上传到飞书表格。

## 功能特性

- **多平台支持**：支持从 Pinterest、小红书、淘宝等网站采集设计灵感
- **截图功能**：支持全屏截图和区域选择截图
- **AI 分析**：使用 Tongyi Qianwen 分析图片内容，提取设计元素
- **飞书集成**：将分析结果上传到飞书表格
- **历史记录**：保存采集历史，方便查看和管理
- **平台识别**：自动识别采集来源平台

## 安装方法

1. 克隆本仓库到本地
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」，选择 `chrome-extension` 目录
5. 扩展已成功安装，可在浏览器右上角看到插件图标

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
- **AI 分析**：Tongyi Qianwen API
- **后端**：Next.js API Routes
- **数据存储**：飞书 Bitable

## 目录结构

```
chrome-extension/       # 扩展插件代码
├── background.js       # 后台脚本
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
└── icon*.png           # 插件图标
```

## 注意事项

- 使用前需要配置飞书应用，获取 App ID 和 App Secret
- AI 分析功能需要后端服务支持，请确保后端服务已启动
- 上传到飞书功能需要飞书表格的编辑权限

## 许可证

MIT License