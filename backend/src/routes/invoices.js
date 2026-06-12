const { Router } = require('express');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { upload, UPLOADS_DIR } = require('../storage');
const { recognizeInvoice } = require('../services/ocr');
const fs = require('fs');
const path = require('path');

const router = Router();

// 列表（支持关键词搜索购买方/销售方 + 状态筛选）
router.get('/', (req, res) => {
  const { entity_id, keyword, status } = req.query;
  const conditions = [];
  const params = [];

  if (entity_id) { conditions.push('entity_id = ?'); params.push(entity_id); }
  if (status && ['paid','unpaid'].includes(status)) { conditions.push('status = ?'); params.push(status); }
  if (keyword) {
    conditions.push("(buyer_name LIKE '%' || ? || '%' OR seller_name LIKE '%' || ? || '%' OR invoice_number LIKE '%' || ? || '%' OR ocr_text LIKE '%' || ? || '%')");
    params.push(keyword, keyword, keyword, keyword);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM invoices ${where} ORDER BY created_at DESC`).all(...params);
  const totalAmount = db.prepare(`SELECT COALESCE(SUM(ocr_amount),0) as total FROM invoices ${where}`).get(...params).total;

  res.json({ rows, totalAmount });
});

// 上传发票 + OCR（支持 PDF + 图片）
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { entity_id } = req.body;
    if (!req.file) return res.status(400).json({ error: '请上传文件' });

    const id = uuidv4();
    const mimetype = req.file.mimetype;

    // OCR 识别发票信息
    let ocrText = '', invoiceNumber = '', buyerName = '', sellerName = '', ocrAmount = null, ocrDate = null;
    try {
      const result = await recognizeInvoice(req.file.path, mimetype);
      ocrText = result.text;
      invoiceNumber = result.invoiceNumber;
      buyerName = result.buyerName;
      sellerName = result.sellerName;
      ocrAmount = result.amount;
      ocrDate = result.date;
    } catch (e) {
      console.error('OCR 失败:', e.message);
    }

    db.prepare(`
      INSERT INTO invoices (id, entity_id, filename, original_name, mime_type, size,
        invoice_number, buyer_name, seller_name, ocr_amount, ocr_date, ocr_text)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, entity_id || null, req.file.filename, req.file.originalname, mimetype, req.file.size,
      invoiceNumber, buyerName, sellerName, ocrAmount, ocrDate, ocrText);

    res.status(201).json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 重新 OCR（如果第一次识别不准）
router.post('/:id/re-ocr', async (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: '发票不存在' });

  const filepath = path.join(UPLOADS_DIR, inv.filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: '文件已丢失' });

  try {
    const result = await recognizeInvoice(filepath, inv.mime_type);
    db.prepare(`
      UPDATE invoices SET invoice_number=?, buyer_name=?, seller_name=?, ocr_amount=?, ocr_date=?, ocr_text=?
      WHERE id=?
    `).run(result.invoiceNumber, result.buyerName, result.sellerName, result.amount, result.date, result.text, req.params.id);
    res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 手动编辑发票信息（OCR 不准时手动修正）
router.put('/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: '发票不存在' });
  const { invoice_number, buyer_name, seller_name, ocr_amount, ocr_date, status } = req.body;
  db.prepare(`
    UPDATE invoices SET
      invoice_number = COALESCE(?, invoice_number),
      buyer_name = COALESCE(?, buyer_name),
      seller_name = COALESCE(?, seller_name),
      ocr_amount = COALESCE(?, ocr_amount),
      ocr_date = COALESCE(?, ocr_date),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(
    invoice_number ?? null, buyer_name ?? null, seller_name ?? null,
    ocr_amount ?? null, ocr_date ?? null, status ?? null,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id));
});

// 关联发票到记录（双向绑定 + 清理旧关联）
router.put('/:id/link', (req, res) => {
  const { record_id } = req.body;
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: '发票不存在' });

  // 1. 清理发票之前的关联
  if (inv.record_id && inv.record_id !== record_id) {
    db.prepare('UPDATE records SET invoice_id = NULL WHERE id = ?').run(inv.record_id);
  }

  // 2. 清理目标记录之前的发票关联
  if (record_id) {
    db.prepare('UPDATE invoices SET record_id = NULL WHERE record_id = ? AND id != ?').run(record_id, req.params.id);
  } else {
    // 解除关联：同时清记录侧
    if (inv.record_id) {
      db.prepare('UPDATE records SET invoice_id = NULL WHERE id = ?').run(inv.record_id);
    }
  }

  // 3. 建立新关联
  db.prepare('UPDATE invoices SET record_id = ? WHERE id = ?').run(record_id || null, req.params.id);
  if (record_id) {
    db.prepare('UPDATE records SET invoice_id = ? WHERE id = ?').run(req.params.id, record_id);
  }

  res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id));
});

// 批量切换已付/未付状态
router.post('/batch-status', (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids[] 必填' });
  if (!['paid','unpaid'].includes(status)) return res.status(400).json({ error: 'status 必须是 paid 或 unpaid' });
  const stmt = db.prepare('UPDATE invoices SET status = ? WHERE id = ?');
  db.transaction((idList) => { for (const id of idList) stmt.run(status, id); })(ids);
  res.json({ updated: ids.length, status });
});

// 删除
router.delete('/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: '发票不存在' });
  try { fs.unlinkSync(path.join(UPLOADS_DIR, inv.filename)); } catch {}
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
