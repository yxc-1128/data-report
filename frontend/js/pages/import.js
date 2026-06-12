// 文件导入页面 v2 — 智能表头检测 + 灵活列映射
const PageImport = {

  async render() {
    await Store.loadFiles();
    await Store.loadEntities();

    const html = `
      <div class="card">
        <div class="card-header">
          <h3>📥 文件导入（Excel / CSV）</h3>
          <button class="btn btn-primary btn-sm" onclick="PageImport.showUpload()">+ 上传文件</button>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">
          支持 .xlsx / .xls / .csv — 上传后自动智能识别表头和数据行，可手动调整映射后批量导入。
        </div>

        <div class="table-wrap">
          <table class="mobile-table">
            <thead><tr>
              <th>文件名</th><th>类型</th><th>大小</th><th>所属单位</th><th>时间</th><th>操作</th>
            </tr></thead>
            <tbody>
              ${Store.files.map(f => `
                <tr>
                  <td data-label="文件名" title="${escHtml(f.original_name)}">${escHtml(f.original_name.slice(0, 35))}</td>
                  <td data-label="类型"><span style="background:var(--accent);color:#000;padding:2px 8px;border-radius:4px;font-size:11px;">${f.file_type.toUpperCase()}</span></td>
                  <td data-label="大小">${(f.size/1024).toFixed(1)} KB</td>
                  <td data-label="所属单位" class="mob-hide">${escHtml(Store.entities.find(e=>e.id===f.entity_id)?.name||'-')}</td>
                  <td data-label="时间" class="mob-hide">${f.created_at?.slice(0,10)||''}</td>
                  <td data-label="操作">
                    <button class="btn btn-outline btn-sm" onclick="PageImport.previewAndImport('${f.id}')">📋 预览导入</button>
                    <a class="btn btn-outline btn-sm" href="/uploads/${f.filename}" download>下载</a>
                    <button class="btn btn-danger btn-sm" onclick="PageImport.del('${f.id}')">删除</button>
                  </td>
                </tr>
              `).join('')}
              ${Store.files.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px;">暂无文件，请上传 Excel 或 CSV</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('page-import').innerHTML = html;
  },

  showUpload() {
    const html = `
      <h3>上传文件</h3>
      <div class="form-group">
        <label>所属单位</label>
        <select id="imp-entity">${Store.entities.map(e => `<option value="${e.id}">${escHtml(e.name)}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label>选择文件</label>
        <input type="file" id="imp-file" accept=".xlsx,.xls,.csv" style="padding:20px;text-align:center;border:2px dashed var(--border);">
      </div>
      <div style="font-size:11px;color:var(--text-muted);">支持 .xlsx / .xls / .csv，最大 50MB</div>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="PageImport.upload()">上传并解析</button>
      </div>
    `;
    Modal.show(html);
  },

  async upload() {
    const fileEl = document.getElementById('imp-file');
    const file = fileEl.files[0];
    if (!file) { Toast.show('请选择文件', 'error'); return; }
    const entityId = document.getElementById('imp-entity').value;
    if (!entityId) { Toast.show('请选择所属单位', 'error'); return; }
    try {
      const result = await API.upload('/files/upload', file, { entity_id: entityId });
      Toast.show('文件上传成功' + (result.parsed_data ? '，已自动解析' : ''));
      Modal.close();
      this.render();
    } catch (e) {
      Toast.show(e.message, 'error');
    }
  },

  async previewAndImport(fileId) {
    try {
      const parsed = await API.get('/files/' + fileId + '/parsed');
      const file = Store.files.find(f => f.id === fileId);
      if (!parsed || !parsed.columns || parsed.columns.length === 0) {
        Toast.show('该文件无法解析出表格数据', 'error');
        return;
      }
      this._currentFileId = fileId;
      this._currentParsed = parsed;
      this._currentEntityId = file.entity_id;

      const showRows = Math.min(parsed.rows.length, 30);

      let html = `<h3>预览: ${escHtml(file?.original_name || '')}</h3>`;
      html += `<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
        自动检测表头位于第 ${(parsed.headerRowIndex || 0) + 1} 行，共 ${parsed.columns.length} 列、${parsed.rows.length} 行数据
      </div>`;

      // 数据预览表格（限显示前30行）
      html += `<div class="table-wrap" style="max-height:280px;overflow:auto;margin-bottom:16px;"><table style="font-size:11px;"><thead><tr>`;
      html += `<th style="position:sticky;top:0;z-index:2;">行号</th>`;
      parsed.columns.forEach((c, i) => {
        html += `<th style="position:sticky;top:0;z-index:2;">${escHtml(c)} <br><small style="color:var(--accent);">列${i+1}</small></th>`;
      });
      html += `</tr></thead><tbody>`;
      for (let ri = 0; ri < showRows; ri++) {
        const row = parsed.rows[ri];
        html += `<tr><td style="color:var(--text-muted);">${ri + 1}</td>`;
        parsed.columns.forEach((_, ci) => {
          const val = row[ci] || '';
          html += `<td>${escHtml(val.slice(0, 40))}</td>`;
        });
        html += `</tr>`;
      }
      html += `</tbody></table></div>`;
      if (parsed.rows.length > showRows) {
        html += `<div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">仅显示前 ${showRows} 行（共 ${parsed.rows.length} 行），导入全部数据</div>`;
      }

      // 导入类型选择 + 列映射
      const sampleRow = parsed.rows[0] || [];
      html += `<div style="background:var(--bg);border-radius:8px;padding:14px;margin-bottom:12px;">`;
      html += `<div style="font-size:13px;font-weight:600;margin-bottom:10px;">🔗 导入设置 & 列映射</div>`;

      // 类型选择
      html += `<div class="form-group" style="margin-bottom:12px;">
        <label>导入为</label>
        <select id="imp-batch-type" style="font-size:14px;font-weight:600;">
          <option value="income">💰 收入表（全部行作为收入记录）</option>
          <option value="expense">💸 支出表（全部行作为支出记录）</option>
        </select>
      </div>`;

      html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">`;
      html += this._colSelect('日期列', parsed.columns, 'date', sampleRow);
      html += this._colSelect('金额列', parsed.columns, 'amount', sampleRow);
      html += this._colSelect('分类列', parsed.columns, 'category', sampleRow);
      html += this._colSelect('付款/收款单位', parsed.columns, 'payee_payer', sampleRow);
      html += this._colSelect('收入/支付类型', parsed.columns, 'income_type', sampleRow);
      html += this._colSelect('详情', parsed.columns, 'summary', sampleRow);
      html += this._colSelect('备注', parsed.columns, 'remark', sampleRow);
      html += `</div>`;
      html += `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">
        💡 若导入为收入表，所有行统一标记为「收入」；若导入为支出表，统一标记为「支出」。
      </div></div>`;

      // 确定按钮
      html += `<div class="modal-actions">
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="PageImport.doImport()">✅ 导入这 ${parsed.rows.length} 行为收支记录</button>
      </div>`;
      Modal.show(html);

      // 智能预选列
      setTimeout(() => this._autoDetect(parsed.columns), 100);
    } catch (e) {
      Toast.show(e.message, 'error');
    }
  },

  /** 用关键词自动匹配列 */
  _autoDetect(columns) {
    const lower = columns.map(c => c.toLowerCase());
    const maps = {
      date: ['日期', '时间', 'date', 'time', '年月', '年', '月', '日'],
      amount: ['金额', '费用', '元', 'amount', 'money', '价格', '价', '收入', '支出'],
      category: ['分类', '类别', '科目', 'category', 'sort', '种类'],
      payee_payer: ['单位', '公司', '客户', '对方', '收款', '付款', '厂商'],
      income_type: ['类型', '方式', '渠道', '来源', '性质'],
      summary: ['摘要', '说明', '事由', '用途', '内容', '描述', '详情', 'summary', 'remark'],
      remark: ['备注', '附注', 'note']
    };
    Object.entries(maps).forEach(([key, keywords]) => {
      for (let i = 0; i < columns.length; i++) {
        const col = lower[i];
        for (const kw of keywords) {
          if (col.includes(kw)) {
            const el = document.getElementById('imp-map-' + key);
            if (el) el.value = i;
            return;
          }
        }
      }
    });
  },

  _colSelect(label, columns, key, sampleRow) {
    let html = `<div class="form-group"><label>${label}</label><select id="imp-map-${key}" style="font-size:12px;"><option value="">— 不映射 —</option>`;
    columns.forEach((c, i) => {
      const sample = sampleRow ? String(sampleRow[i] || '').slice(0, 30) : '';
      html += `<option value="${i}">列${i+1}: ${escHtml(c)}${sample ? ' — 「' + escHtml(sample) + '」' : ''}</option>`;
    });
    html += `</select></div>`;
    return html;
  },

  async doImport() {
    const parsed = this._currentParsed;
    const entityId = this._currentEntityId;
    if (!parsed) return;

    const getIdx = key => {
      const el = document.getElementById('imp-map-' + key);
      return el && el.value !== '' ? parseInt(el.value) : -1;
    };

    const batchType = document.getElementById('imp-batch-type')?.value || 'expense';
    const dateIdx = getIdx('date');
    const amountIdx = getIdx('amount');
    const categoryIdx = getIdx('category');
    const payeePayerIdx = getIdx('payee_payer');
    const incomeTypeIdx = getIdx('income_type');
    const summaryIdx = getIdx('summary');
    const remarkIdx = getIdx('remark');

    const records = [];
    let skipped = 0;
    for (const row of parsed.rows) {
      let amount = 0;
      if (amountIdx >= 0 && row[amountIdx]) {
        amount = Math.abs(parseFloat(String(row[amountIdx]).replace(/[,，\s¥￥元]/g, '')) || 0);
      }
      if (amount === 0) skipped++;

      records.push({
        type: batchType,
        amount,
        category: categoryIdx >= 0 ? String(row[categoryIdx] || '').trim() : '',
        payee_payer: payeePayerIdx >= 0 ? String(row[payeePayerIdx] || '').trim() : '',
        income_type: incomeTypeIdx >= 0 ? String(row[incomeTypeIdx] || '').trim() : '',
        summary: summaryIdx >= 0 ? String(row[summaryIdx] || '').trim() : '',
        remark: remarkIdx >= 0 ? String(row[remarkIdx] || '').trim() : '',
        record_date: dateIdx >= 0 ? formatDate(row[dateIdx]) : new Date().toISOString().slice(0, 10)
      });
    }

    if (records.length === 0) {
      Toast.show('没有有效数据', 'error');
      return;
    }

    try {
      const result = await API.post('/records/import', { entity_id: entityId, records });
      const msg = skipped > 0
        ? `✅ 导入 ${result.imported} 条（${skipped} 条金额为 0 也导入了）`
        : `✅ 成功导入 ${result.imported} 条记录！`;
      Toast.show(msg);
      Modal.close();
      PageDashboard.render();
      App.navigate('records');
    } catch (e) {
      Toast.show(e.message, 'error');
    }
  },

  async del(id) {
    if (!confirm('确认删除文件？')) return;
    await API.del('/files/' + id);
    Toast.show('已删除');
    this.render();
  }
};

// 日期格式化
function formatDate(val) {
  if (!val) return new Date().toISOString().slice(0, 10);
  const s = String(val).trim();
  // Excel 日期序列号（如 45123）
  if (/^\d{4,5}$/.test(s)) {
    const d = new Date((parseInt(s) - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // yyyy-mm-dd / yyyy/mm/dd / yyyy年mm月dd日
  const m = s.match(/(\d{4})[年\-\/.](\d{1,2})/);
  if (m) {
    const dayMatch = s.match(/[日\-\/.](\d{1,2})/);
    const day = dayMatch ? dayMatch[1] : '01';
    return `${m[1]}-${m[2].padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  return s.slice(0, 10);
}
