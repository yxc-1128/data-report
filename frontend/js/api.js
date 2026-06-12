// API 封装 — REST 调用后端
const API = {
  base: '/api',

  async _fetch(method, path, body) {
    const opts = { method, headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${this.base}${path}`, opts);

    // 401 → 跳转登录
    if (res.status === 401) {
      window.location.href = '/login.html';
      throw new Error('未登录');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || '请求失败');
    }

    const ct = res.headers.get('Content-Type') || '';
    if (ct.includes('application/pdf')) return res.blob();
    if (ct.includes('spreadsheet') || ct.includes('excel')) return res.blob();
    return res.json();
  },

  async get(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this._fetch('GET', path + (qs ? '?' + qs : ''));
  },

  async post(path, body) {
    return this._fetch('POST', path, body);
  },

  async put(path, body) {
    return this._fetch('PUT', path, body);
  },

  async del(path) {
    return this._fetch('DELETE', path);
  },

  async upload(path, file, extraFields = {}) {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(extraFields).forEach(([k, v]) => fd.append(k, v));
    const res = await fetch(`${this.base}${path}`, { method: 'POST', body: fd });
    if (res.status === 401) { window.location.href = '/login.html'; throw new Error('未登录'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || '上传失败');
    }
    return res.json();
  }
};
