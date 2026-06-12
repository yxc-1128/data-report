// 发票管理页面 v2.6.8 — 搜索+已付/未付+总金额+批量切换+缩略图(图片/PDF)
const PageInvoices = {

  thumb(inv) {
    const isImg = inv.mime_type && inv.mime_type.startsWith('image/');
    return isImg
      ? `<a href="/uploads/${inv.filename}" target="_blank"><img src="/uploads/${inv.filename}" style="width:45px;height:45px;object-fit:cover;border-radius:4px;border:1px solid var(--border);" loading="lazy"></a>`
      : `<a href="/uploads/${inv.filename}" target="_blank" style="font-size:22px;text-decoration:none;">📄</a>`;
  },

  async render() {
    await Store.loadInvoices();
    await Store.loadEntities();

    const status = Store.invStatus;
    const keyword = Store.invKeyword;
    const total = Store.invTotalAmount || 0;
    const rows = Store.invoices || [];

    const html = `
      <div class="card">
        <div class="card-header">
          <h3>发票管理</h3>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="PageInvoices.showUpload()">+ 上传发票</button>
          </div>
        </div>

        <!-- 搜索 + 状态筛选 + 总金额 -->
        <div class="toolbar" style="margin-bottom:10px;">
          <input type="text" id="inv-keyword" placeholder="🔍 搜索购买方/销售方/发票号码..." value="${escHtml(keyword)}" onkeydown="if(event.key==='Enter')PageInvoices.onSearch()" style="flex:1;">
          <button class="btn btn-primary btn-sm" onclick="PageInvoices.onSearch()">搜索</button>
        </div>

        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
          <button class="btn btn-sm ${status===''?'btn-primary':'btn-outline'}" onclick="PageInvoices.setStatus('')">全部</button>
          <button class="btn btn-sm ${status==='unpaid'?'btn-primary':'btn-outline'}" onclick="PageInvoices.setStatus('unpaid')" style="${status==='unpaid'?'background:#ef5350;':''}">⚠ 未付</button>
          <button class="btn btn-sm ${status==='paid'?'btn-primary':'btn-outline'}" onclick="PageInvoices.setStatus('paid')" style="${status==='paid'?'background:#4caf50;':''}">✅ 已付</button>

          <button class="btn btn-outline btn-sm" onclick="PageInvoices.batchToggle('paid')" style="margin-left:auto;">✅ 标记已付</button>
          <button class="btn btn-outline btn-sm" onclick="PageInvoices.batchToggle('unpaid')">⚠ 标记未付</button>

          <span style="font-size:13px;color:var(--text-muted);margin-left:8px;">
            ${rows.length} 条 · 合计 <strong style="color:var(--accent);">¥${Number(total).toFixed(2)}</strong>
          </span>
        </div>

        <div class="table-wrap">
          <table class="mobile-table">
            <thead><tr>
              <th style="width:28px;"><input type="checkbox" id="inv-select-all" onchange="PageInvoices.toggleAll(this)"></th>
              <th style="width:55px;">缩略图</th>
              <th>发票号码</th><th>购买方</th><th>销售方</th><th>金额</th><th>日期</th><th>状态</th><th>关联</th><th>操作</th>
            </tr></thead>
            <tbody>
              ${rows.map(inv => `
                <tr>
                  <td data-label="选"><input type="checkbox" class="inv-cb" value="${inv.id}"></td>
                  <td data-label="缩略图">${PageInvoices.thumb(inv)}</td>
                  <td data-label="发票号码"><strong>${escHtml(inv.invoice_number || '-')}</strong></td>
                  <td data-label="购买方">${escHtml(inv.buyer_name || '-')}</td>
                  <td data-label="销售方" class="mob-hide">${escHtml(inv.seller_name || '-')}</td>
                  <td data-label="金额">${inv.ocr_amount ? '¥' + Number(inv.ocr_amount).toFixed(2) : '-'}</td>
                  <td data-label="日期">${inv.ocr_date || '-'}</td>
                  <td data-label="状态">
                    <button class="btn btn-sm ${inv.status==='paid'?'btn-primary':'btn-outline'}" style="font-size:11px;padding:3px 8px;${inv.status==='paid'?'background:#4caf50;':''}" onclick="PageInvoices.toggleOne('${inv.id}','${inv.status==='paid'?'unpaid':'paid'}')">${inv.status==='paid'?'已付':'未付'}</button>
                  </td>
                  <td data-label="关联">${inv.record_id ? '✅' : '⚠'}</td>
                  <td data-label="操作">
                    <button class="btn btn-outline btn-sm" onclick="PageInvoices.showLink('${inv.id}')">关联</button>
                    <button class="btn btn-outline btn-sm" onclick="PageInvoices.showDetail('${inv.id}')">详情</button>
                    <a class="btn btn-outline btn-sm" href="/uploads/${inv.filename}" download>下载</a>
                    <button class="btn btn-danger btn-sm" onclick="PageInvoices.del('${inv.id}')">删除</button>
                  </td>
                </tr>
              `).join('')}
              ${rows.length === 0 ? '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:40px;">暂无发票</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('page-invoices').innerHTML = html;
  },

  onSearch() {
    Store.invKeyword = document.getElementById('inv-keyword')?.value || '';
    this.render();
  },

  setStatus(s) {
    Store.invStatus = s;
    this.render();
  },

  toggleAll(el) {
    document.querySelectorAll('.inv-cb').forEach(cb => { cb.checked = el.checked; });
  },

  async batchToggle(status) {
    const ids = [...document.querySelectorAll('.inv-cb:checked')].map(cb => cb.value);
    if (ids.length === 0) { Toast.show('请先勾选发票', 'error'); return; }
    await API.post('/invoices/batch-status', { ids, status });
    Toast.show(`已标记 ${ids.length} 条为 ${status === 'paid' ? '已付' : '未付'}`);
    this.render();
  },

  async toggleOne(id, status) {
    await API.put('/invoices/' + id, { status });
    this.render();
  },

  showUpload() {
    const html = `
      <h3>上传发票（自动 OCR 识别）</h3>
      <div class="form-group">
        <label>所属单位</label>
        <select id="inv-entity">
          <option value="">不关联</option>
          ${Store.entities.map(e => `<option value="${e.id}">${escHtml(e.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>发票文件</label>
        <input type="file" id="inv-file" accept=".pdf,.png,.jpg,.jpeg,.bmp,.webp" style="padding:20px;text-align:center;border:2px dashed var(--border);">
      </div>
      <div style="font-size:11px;color:var(--text-muted);">支持 PDF（电子发票）和图片，自动识别购买方、销售方、金额、日期、发票号码</div>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="PageInvoices.upload()">上传并识别</button>
      </div>
    `;
    Modal.show(html);
  },

  async upload() {
    const fileEl = document.getElementById('inv-file');
    const file = fileEl.files[0];
    if (!file) { Toast.show('请选择文件', 'error'); return; }
    const entityId = document.getElementById('inv-entity').value;
    try {
      await API.upload('/invoices/upload', file, { entity_id: entityId });
      Toast.show('发票上传成功，OCR 识别完成');
      Modal.close(); this.render();
    } catch (e) { Toast.show(e.message, 'error'); }
  },

  showDetail(id) {
    const inv = Store.invoices.find(i => i.id === id);
    if (!inv) return;
    const html = `
      <h3>发票详情（可编辑）</h3>
      <div class="form-group"><label>发票号码</label><input type="text" id="inv-edit-number" value="${escHtml(inv.invoice_number||'')}" placeholder="未识别"></div>
      <div class="form-group"><label>购买方</label><input type="text" id="inv-edit-buyer" value="${escHtml(inv.buyer_name||'')}" placeholder="未识别"></div>
      <div class="form-group"><label>销售方</label><input type="text" id="inv-edit-seller" value="${escHtml(inv.seller_name||'')}" placeholder="未识别"></div>
      <div class="form-group"><label>金额</label><input type="number" id="inv-edit-amount" step="any" value="${inv.ocr_amount!=null?Number(inv.ocr_amount):''}" placeholder="未识别"></div>
      <div class="form-group"><label>开票日期</label><input type="text" id="inv-edit-date" placeholder="YYYY-MM-DD"></div>
      <details style="margin-bottom:12px;"><summary style="cursor:pointer;font-size:12px;color:var(--text-muted);">原文件名 & OCR 全文</summary><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${escHtml(inv.original_name)}</div><pre style="white-space:pre-wrap;font-size:11px;max-height:150px;overflow-y:auto;margin:4px 0;">${escHtml(inv.ocr_text||'无')}</pre></details>
      <div class="modal-actions"><button class="btn btn-outline btn-sm" onclick="PageInvoices.reOcr('${inv.id}')">🔄 重新识别</button><button class="btn btn-outline" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="PageInvoices.saveEdit('${inv.id}')">💾 保存</button></div>
    `;
    Modal.show(html);
    const el = document.getElementById('inv-edit-date');
    if (el) { const v = formatDateValue(inv.ocr_date); if (v) el.value = v; }
  },

  async saveEdit(id) {
    const data = {
      invoice_number: document.getElementById('inv-edit-number').value || null,
      buyer_name: document.getElementById('inv-edit-buyer').value || null,
      seller_name: document.getElementById('inv-edit-seller').value || null,
      ocr_amount: parseFloat(document.getElementById('inv-edit-amount').value) || null,
      ocr_date: document.getElementById('inv-edit-date').value || null,
    };
    await API.put('/invoices/' + id, data);
    Toast.show('发票信息已保存');
    Modal.close(); this.render();
  },

  async reOcr(id) {
    try { await API.post('/invoices/' + id + '/re-ocr'); Toast.show('重新识别完成'); Modal.close(); this.render(); }
    catch (e) { Toast.show(e.message, 'error'); }
  },

  async showLink(invId) {
    const inv = Store.invoices.find(i => i.id === invId);
    const invMonth = (inv.ocr_date || '').slice(0, 7);
    await Store.loadEntities();
    await this._loadLinkRecords(invMonth, '');
    this._linkInvId = invId;
    this._linkInv = inv;
    const records = Store.records.filter(r => !r.invoice_id || r.invoice_id === invId);
    const months = new Set();
    Store.records.forEach(r => { if (r.record_date) months.add(r.record_date.slice(0, 7)); });
    const monthOptions = [...months].sort().reverse();
    const html = `
      <h3>关联收支记录</h3>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">发票日期: ${inv.ocr_date||'未知'} | 金额: ${inv.ocr_amount?'¥'+Number(inv.ocr_amount).toFixed(2):'未知'}</div>
      <div class="toolbar" style="margin-bottom:10px;">
        <select id="link-month" onchange="PageInvoices.onLinkMonthChange()" style="min-width:110px;">
          <option value="">全部月份</option>
          ${monthOptions.map(m => `<option value="${m}" ${invMonth===m?'selected':''}>${m}</option>`).join('')}
        </select>
        <input type="text" id="link-keyword" placeholder="搜索摘要..." oninput="PageInvoices.onLinkSearchDebounced()" style="min-width:140px;">
        <button class="btn btn-outline btn-sm" onclick="PageInvoices.showLink('${invId}')">🔄 刷新</button>
      </div>
      <div class="form-group"><label>选择记录（${records.length} 条）</label>
        <select id="link-record" size="8" style="height:auto;font-size:12px;">
          <option value="">— 解除关联 —</option>
          ${records.map(r => `<option value="${r.id}" ${inv.record_id===r.id?'selected':''}>[${r.record_date}] ${r.type==='income'?'收':'支'} ¥${Number(r.amount).toFixed(2)} ${escHtml((r.summary||'').slice(0,25))}</option>`).join('')}
        </select>
      </div>
      <div class="modal-actions"><button class="btn btn-outline" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="PageInvoices.doLink('${invId}')">保存关联</button></div>
    `;
    Modal.show(html);
  },

  async _loadLinkRecords(month, keyword) {
    Store.filters = { entity_id:'', type:'', start_date:'', end_date:'', month:month||'', category:'', keyword:keyword||'', page:1, pageSize:1000 };
    await Store.loadRecords();
  },

  _linkSearchTimer: null,
  onLinkSearchDebounced() {
    clearTimeout(this._linkSearchTimer);
    this._linkSearchTimer = setTimeout(() => {
      const keyword = document.getElementById('link-keyword')?.value || '';
      const month = document.getElementById('link-month')?.value || '';
      this._loadLinkRecords(month, keyword).then(() => this.showLink(this._linkInvId));
    }, 300);
  },

  onLinkMonthChange() {
    const month = document.getElementById('link-month')?.value || '';
    const keyword = document.getElementById('link-keyword')?.value || '';
    this._loadLinkRecords(month, keyword).then(() => this.showLink(this._linkInvId));
  },

  async doLink(invId) {
    const recordId = document.getElementById('link-record').value || null;
    await API.put('/invoices/' + invId + '/link', { record_id: recordId });
    Toast.show('关联已更新'); Modal.close(); this.render();
  },

  async del(id) {
    if (!confirm('确认删除该发票及文件？')) return;
    await API.del('/invoices/' + id);
    Toast.show('已删除'); this.render();
  }
};
