const { Router } = require('express');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

const router = Router();

// 列表
router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM entities ORDER BY created_at DESC').all();
  res.json(rows);
});

// 详情
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '单位不存在' });
  res.json(row);
});

// 创建
router.post('/', (req, res) => {
  const { name, code, description } = req.body;
  if (!name) return res.status(400).json({ error: '名称必填' });
  const id = uuidv4();
  db.prepare('INSERT INTO entities (id, name, code, description) VALUES (?,?,?,?)').run(id, name, code || '', description || '');
  res.status(201).json(db.prepare('SELECT * FROM entities WHERE id = ?').get(id));
});

// 更新
router.put('/:id', (req, res) => {
  const { name, code, description } = req.body;
  const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '单位不存在' });
  db.prepare('UPDATE entities SET name=?,code=?,description=?,updated_at=datetime(\'now\') WHERE id=?')
    .run(name || row.name, code ?? row.code, description ?? row.description, req.params.id);
  res.json(db.prepare('SELECT * FROM entities WHERE id = ?').get(req.params.id));
});

// 删除
router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '单位不存在' });
  db.prepare('DELETE FROM entities WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
