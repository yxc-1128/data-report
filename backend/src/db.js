const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'data-report.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      amount REAL NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT '',
      payee_payer TEXT DEFAULT '',
      income_type TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      record_date TEXT NOT NULL,
      invoice_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
      record_id TEXT REFERENCES records(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      size INTEGER NOT NULL DEFAULT 0,
      -- OCR 提取的发票核心字段
      invoice_number TEXT DEFAULT '',
      buyer_name TEXT DEFAULT '',
      seller_name TEXT DEFAULT '',
      ocr_amount REAL,
      ocr_date TEXT,
      ocr_text TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'unpaid',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT '',
      size INTEGER NOT NULL DEFAULT 0,
      file_type TEXT NOT NULL DEFAULT 'other',
      parsed_data TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- v2 迁移：旧表若无新字段则补充（忽略重复列错误）
`);
  // 安全添加列：已存在则跳过
  const safeAlter = (sql) => { try { db.exec(sql); } catch (e) { if (!e.message.includes('duplicate')) throw e; } };
  safeAlter("ALTER TABLE invoices ADD COLUMN invoice_number TEXT DEFAULT ''");
  safeAlter("ALTER TABLE invoices ADD COLUMN buyer_name TEXT DEFAULT ''");
  safeAlter("ALTER TABLE invoices ADD COLUMN seller_name TEXT DEFAULT ''");
  safeAlter("ALTER TABLE records ADD COLUMN payee_payer TEXT DEFAULT ''");
  safeAlter("ALTER TABLE records ADD COLUMN income_type TEXT DEFAULT ''");
  safeAlter("ALTER TABLE records ADD COLUMN remark TEXT DEFAULT ''");
  safeAlter("ALTER TABLE invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'unpaid'");
}

module.exports = { db, init };
