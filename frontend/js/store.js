// 简单状态管理
const Store = {
  entities: [],
  records: [],
  recordsTotal: 0,
  invoices: [],
  files: [],
  stats: null,

  currentPage: 'dashboard',
  invKeyword: '',
  invStatus: '',
  invTotalAmount: 0,
  filters: {
    entity_id: '',
    type: '',
    start_date: '',
    end_date: '',
    month: '',      // YYYY-MM 快捷月份
    category: '',   // 分类模糊搜索
    keyword: '',    // 摘要关键词
    page: 1,
    pageSize: 200
  },

  async loadEntities() {
    this.entities = await API.get('/entities');
    return this.entities;
  },

  async loadRecords() {
    const f = this.filters;
    const result = await API.get('/records', {
      entity_id: f.entity_id,
      type: f.type,
      start_date: f.start_date,
      end_date: f.end_date,
      month: f.month,
      category: f.category,
      keyword: f.keyword,
      page: f.page,
      pageSize: f.pageSize
    });
    this.records = result.rows;
    this.recordsTotal = result.total;
    return result;
  },

  async loadStats() {
    const f = this.filters;
    this.stats = await API.get('/reports/dashboard', {
      entity_id: f.entity_id,
      start_date: f.start_date,
      end_date: f.end_date,
      month: f.month,
      year: f.year || ''
    });
    return this.stats;
  },

  async loadInvoices() {
    const result = await API.get('/invoices', {
      entity_id: this.filters.entity_id,
      keyword: this.invKeyword || '',
      status: this.invStatus || ''
    });
    // v2.6.6+: API returns { rows, totalAmount }
    if (result.rows) {
      this.invoices = result.rows;
      this.invTotalAmount = result.totalAmount;
    } else {
      this.invoices = result;
      this.invTotalAmount = 0;
    }
    return this.invoices;
  },

  async loadFiles() {
    this.files = await API.get('/files', { entity_id: this.filters.entity_id });
    return this.files;
  }
};
