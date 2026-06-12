// 收支记录页面 v2.4 — 动态字段 + 批量删除 + Excel导出
const PageRecords = {

  _tab: 'all',

  // 字段标签映射
  _labels(type) {
    return type === 'income' ? {
      payee_payer: '付款单位', income_type: '收入类型', detail: '收入详情'
    } : {
      payee_payer: '收款单位', income_type: '支付类型', detail: '支付详情'
    };
  },

  async render() {
    const tab = this._tab;
    Store.filters.type = (tab === 'all') ? '' : tab;
    await Store.loadRecords();
    await Store.loadInvoices();

    const displayRecords = Store.records;

    // 从后端加载全部月份范围（首次）
    if (!this._allMonths) {
      try {
        const stats = await API.get('/reports/dashboard');
        if (stats.byMonth && stats.byMonth.length) {
          this._allMonths = [...new Set(stats.byMonth.map(m => m.month))].sort().reverse();
        }
      } catch (e) {}
    }
    const monthOpts = this._allMonths && this._allMonths.length ? this._allMonths : (() => {
      const now = new Date();
      const opts = [];
      for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
        for (let m = 12; m >= 1; m--) opts.push(y + '-' + String(m).padStart(2, '0'));
      }
      return opts;
    })();

    const html = `
      <div class="card">
        <div class="card-header">
          <h3>收支明细 <span style="font-weight:400;color:var(--text-muted);font-size:12px;">（共 ${Store.recordsTotal} 条）</span></h3>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-outline btn-sm" onclick="PageRecords.exportExcel()">📥 导出 Excel</button>
            <button class="btn btn-danger btn-sm" onclick="PageRecords.batchDelete()" id="rec-batch-del-btn" disabled>🗑 批量删除</button>
            <button class="btn btn-primary btn-sm" onclick="PageRecords.showForm()">+ 新增记录</button>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <button class="btn btn-sm ${tab==='all'?'btn-primary':'btn-outline'}" onclick="PageRecords.switchTab('all')">全部</button>
          <button class="btn btn-sm ${tab==='income'?'btn-primary':'btn-outline'}" onclick="PageRecords.switchTab('income')" style="${tab==='income'?'background:#4caf50;':''}">💰 收入</button>
          <button class="btn btn-sm ${tab==='expense'?'btn-primary':'btn-outline'}" onclick="PageRecords.switchTab('expense')" style="${tab==='expense'?'background:#ef5350;':''}">💸 支出</button>
        </div>

        <div class="toolbar">
          <select id="rec-entity" onchange="PageRecords.onFilter()">
            <option value="">全部单位</option>
            ${(Store.entities||[]).map(e => `<option value="${e.id}" ${Store.filters.entity_id===e.id?'selected':''}>${escHtml(e.name)}</option>`).join('')}
          </select>
          <select id="rec-start" onchange="PageRecords.onFilter()" style="min-width:115px;">
            <option value="">开始月份</option>
            ${monthOpts.map(m => `<option value="${m}" ${(Store.filters.start_date||'').slice(0,7)===m?'selected':''}>${m}</option>`).join('')}
          </select>
          <span style="color:var(--text-muted);font-size:12px;">至</span>
          <select id="rec-end" onchange="PageRecords.onFilter()" style="min-width:115px;">
            <option value="">结束月份</option>
            ${monthOpts.map(m => `<option value="${m}" ${(Store.filters.end_date||'').slice(0,7)===m?'selected':''}>${m}</option>`).join('')}
          </select>
          <button class="btn btn-outline btn-sm" onclick="PageRecords.clearFilters()">🔄 清除</button>
        </div>

        <div class="toolbar" style="margin-bottom:12px;">
          <input type="text" id="rec-keyword" placeholder="🔍 模糊搜索（日期/单位/分类/详情/备注/金额...）" value="${escHtml(Store.filters.keyword||'')}" onkeydown="if(event.key==='Enter')PageRecords.onFilter()" style="flex:1;">
          <button class="btn btn-primary btn-sm" onclick="PageRecords.onFilter()" style="margin-left:4px;">🔍 搜索</button>
        </div>

        <!-- 统计汇总条 -->
        ${(() => {
          const incomeAmt = displayRecords.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
          const expenseAmt = displayRecords.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
          return `
          <div class="rec-summary" style="display:flex;gap:16px;padding:10px 14px;background:var(--bg);border-radius:6px;margin-bottom:12px;font-size:13px;">
            <span>📊 当前筛选结果：</span>
            <span style="color:var(--income);">收入 <strong>¥${incomeAmt.toFixed(2)}</strong></span>
            <span style="color:var(--expense);">支出 <strong>¥${expenseAmt.toFixed(2)}</strong></span>
            <span style="color:var(--text-muted);">合计 <strong style="color:var(--accent);">¥${(incomeAmt - expenseAmt).toFixed(2)}</strong></span>
          </div>`;
        })()}

        <div class="table-wrap">
          <table class="mobile-table" style="font-size:12px;">
            <thead><tr>
              <th style="width:28px;"><input type="checkbox" id="rec-select-all" onchange="PageRecords.toggleAll(this)"></th>
              <th>日期</th><th>类型</th><th>金额</th><th>分类</th>
              <th>收款/付款单位</th><th>收入/支付类型</th><th>详情</th><th>备注</th><th>单位</th><th>操作</th>
            </tr></thead>
            <tbody>
              ${displayRecords.map(r => {
                const L = this._labels(r.type);
                return `
                <tr>
                  <td data-label="选"><input type="checkbox" class="rec-cb" value="${r.id}" onchange="PageRecords.onCheck()"></td>
                  <td data-label="日期">${r.record_date}</td>
                  <td data-label="类型"><span class="${r.type==='income'?'income-tag':'expense-tag'} mob-tag">${r.type==='income'?'收入':'支出'}</span></td>
                  <td data-label="金额">¥${Number(r.amount).toFixed(2)}</td>
                  <td data-label="分类">${escHtml(r.category||'')}</td>
                  <td data-label="单位" class="mob-hide">${escHtml((r.payee_payer||'').slice(0,18))}</td>
                  <td data-label="类型" class="mob-hide">${escHtml((r.income_type||'').slice(0,12))}</td>
                  <td data-label="详情" class="mob-hide">${escHtml((r.summary||'').slice(0,20))}</td>
                  <td data-label="备注" class="mob-hide">${escHtml((r.remark||'').slice(0,15))}</td>
                  <td data-label="单位" class="mob-hide">${escHtml((r.entity_name||'').slice(0,10))}</td>
                  <td data-label="操作">
                    <button class="btn btn-outline btn-sm" onclick="PageRecords.showForm('${r.id}')">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="PageRecords.del('${r.id}')">删除</button>
                  </td>
                </tr>`;
              }).join('')}
              ${displayRecords.length === 0 ? '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:40px;">暂无记录</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('page-records').innerHTML = html;
  },

  switchTab(tab) { this._tab = tab; this.render(); },

  onFilter() {
    let s = document.getElementById('rec-start')?.value || '';
    let e = document.getElementById('rec-end')?.value || '';
    // month input returns "YYYY-MM", convert to date boundaries
    if (s && s.length === 7) s += '-01';
    if (e && e.length === 7) {
      const [y, m] = e.split('-').map(Number);
      e += '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
    }
    Store.filters.entity_id = document.getElementById('rec-entity')?.value || '';
    Store.filters.start_date = s;
    Store.filters.end_date = e;
    Store.filters.keyword = document.getElementById('rec-keyword')?.value || '';
    Store.filters.page = 1;
    this.render();
  },

  clearFilters() {
    Store.filters = { entity_id:'',type:'',start_date:'',end_date:'',month:'',category:'',keyword:'',page:1,pageSize:200 };
    this._allMonths = null; // 刷新月份列表
    this._tab = 'all'; this.render();
  },

  async showForm(id) {
    const record = id ? Store.records.find(r => r.id === id) : null;
    const currentType = record ? record.type : 'expense';
    const L = this._labels(currentType);
    const availableInvoices = Store.invoices.filter(i => !i.record_id || (record && i.record_id === record.id));

    const html = `
      <h3>${id ? '编辑' : '新增'}收支记录</h3>
      <div class="form-group">
        <label>类型 *</label>
        <select id="form-type" onchange="PageRecords.switchFormType()">
          <option value="income" ${currentType==='income'?'selected':''}>💰 收入</option>
          <option value="expense" ${currentType==='expense'?'selected':''}>💸 支出</option>
        </select>
      </div>
      <div class="form-group">
        <label>所属单位 *</label>
        <select id="form-entity">${Store.entities.map(e => `<option value="${e.id}" ${record&&record.entity_id===e.id?'selected':''}>${escHtml(e.name)}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label>金额 *</label>
        <input type="number" id="form-amount" step="any" value="${record&&record.amount?Number(record.amount):''}">
      </div>
      <div class="form-group">
        <label>分类</label>
        <input type="text" id="form-category" value="${escHtml(record?record.category||'':'')}" placeholder="如：办公费、差旅费">
      </div>
      <div class="form-group">
        <label id="label-payee_payer">${L.payee_payer}</label>
        <input type="text" id="form-payee_payer" value="${escHtml(record?record.payee_payer||'':'')}" placeholder="${L.payee_payer}">
      </div>
      <div class="form-group">
        <label id="label-income_type">${L.income_type}</label>
        <input type="text" id="form-income_type" value="${escHtml(record?record.income_type||'':'')}" placeholder="${L.income_type}">
      </div>
      <div class="form-group">
        <label id="label-detail">${L.detail}</label>
        <textarea id="form-summary">${escHtml(record?record.summary||'':'')}</textarea>
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="form-remark" value="${escHtml(record?record.remark||'':'')}">
      </div>
      <div class="form-group">
        <label>日期 *</label>
        <input type="text" id="form-date" placeholder="YYYY-MM-DD">
      </div>
      <div class="form-group">
        <label>关联发票</label>
        <select id="form-invoice">
          <option value="">无</option>
          ${availableInvoices.map(i => `<option value="${i.id}" ${record&&record.invoice_id===i.id?'selected':''}>${escHtml(i.original_name)}${i.ocr_amount?' (¥'+Number(i.ocr_amount).toFixed(2)+')':''}</option>`).join('')}
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="PageRecords.save('${id||''}')">保存</button>
      </div>
    `;
    Modal.show(html);
    const dateEl = document.getElementById('form-date');
    if (dateEl) dateEl.value = formatDateValue(record?.record_date) || new Date().toISOString().slice(0,10);
  },

  switchFormType() {
    const type = document.getElementById('form-type')?.value || 'expense';
    const L = this._labels(type);
    document.getElementById('label-payee_payer').textContent = L.payee_payer;
    document.getElementById('form-payee_payer').placeholder = L.payee_payer;
    document.getElementById('label-income_type').textContent = L.income_type;
    document.getElementById('form-income_type').placeholder = L.income_type;
    document.getElementById('label-detail').textContent = L.detail;
  },

  async save(id) {
    const data = {
      entity_id: document.getElementById('form-entity').value,
      type: document.getElementById('form-type').value,
      amount: parseFloat(document.getElementById('form-amount').value) || 0,
      category: document.getElementById('form-category').value,
      payee_payer: document.getElementById('form-payee_payer').value,
      income_type: document.getElementById('form-income_type').value,
      summary: document.getElementById('form-summary').value,
      remark: document.getElementById('form-remark').value,
      record_date: document.getElementById('form-date').value,
    };
    const invoiceId = document.getElementById('form-invoice')?.value || null;

    let record;
    if (id) {
      record = await API.put('/records/' + id, { ...data, invoice_id: invoiceId });
      const oldInvId = Store.records.find(r => r.id === id)?.invoice_id;
      if (oldInvId !== invoiceId) {
        if (oldInvId) await API.put('/invoices/' + oldInvId + '/link', { record_id: null });
        if (invoiceId) await API.put('/invoices/' + invoiceId + '/link', { record_id: id });
      }
      Toast.show('更新成功');
    } else {
      record = await API.post('/records', data);
      if (invoiceId && record) await API.put('/invoices/' + invoiceId + '/link', { record_id: record.id });
      Toast.show('创建成功');
    }
    Modal.close();
    PageDashboard.render();
    this.render();
  },

  async del(id) {
    if (!confirm('确认删除？')) return;
    await API.del('/records/' + id);
    Toast.show('已删除');
    PageDashboard.render();
    this.render();
  },

  toggleAll(el) { document.querySelectorAll('.rec-cb').forEach(cb => { cb.checked = el.checked; }); this.onCheck(); },

  onCheck() {
    const checked = document.querySelectorAll('.rec-cb:checked').length;
    const btn = document.getElementById('rec-batch-del-btn');
    if (btn) { btn.disabled = checked === 0; btn.textContent = checked > 0 ? `🗑 批量删除 (${checked})` : '🗑 批量删除'; }
  },

  async batchDelete() {
    const ids = [...document.querySelectorAll('.rec-cb:checked')].map(cb => cb.value);
    if (ids.length === 0) return;
    if (!confirm(`确认删除选中的 ${ids.length} 条记录？此操作不可撤销。`)) return;
    await API.post('/records/batch-delete', { ids });
    Toast.show(`已删除 ${ids.length} 条记录`);
    PageDashboard.render(); this.render();
  },

  async exportExcel() {
    const f = Store.filters;
    const params = [];
    if (f.entity_id) params.push('entity_id=' + encodeURIComponent(f.entity_id));
    if (this._tab !== 'all') params.push('type=' + this._tab);
    if (f.start_date) params.push('start_date=' + encodeURIComponent(f.start_date));
    if (f.end_date) params.push('end_date=' + encodeURIComponent(f.end_date));

    try {
      const res = await fetch('/api/reports/excel?' + params.join('&'));
      if (!res.ok) throw new Error('导出失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shouzhi-' + new Date().toISOString().slice(0,10) + '.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      Toast.show('Excel 下载完成');
    } catch (e) {
      Toast.show('导出失败: ' + e.message, 'error');
    }
  }
};
