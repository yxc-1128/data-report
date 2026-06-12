const XLSX = require('xlsx');
const { parse: csvParse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');

/**
 * Excel/CSV 智能解析器
 *
 * 策略：
 * 1. 从第0行开始找表头行（含关键词如"日期/金额/收入/支出/摘要/分类"的行）
 * 2. 找不到则取第一个非全空行
 * 3. 合并单元格展开
 * 4. 跳过完全空行
 */

const HEADER_KEYWORDS = [
  ['日期','时间','date','time','月','日'],
  ['金额','费用','元','amount','money','价格','价'],
  ['类型','收支','income','expense','收入','支出','进出'],
  ['摘要','说明','备注','事由','用途','内容','描述','summary','remark'],
  ['分类','类别','科目','category','type','sort'],
];

/** 评分某行作为表头的匹配度 */
function scoreAsHeader(row) {
  if (!row || !row.length) return 0;
  const text = row.map(c => String(c || '').toLowerCase().trim()).join(' ');
  let score = 0;
  for (const group of HEADER_KEYWORDS) {
    for (const kw of group) {
      if (text.includes(kw)) { score += 1; break; }
    }
  }
  return score;
}

function parseExcel(filepath) {
  const wb = XLSX.readFile(filepath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // 读取为数组，defval: null 保留空值用于检测
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false, dateNF: 'yyyy-mm-dd' });
  if (!raw.length) return { columns: [], rows: [], sheetNames: wb.SheetNames };

  return extractFromRaw(raw);
}

function parseCsv(filepath) {
  const text = fs.readFileSync(filepath, 'utf-8');
  const raw = csvParse(text, { skip_empty_lines: false, relax_column_count: true });
  if (!raw.length) return { columns: [], rows: [] };
  return extractFromRaw(raw);
}

function extractFromRaw(raw) {
  const totalRows = raw.length;

  // 1. 找最佳表头行（前 8 行内找最高分）
  let headerIdx = 0;
  let bestScore = -1;
  const searchLimit = Math.min(8, raw.length);
  for (let i = 0; i < searchLimit; i++) {
    const s = scoreAsHeader(raw[i]);
    if (s > bestScore) { bestScore = s; headerIdx = i; }
  }

  // 得分太低说明可能没有标准表头，用第一行
  if (bestScore < 2) {
    // 找第一个非全空行当表头
    for (let i = 0; i < searchLimit; i++) {
      if (raw[i] && raw[i].some(c => c !== null && String(c).trim())) {
        headerIdx = i;
        break;
      }
    }
  }

  // 2. 表头规范化
  const headerRow = raw[headerIdx] || [];
  const colCount = headerRow.length || 1;
  const columns = headerRow.map((c, i) => {
    const s = (c !== null && c !== undefined) ? String(c).trim() : '';
    return s || `列${i + 1}`;
  });

  // 3. 取数据行（表头之后，跳过全空行）
  const rows = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row) continue;
    // 填充到列数
    const filled = [];
    for (let j = 0; j < colCount; j++) {
      const v = row[j];
      filled.push(v !== null && v !== undefined ? String(v).trim() : '');
    }
    // 跳过全空
    if (filled.every(c => !c)) continue;
    rows.push(filled);
  }

  return {
    columns,
    rows,
    headerRowIndex: headerIdx,
    totalRows
  };
}

async function parseDocx(filepath) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filepath });
  const lines = result.value.split('\n').filter(l => l.trim());
  const rows = lines.map(line => [line.trim()]);
  return { columns: ['内容'], rows };
}

async function parseFile(filepath, mimetype) {
  const ext = (mimetype || '').toLowerCase();
  if (ext.includes('spreadsheet') || ext.includes('excel') || filepath.match(/\.xlsx?$/i)) {
    return parseExcel(filepath);
  }
  if (ext.includes('csv') || filepath.match(/\.csv$/i)) {
    return parseCsv(filepath);
  }
  if (ext.includes('word') || ext.includes('document') || filepath.match(/\.docx?$/i)) {
    return parseDocx(filepath);
  }
  try {
    const text = fs.readFileSync(filepath, 'utf-8');
    const lines = text.split('\n').filter(l => l.trim());
    return { columns: ['内容'], rows: lines.map(l => [l.trim()]) };
  } catch {
    return { columns: [], rows: [] };
  }
}

module.exports = { parseFile, parseExcel, parseCsv, parseDocx };
