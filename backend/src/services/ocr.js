const fs = require('fs');

// 尝试用 pdf-parse 提取 PDF 文本
async function extractPdfText(filepath) {
  try {
    const pdfParse = require('pdf-parse');
    const buf = fs.readFileSync(filepath);
    const data = await pdfParse(buf);
    return data.text || '';
  } catch (e) { return ''; }
}

// 图片 OCR
async function ocrImage(filepath) {
  try {
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('chi_sim+eng', 1, { logger: () => {} });
    const { data } = await worker.recognize(filepath);
    await worker.terminate();
    return data.text || '';
  } catch (e) { return ''; }
}

/** 主入口 */
async function recognizeInvoice(filepath, mimetype) {
  let text = '';
  if (mimetype === 'application/pdf' || filepath.match(/\.pdf$/i)) {
    text = await extractPdfText(filepath);
  }
  if (!text && (mimetype.startsWith('image/') || /\.(png|jpg|jpeg|bmp|webp)$/i.test(filepath))) {
    text = await ocrImage(filepath);
  }
  if (!text) return { text:'', invoiceNumber:'', buyerName:'', sellerName:'', amount:null, date:null };

  // 规范化：合并多余空白，但保留换行用于区段分割
  const normalized = text.replace(/[ \t]+/g, '').replace(/\n{3,}/g, '\n\n');
  return {
    text: text.trim(),
    invoiceNumber: extractInvoiceNumber(normalized),
    buyerName: extractBuyerSeg(normalized),
    sellerName: extractSellerSeg(normalized),
    amount: extractAmountSmart(normalized),
    date: extractDate(normalized)
  };
}

/** 发票号码：10-20位纯数字（PDF中常被空格打散，已规范化） */
function extractInvoiceNumber(text) {
  // 优先匹配 "发票号码" 后面的长数字
  let m = text.match(/发票号码[：:\s]*(\d{10,20})/);
  if (m) return m[1];
  // 次选 "No" 后面的
  m = text.match(/No[：:\s]*(\d{10,20})/);
  if (m) return m[1];
  // 最后找文本末尾附近的长数字串
  m = text.match(/(\d{12,20})/);
  if (m && !/^20\d{2}[01]\d[0-3]\d/.test(m[1])) return m[1];
  return '';
}

/** 购买方：用 "购买方" 定位区段，然后找到公司实体名称 */
function extractBuyerSeg(text) {
  return extractEntityInSegment(text, /购[买貨]方/, 200);
}

/** 销售方：用 "销售方" 定位区段 */
function extractSellerSeg(text) {
  return extractEntityInSegment(text, /销[售貨]方/, 200);
}

/** 在关键词后 N 字符内提取公司/实体名称 */
function extractEntityInSegment(text, keywordRegex, range) {
  const idx = text.search(keywordRegex);
  if (idx < 0) return '';
  const segment = text.slice(idx, idx + range);

  // 公司名特征：2-8个汉字 + (有限)公司/服务部/经营部/商行/企业/中心/事务所/合伙
  const m = segment.match(/[\u4e00-\u9fff（）\(\)·]{2,12}(?:有限(?:责任)?公司|有限公司|股份有限|服务部|经营部|商行|企业|中心|事务所|合伙|工作室|工厂)/);
  if (m) return m[0];

  // 纯公司名关键词
  const m2 = segment.match(/[\u4e00-\u9fff（）\(\)]{4,30}(?:公司|集团|部|行|企|中心|合伙)/);
  if (m2) return m2[0];

  // fallback: 在 "名称" 之后找
  const m3 = segment.match(/名称[：:\s]*([\u4e00-\u9fff（）\(\)·]{4,40})/);
  if (m3) return m3[1].trim();

  return '';
}

/** 金额：找最大金额数字（通常是价税合计） */
function extractAmountSmart(text) {
  // 收集所有金额
  const amounts = [];
  const pattern = /¥\s*(\d{1,10}(?:\.\d{1,2})?)/g;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    amounts.push(parseFloat(m[1]));
  }
  // 也收集 "数字.数字" 格式
  const pattern2 = /(\d{2,10}\.\d{2})/g;
  while ((m = pattern2.exec(text)) !== null) {
    amounts.push(parseFloat(m[1]));
  }

  if (amounts.length === 0) return null;
  // 取最大值（发票中总金额最大）
  return Math.max(...amounts);
}

/** 日期：开票日期优先 */
function extractDate(text) {
  // 开票日期
  let m = text.match(/开票日期[：:\s]*(\d{4})[年\-\/.]\s*(\d{1,2})[月\-\/.]\s*(\d{1,2})/);
  if (m) return fixedDate(m);
  // 日期
  m = text.match(/日期[：:\s]*(\d{4})[年\-\/.]\s*(\d{1,2})/);
  if (m) {
    const day = (text.slice(m.index).match(/[月\-\/.]\s*(\d{1,2})/)||[])[1] || '01';
    return `${m[1]}-${m[2].padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  // 通用日期
  m = text.match(/(\d{4})[年\-\/.]\s*(\d{1,2})[月\-\/.]\s*(\d{1,2})/);
  if (m) return fixedDate(m);
  return null;
}

function fixedDate(m) {
  return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
}

module.exports = { recognizeInvoice };
