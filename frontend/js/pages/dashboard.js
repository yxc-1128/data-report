// 仪表盘页面 v2.4.5 — 统计卡片全量 + 年度收支柱状图
const PageDashboard = {

  async render() {
    await Store.loadEntities();
    // dashboard 始终查全量，仅 entity_id 筛选
    const stats = await API.get('/reports/dashboard', { entity_id: Store.filters.entity_id || '' });
    Store.stats = stats;
    const s = stats;

    const years = [...new Set((s.byYear || []).map(y => y.year))].sort().reverse();

    const html = `
      <div class="toolbar">
        <select id="dash-entity-filter" onchange="PageDashboard.onFilter()">
          <option value="">全部单位</option>
          ${(Store.entities || []).map(e => `<option value="${e.id}" ${Store.filters.entity_id===e.id?'selected':''}>${escHtml(e.name)}</option>`).join('')}
        </select>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="label">总收入</div>
          <div class="value income">¥${(s.totalIncome || 0).toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="label">总支出</div>
          <div class="value expense">¥${(s.totalExpense || 0).toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="label">结余</div>
          <div class="value balance">¥${((s.totalIncome||0) - (s.totalExpense||0)).toFixed(2)}</div>
        </div>
      </div>

      ${years.length > 0 ? `
      <div class="card">
        <div class="card-header"><h3>📊 年度收支对比</h3></div>
        <div class="chart-box" id="chart-yearly"></div>
      </div>` : '<div class="card" style="text-align:center;color:var(--text-muted);padding:40px;">暂无数据</div>'}
    `;
    document.getElementById('page-dashboard').innerHTML = html;
    Charts.renderYearly('chart-yearly', s);
  },

  onFilter() {
    Store.filters.entity_id = document.getElementById('dash-entity-filter')?.value || '';
    this.render();
  }
};
