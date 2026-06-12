# AGENTS.md — data-report

## 项目概述

单位财务收支报表系统：Node.js + Express 后端，原生 HTML/CSS/JS 前端 (SPA)，ECharts 图表，SQLite 持久化。

## 构建与运行

```bash
# 本地开发
cd backend && npm install && npm run dev

# Docker 部署
docker compose up -d --build
```

## 架构

- **前端** (`frontend/`): SPA，hash 路由 (`#dashboard`, `#records`, `#entities`, `#invoices`, `#import`)，通过 `App.navigate()` 切换页面
- **后端** (`backend/src/`): Express REST API，路由在 `routes/`，服务在 `services/`
- **数据库**: SQLite，`data/data-report.db`，表定义见 `db.js`
- **文件存储**: `uploads/` 目录，通过 multer 上传，路由通过 `/uploads/` 静态访问

## 约定

- 前后端通过 `/api/*` 通信，前端 `js/api.js` 封装所有 API 调用
- 前端状态在 `js/store.js` 的 Store 对象中
- 图表在 `js/charts.js`，每个图表用 ECharts 实例管理，页面切换时自动 dispose
- Toast/Modal 是全局单例，在 `app.js` 中定义
- 始终使用 `escHtml()` 转义用户输入
