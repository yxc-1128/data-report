const { Router } = require('express');
const { db } = require('../db');

const router = Router();

// 仪表盘汇总数据 — cards 始终全量，byYear 始终全量年份
router.get('/dashboard', (req, res) => {
  const { entity_id } = req.query;

  let cardWhere = '';
  const cardParams = [];
  if (entity_id) { cardWhere = 'WHERE entity_id = ?'; cardParams.push(entity_id); }
  const cardAnd = cardWhere ? cardWhere + ' AND' : 'WHERE';

  const income = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM records ${cardAnd} type='income'`).get(...cardParams);
  const expense = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM records ${cardAnd} type='expense'`).get(...cardParams);
  const byCategory = db.prepare(`SELECT category, type, SUM(amount) as total FROM records ${cardAnd} 1=1 GROUP BY category, type ORDER BY total DESC`).all(...cardParams);
  const byMonth = db.prepare(`SELECT strftime('%Y-%m', record_date) as month, type, SUM(amount) as total FROM records ${cardAnd} 1=1 GROUP BY month, type ORDER BY month ASC`).all(...cardParams);
  const byYear = db.prepare(`SELECT strftime('%Y', record_date) as year, type, SUM(amount) as total FROM records ${cardWhere} GROUP BY year, type ORDER BY year ASC`).all(...cardParams);

  res.json({ totalIncome: income.total, totalExpense: expense.total, balance: income.total - expense.total, byCategory, byMonth, byYear });
});

// 导出 Excel
router.get('/excel', (req, res) => {
  try {
    const { entity_id, start_date, end_date, month, type } = req.query;
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

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const rows = db.prepare(`
      SELECT r.record_date, r.type, r.amount, r.category, r.payee_payer, r.income_type, r.summary, r.remark, e.name as entity_name
      FROM records r LEFT JOIN entities e ON r.entity_id = e.id
      ${where} ORDER BY r.record_date DESC
    `).all(...params);

    const XLSX = require('xlsx');
    const data = rows.map(r => ({
      '日期': r.record_date || '',
      '类型': r.type === 'income' ? '收入' : '支出',
      '金额': r.amount || 0,
      '分类': r.category || '',
      '收款-付款单位': r.payee_payer || '',
      '收入-支付类型': r.income_type || '',
      '详情': r.summary || '',
      '备注': r.remark || '',
      '单位': r.entity_name || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:12},{wch:8},{wch:14},{wch:14},{wch:18},{wch:14},{wch:30},{wch:20},{wch:16}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'shouzhi');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = 'shouzhi-' + new Date().toISOString().slice(0,10) + '.xlsx';
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="' + encodeURIComponent(filename) + '"',
      'Content-Length': String(buf.length)
    });
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
