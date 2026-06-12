# 📊 data-report — 单位财务收支报表系统

基于 Node.js + ECharts 的财务收支管理与可视化系统，支持 Office 文件导入、发票 OCR 识别、报表 PDF 导出。

## 功能

| 模块 | 功能 |
|------|------|
| 📈 仪表盘 | 收支总览、月度趋势图、分类饼图、单位对比柱状图 |
| 💰 收支记录 | CRUD、多条件筛选、批量导入、关联发票 |
| 🏢 单位管理 | 多单位/部门数据隔离 |
| 🧾 发票管理 | 上传发票图片 → 自动 OCR 识别金额/日期/抬头 → 关联记录 |
| 📥 文件导入 | 上传 Excel(.xlsx/.xls) / CSV / Word(.docx) → 自动解析 → 列映射 → 批量导入为收支记录 |
| 📄 报表导出 | 生成 PDF 报表、图表 PNG 导出 |

## 技术栈

- **前端**: 原生 HTML/CSS/JS + Apache ECharts 5.5
- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **文件解析**: SheetJS (Excel)、csv-parse (CSV)、mammoth (Word)
- **OCR**: Tesseract.js + 中文语言包
- **PDF**: PDFKit

---

## 部署方法

### 方式一：Docker Compose 部署（推荐 — 飞牛 NAS）

> 适用于飞牛 NAS (i3-7100T) 或任何支持 Docker 的 Linux 服务器。

```bash
# 1. 将整个 data-report 目录上传到 NAS，例如 /vol1/docker/data-report/

# 2. SSH 进入 NAS，进入项目目录
cd /vol1/docker/data-report

# 3. 构建并启动
docker compose up -d --build

# 4. 访问
# http://<NAS-IP>:3000
```

**数据持久化**：

- `./data/` — SQLite 数据库文件
- `./uploads/` — 上传的发票图片和 Office 文件

重启不会丢失数据。

**日常管理**：

```bash
# 查看日志
docker compose logs -f

# 重启
docker compose restart

# 停止
docker compose down

# 更新（拉新代码后）
docker compose up -d --build
```

### 方式二：本地开发运行

**前提**: Node.js ≥ 18

```bash
# 1. 进入后端目录
cd data-report/backend

# 2. 安装依赖
npm install

# 3. 启动开发模式（热重载）
npm run dev

# 4. 访问
# http://localhost:3000
```

> 开发模式下，后端 `--watch` 会自动监听文件变更重启。

### 方式三：直接部署（生产，无 Docker）

```bash
cd data-report/backend
npm ci --omit=dev
NODE_ENV=production node src/index.js
```

---

## 项目结构

```
data-report/
├── frontend/                  # 前端 SPA
│   ├── index.html             # 入口 HTML
│   ├── css/style.css          # 样式（暗色主题）
│   ├── js/
│   │   ├── app.js             # 主入口 + 路由 + Toast/Modal
│   │   ├── api.js             # REST API 封装
│   │   ├── store.js           # 前端状态管理
│   │   ├── charts.js          # ECharts 图表渲染
│   │   └── pages/
│   │       ├── dashboard.js   # 仪表盘
│   │       ├── records.js     # 收支记录
│   │       ├── entities.js    # 单位管理
│   │       ├── invoices.js    # 发票管理
│   │       └── import.js      # 文件导入
│   └── assets/
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.js           # Express 入口
│   │   ├── db.js              # SQLite 初始化
│   │   ├── storage.js         # 文件存储 (multer)
│   │   ├── routes/
│   │   │   ├── entities.js    # 单位 CRUD API
│   │   │   ├── records.js     # 收支记录 CRUD + 导入
│   │   │   ├── invoices.js    # 发票上传/OCR/关联
│   │   │   ├── files.js       # 文件上传/解析
│   │   │   └── reports.js     # 报表生成/导出
│   │   └── services/
│   │       ├── parser.js      # Excel/CSV/Word 解析
│   │       ├── ocr.js         # Tesseract OCR
│   │       └── export.js      # PDF 生成
│   ├── data/                  # SQLite 数据库 (自动创建)
│   └── uploads/               # 上传文件目录
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
└── README.md
```

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| | | |
| GET | `/api/entities` | 单位列表 |
| POST | `/api/entities` | 创建单位 |
| PUT | `/api/entities/:id` | 更新单位 |
| DELETE | `/api/entities/:id` | 删除单位 |
| | | |
| GET | `/api/records` | 收支记录列表（支持筛选） |
| GET | `/api/records/stats` | 汇总统计 |
| POST | `/api/records` | 创建记录 |
| PUT | `/api/records/:id` | 更新记录 |
| DELETE | `/api/records/:id` | 删除记录 |
| POST | `/api/records/import` | 批量导入 |
| | | |
| GET | `/api/invoices` | 发票列表 |
| POST | `/api/invoices/upload` | 上传发票 + OCR |
| PUT | `/api/invoices/:id/link` | 关联记录 |
| DELETE | `/api/invoices/:id` | 删除发票 |
| | | |
| GET | `/api/files` | 文件列表 |
| POST | `/api/files/upload` | 上传文件 + 解析 |
| GET | `/api/files/:id/parsed` | 获取解析结果 |
| DELETE | `/api/files/:id` | 删除文件 |
| | | |
| GET | `/api/reports/dashboard` | 仪表盘汇总数据 |
| GET | `/api/reports/pdf` | 导出 PDF 报表 |

---

## 使用流程

1. **创建单位** — 在「单位管理」中添加单位/部门
2. **上传文件** — 在「文件导入」中上传 Excel/CSV/Word，预览解析结果，映射列后导入为收支记录
3. **手动录入** — 在「收支记录」中直接新增单条记录
4. **上传发票** — 在「发票管理」中上传发票图片，自动 OCR 识别金额、日期、抬头，然后关联到相应记录
5. **查看报表** — 仪表盘实时展示图表，可按单位和日期筛选
6. **导出 PDF** — 在收支记录页点击「导出 PDF」
