# ===== 阶段1: 安装依赖 =====
FROM node:20-alpine AS deps

# 构建依赖（better-sqlite3 需要编译）
RUN apk add --no-cache python3 make g++

# Tesseract OCR
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-chi_sim tesseract-ocr-data-eng

WORKDIR /app
COPY backend/package.json ./
RUN npm install --omit=dev

# ===== 阶段2: 运行 =====
FROM node:20-alpine

RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-chi_sim tesseract-ocr-data-eng

WORKDIR /app

# 复制后端
COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src/ ./src/

# 复制前端
COPY frontend/ ./frontend/

RUN mkdir -p /app/data /app/uploads

VOLUME ["/app/data", "/app/uploads"]

EXPOSE 3000

CMD ["node", "src/index.js"]
