// ECharts 图表管理 v2
const Charts = {
  instances: {},

  init(domId) {
    const dom = document.getElementById(domId);
    if (!dom) return null;
    if (this.instances[domId]) this.instances[domId].dispose();
    const chart = echarts.init(dom, 'dark');
    this.instances[domId] = chart;
    window.addEventListener('resize', () => chart.resize());
    return chart;
  },

  disposeAll() {
    Object.values(this.instances).forEach(c => c.dispose());
    this.instances = {};
  },

  /** 月度收支趋势 */
  renderTrend(domId, stats) {
    const chart = this.init(domId);
    if (!chart || !stats) return;
    const months = [...new Set(stats.byMonth.map(m => m.month))].sort();
    const incomeData = months.map(m => {
      const row = stats.byMonth.find(r => r.month === m && r.type === 'income');
      return row ? row.total : 0;
    });
    const expenseData = months.map(m => {
      const row = stats.byMonth.find(r => r.month === m && r.type === 'expense');
      return row ? row.total : 0;
    });
    chart.setOption({
      tooltip: { trigger: 'axis', valueFormatter: v => '¥' + v.toFixed(2) },
      legend: { data: ['收入', '支出'], textStyle: { color: '#8899aa' }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: months, axisLabel: { color: '#8899aa' } },
      yAxis: { type: 'value', axisLabel: { color: '#8899aa' } },
      series: [
        { name: '收入', type: 'bar', data: incomeData, itemStyle: { color: '#4caf50' }, barMaxWidth: 30 },
        { name: '支出', type: 'bar', data: expenseData, itemStyle: { color: '#ef5350' }, barMaxWidth: 30 }
      ]
    });
  },

  /** 分类饼图 */
  renderCategoryPie(domId, stats) {
    const chart = this.init(domId);
    if (!chart || !stats) return;
    const expenseData = stats.byCategory
      .filter(r => r.type === 'expense')
      .map(r => ({ name: r.category || '未分类', value: r.total }));
    chart.setOption({
      title: { text: '支出分类', left: 'center', textStyle: { color: '#8899aa', fontSize: 13 } },
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      series: [{
        type: 'pie', radius: ['40%', '70%'], center: ['50%', '55%'],
        data: expenseData, label: { color: '#8899aa' },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
      }]
    });
  },

  /** 年度收支对比柱状图 */
  renderYearly(domId, stats) {
    const chart = this.init(domId);
    if (!chart || !stats || !stats.byYear) return;
    const years = [...new Set(stats.byYear.map(y => y.year))].sort();
    const incomeData = years.map(y => {
      const row = stats.byYear.find(r => r.year === y && r.type === 'income');
      return row ? row.total : 0;
    });
    const expenseData = years.map(y => {
      const row = stats.byYear.find(r => r.year === y && r.type === 'expense');
      return row ? row.total : 0;
    });
    const balanceData = years.map((y, i) => incomeData[i] - expenseData[i]);

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: function(params) {
          let s = '<strong>' + params[0].axisValue + ' 年</strong><br/>';
          params.forEach(p => {
            s += p.marker + ' ' + p.seriesName + ': ¥' + Number(p.value).toFixed(2) + '<br/>';
          });
          return s;
        }
      },
      legend: { data: ['收入', '支出', '结余'], textStyle: { color: '#8899aa' }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: years.map(y => y + '年'), axisLabel: { color: '#8899aa' } },
      yAxis: { type: 'value', axisLabel: { color: '#8899aa', formatter: v => (v/10000).toFixed(1) + '万' } },
      series: [
        { name: '收入', type: 'bar', data: incomeData, itemStyle: { color: '#4caf50' }, barMaxWidth: 40 },
        { name: '支出', type: 'bar', data: expenseData, itemStyle: { color: '#ef5350' }, barMaxWidth: 40 },
        { name: '结余', type: 'line', data: balanceData, itemStyle: { color: '#4fc3f7' }, lineStyle: { width: 3 },
          symbol: 'circle', symbolSize: 8,
          markLine: { silent: true, data: [{ yAxis: 0, lineStyle: { color: '#666', type: 'dashed' } }] }
        }
      ]
    });
  }
};
