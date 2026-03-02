<div align="center">

# 🔖 TMarks

**AI 驱动的智能书签管理系统**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3%20%7C%2019-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0%20%7C%207-646cff.svg)](https://vitejs.dev/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-f38020.svg)](https://workers.cloudflare.com/)
[![许可证](https://img.shields.io/badge/许可证-MIT-green.svg)](LICENSE)

简体中文

[在线演示](https://tmarks.669696.xyz) | [视频教程](https://bushutmarks.pages.dev/course/tmarks) | [问题反馈](https://github.com/ai-tmarks/tmarks/issues) | [功能建议](https://github.com/ai-tmarks/tmarks/discussions)

</div>

---

## ✨ 项目简介

TMarks 是一个现代化的智能书签管理系统，结合 AI 技术自动生成标签，让书签管理变得简单高效。

### 核心特性

- 📚 **智能书签管理** - AI自动标签、多维筛选、批量操作、拖拽排序
- 🗂️ **标签页组管理** - 一键收纳标签页、智能分组、快速恢复
- 🌐 **公开分享** - 创建个性化书签展示页、KV缓存加速
- 🔌 **浏览器扩展** - 快速保存、AI推荐、离线支持、自动同步
- 🔐 **安全可靠** - JWT认证、API Key管理、数据加密

### 技术栈

- **前端**: React 18/19 + TypeScript + Vite + TailwindCSS 4
- **后端**: Cloudflare Workers + Pages Functions
- **数据库**: Cloudflare D1 (SQLite)
- **缓存**: Cloudflare KV
- **快照存储**: Cloudflare R2（可选，用于存储网页快照 HTML 与图片，支持全局 7GB 配额限制）
- **AI集成**: 支持 OpenAI、Anthropic、DeepSeek、智谱等 8+ 提供商

---

## 🔌 浏览器扩展

登录 TMarks 后，进入 **个人设置** 页面下载并安装浏览器扩展。

### 扩展功能

- **快速保存书签** - 一键保存当前网页，AI 自动推荐标签
- **标签页收纳** - 一键收纳所有标签页，改天再看

### 支持浏览器

Chrome / Edge / Firefox / Opera / Brave / 360 / QQ / 搜狗

---

## 🏠 新标签页

安装扩展后，浏览器新标签页将替换为美观实用的个性化页面：

- **Bing 每日壁纸** - 自动更新，支持查看历史 7 天壁纸
- **置顶书签 Dock 栏** - 最常用书签固定在底部，一键访问
- **快捷方式网格** - 自定义快捷方式，支持拖拽排序、文件夹分组
- **实用组件** - 时钟、农历、每日诗词、天气、问候语
- **智能搜索** - 多搜索引擎支持，搜索建议
- **个性化设置** - 壁纸效果、布局、主题自定义

---

## 🚀 部署

📖 **详细部署文档**: [DEPLOYMENT.md](DEPLOYMENT.md)

📹 **视频教程**: [点击观看](https://bushutmarks.pages.dev/course/tmarks)（3 分钟完成部署）

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。