const { Router } = require('express');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { upload, UPLOADS_DIR } = require('../storage');
const { parseFile } = require('../services/parser');
const path = require('path');
const fs = require('fs');

const router = Router();

// 列表
router.get('/', (req, res) => {
  const { entity_id } = req.query;
  const rows = entity_id
    ? db.prepare('SELECT * FROM files WHERE entity_id = ? ORDER BY created_at DESC').all(entity_id)
    : db.prepare('SELECT * FROM files ORDER BY created_at DESC').all();
  res.json(rows);
});

// 上传文件 + 自动解析
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { entity_id } = req.body;
    if (!req.file) return res.status(400).json({ error: '请上传文件' });

    const mimetype = req.file.mimetype;
    let fileType = 'other';
    if (mimetype.includes('spreadsheet') || mimetype.includes('excel') || req.file.originalname.match(/\.xlsx?$/i)) fileType = 'excel';
    else if (mimetype.includes('csv') || req.file.originalname.match(/\.csv$/i)) fileType = 'csv';
    else if (mimetype.includes('word') || mimetype.includes('document') || req.file.originalname.match(/\.docx?$/i)) fileType = 'docx';
    else if (mimetype.startsWith('image/')) fileType = 'image';
    else if (mimetype === 'application/pdf') fileType = 'pdf';

    // 解析文件内容
    let parsedData = '';
    if (['excel', 'csv', 'docx'].includes(fileType)) {
      try {
        const result = await parseFile(req.file.path, mimetype);
        parsedData = JSON.stringify(result);
      } catch (e) { console.error('解析失败:', e.message); }
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO files (id, entity_id, filename, original_name, mime_type, size, file_type, parsed_data)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(id, entity_id || null, req.file.filename, req.file.originalname, mimetype, req.file.size, fileType, parsedData);

    const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取解析结果
router.get('/:id/parsed', (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '文件不存在' });
  if (!row.parsed_data) return res.json({ columns: [], rows: [] });
  res.json(JSON.parse(row.parsed_data));
});

// 删除
router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '文件不存在' });
  try { fs.unlinkSync(path.join(UPLOADS_DIR, row.filename)); } catch {}
  db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
