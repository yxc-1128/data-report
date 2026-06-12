const PDFDocument = require('pdfkit');

/**
 * 生成收支报表 PDF
 */
function generateReportPDF({ entity, records, startDate, endDate, totalIncome, totalExpense }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // 标题
    doc.fontSize(20).text('财务收支报表', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`单位: ${entity?.name || '全部'}`, { align: 'center' });
    if (startDate && endDate) {
      doc.fontSize(10).text(`日期范围: ${startDate} ~ ${endDate}`, { align: 'center' });
    }
    doc.moveDown();

    // 汇总
    doc.fontSize(14).text('汇总');
    doc.moveDown(0.3);
    doc.fontSize(11).text(`总收入: ¥${totalIncome.toFixed(2)}    总支出: ¥${totalExpense.toFixed(2)}    结余: ¥${(totalIncome - totalExpense).toFixed(2)}`);
    doc.moveDown();

    // 明细表
    doc.fontSize(14).text('收支明细');
    doc.moveDown(0.3);

    const tableTop = doc.y;
    const colX = [50, 120, 180, 240, 360, 450];
    const headers = ['日期', '类型', '金额', '分类', '摘要', '单位'];

    doc.fontSize(9);
    headers.forEach((h, i) => doc.text(h, colX[i], tableTop));
    doc.moveDown(0.5);

    let y = doc.y;
    doc.fontSize(8);
    for (const r of records) {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
      const row = [
        r.record_date || '',
        r.type === 'income' ? '收入' : '支出',
        `¥${Number(r.amount).toFixed(2)}`,
        r.category || '',
        (r.summary || '').slice(0, 20),
        r.entity_name || ''
      ];
      row.forEach((t, i) => doc.text(t, colX[i], y, { width: colX[i + 1] ? colX[i + 1] - colX[i] - 5 : 100 }));
      y += 16;
    }

    doc.moveDown(2);
    doc.fontSize(8).text(`报表生成时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'right' });

    doc.end();
  });
}

module.exports = { generateReportPDF };
