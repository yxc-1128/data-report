const { Router } = require('express');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

const router = Router();

// 列表
router.get('/', (req, res) => {
  const { entity_id, type, start_date, end_date, month, category, keyword, page = 1, pageSize = 200 } = req.query;
  const conditions = [];
  const params = [];

  if (entity_id) { conditions.push('r.entity_id = ?'); params.push(entity_id); }
  if (type) { conditions.push('r.type = ?'); params.push(type); }
  if (start_date) { conditions.push('r.record_date >= ?'); params.push(start_date); }
  if (end_date) { conditions.push('r.record_date <= ?'); params.push(end_date); }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    conditions.push('r.record_date >= ?'); params.push(month + '-01');
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    conditions.push('r.record_date <= ?'); params.push(`${month}-${String(lastDay).padStart(2, '0')}`);
  }
  if (category) { conditions.push("r.category LIKE '%' || ? || '%'"); params.push(category); }
  if (keyword) { conditions.push("(r.summary LIKE '%' || ? || '%' OR r.remark LIKE '%' || ? || '%' OR r.payee_payer LIKE '%' || ? || '%' OR r.income_type LIKE '%' || ? || '%' OR r.record_date LIKE '%' || ? || '%' OR r.category LIKE '%' || ? || '%' OR CAST(r.amount AS TEXT) LIKE '%' || ? || '%')");
    params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (Number(page) - 1) * Number(pageSize);

  const rows = db.prepare(`
    SELECT r.*, e.name AS entity_name
    FROM records r LEFT JOIN entities e ON r.entity_id = e.id
    ${where} ORDER BY r.record_date DESC, r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(pageSize), offset);

  const total = db.prepare(`SELECT COUNT(*) as count FROM records r ${where}`).get(...params).count;
  res.json({ rows, total });
});

// 汇总统计
router.get('/stats', (req, res) => {
  const { entity_id, start_date, end_date, month, year } = req.query;
  const conditions = [];
  const params = [];
  if (entity_id) { conditions.push('entity_id = ?'); params.push(entity_id); }
  if (start_date) { conditions.push('record_date >= ?'); params.push(start_date); }
  if (end_date) { conditions.push('record_date <= ?'); params.push(end_date); }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    conditions.push('record_date >= ?'); params.push(month + '-01');
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    conditions.push('record_date <= ?'); params.push(`${month}-${String(lastDay).padStart(2, '0')}`);
  }
  if (year && /^\d{4}$/.test(year)) {
    conditions.push('record_date >= ?'); params.push(year + '-01-01');
    conditions.push('record_date <= ?'); params.push(year + '-12-31');
  }
  const whereAnd = conditions.length ? 'WHERE ' + conditions.join(' AND ') + ' AND' : 'WHERE';

  const income = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM records ${whereAnd} type='income'`).get(...params);
  const expense = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM records ${whereAnd} type='expense'`).get(...params);
  const byCategory = db.prepare(`SELECT category, type, SUM(amount) as total FROM records ${whereAnd} 1=1 GROUP BY category, type ORDER BY total DESC`).all(...params);
  const byMonth = db.prepare(`SELECT strftime('%Y-%m', record_date) as month, type, SUM(amount) as total FROM records ${whereAnd} 1=1 GROUP BY month, type ORDER BY month ASC`).all(...params);

  res.json({ totalIncome: income.total, totalExpense: expense.total, balance: income.total - expense.total, byCategory, byMonth });
});

// 详情
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT r.*, e.name AS entity_name FROM records r LEFT JOIN entities e ON r.entity_id=e.id WHERE r.id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '记录不存在' });
  res.json(row);
});

// 创建
router.post('/', (req, res) => {
  const { entity_id, type, amount, category, payee_payer, income_type, summary, remark, record_date, invoice_id } = req.body;
  if (!entity_id || !type || !record_date) return res.status(400).json({ error: 'entity_id, type, record_date 必填' });
  const id = uuidv4();
  db.prepare(`INSERT INTO records (id, entity_id, type, amount, category, payee_payer, income_type, summary, remark, record_date, invoice_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, entity_id, type, amount || 0, category || '', payee_payer || '', income_type || '', summary || '', remark || '', record_date, invoice_id || null);
  res.status(201).json(db.prepare('SELECT r.*, e.name AS entity_name FROM records r LEFT JOIN entities e ON r.entity_id=e.id WHERE r.id=?').get(id));
});

// 更新
router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM records WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '记录不存在' });
  const { entity_id, type, amount, category, payee_payer, income_type, summary, remark, record_date, invoice_id } = req.body;
  db.prepare(`UPDATE records SET entity_id=?, type=?, amount=?, category=?, payee_payer=?, income_type=?, summary=?, remark=?, record_date=?, invoice_id=?, updated_at=datetime('now') WHERE id=?`)
    .run(entity_id || row.entity_id, type || row.type, amount ?? row.amount, category ?? row.category,
      payee_payer ?? row.payee_payer, income_type ?? row.income_type, summary ?? row.summary, remark ?? row.remark,
      record_date || row.record_date, invoice_id !== undefined ? invoice_id : row.invoice_id, req.params.id);
  res.json(db.prepare('SELECT r.*, e.name AS entity_name FROM records r LEFT JOIN entities e ON r.entity_id=e.id WHERE r.id=?').get(req.params.id));
});

// 批量导入
router.post('/import', (req, res) => {
  const { entity_id, records: importRecords } = req.body;
  if (!entity_id || !Array.isArray(importRecords)) return res.status(400).json({ error: 'entity_id 和 records[] 必填' });
  const insert = db.prepare('INSERT INTO records (id, entity_id, type, amount, category, payee_payer, income_type, summary, remark, record_date) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const tx = db.transaction((items) => {
    const ids = [];
    for (const item of items) {
      const id = uuidv4();
      insert.run(id, entity_id, item.type || 'expense', Number(item.amount) || 0, item.category || '',
        item.payee_payer || '', item.income_type || '', item.summary || '', item.remark || '',
        item.record_date || new Date().toISOString().slice(0, 10));
      ids.push(id);
    }
    return ids;
  });
  const ids = tx(importRecords);
  const rows = db.prepare(`SELECT r.*, e.name AS entity_name FROM records r LEFT JOIN entities e ON r.entity_id=e.id WHERE r.id IN (${ids.map(()=>'?').join(',')})`).all(...ids);
  res.status(201).json({ imported: ids.length, rows });
});

// 批量删除
router.post('/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids[] 必填' });
  const stmt = db.prepare('DELETE FROM records WHERE id = ?');
  db.transaction((idList) => { for (const id of idList) stmt.run(id); })(ids);
  res.json({ deleted: ids.length });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM records WHERE id=?').get(req.params.id)) return res.status(404).json({ error: '记录不存在' });
  db.prepare('DELETE FROM records WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
