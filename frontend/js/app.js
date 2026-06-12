// ===== 主入口 =====

// HTML 转义
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 日期值规范化
function formatDateValue(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return s.slice(0,4) + '-' + s.slice(4,6) + '-' + s.slice(6,8);
  const m = s.match(/(\d{4})[年\-\/.]\s*(\d{1,2})/);
  if (m) {
    const day = (s.match(/[日\-\/.]\s*(\d{1,2})/) || [])[1] || '01';
    return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  return '';
}

// 安全设置 date/month input 的值
function safeSetDateInput(el, val) {
  if (!el) return;
  const formatted = formatDateValue(val);
  if (formatted) el.value = formatted;
}

// Toast 通知
const Toast = {
  show(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast ' + type;
    el.classList.remove('hidden');
    clearTimeout(this._timer);
    this._timer = setTimeout(() => el.classList.add('hidden'), 2500);
  }
};

// 模态框
const Modal = {
  show(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').classList.remove('hidden');
  },
  close() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
};
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) Modal.close();
});

// 路由
const App = {
  pages: {
    dashboard: PageDashboard,
    records: PageRecords,
    entities: PageEntities,
    invoices: PageInvoices,
    import: PageImport
  },

  async navigate(page) {
    Charts.disposeAll();
    Store.currentPage = page;

    // 更新侧边栏导航
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    // 同步底部导航
    document.querySelectorAll('.bn-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // 隐藏所有页
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));

    // 显示目标页
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    // 渲染
    const handler = this.pages[page];
    if (handler) {
      try {
        await handler.render();
      } catch (e) {
        console.error('页面渲染失败:', e);
        Toast.show('加载失败: ' + e.message, 'error');
      }
    }
  },

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  },

  async changePassword() {
    const html = `
      <h3>🔒 修改密码</h3>
      <div class="form-group"><label>原密码</label><input type="password" id="chpwd-old"></div>
      <div class="form-group"><label>新密码（至少6位）</label><input type="password" id="chpwd-new"></div>
      <div class="form-group"><label>确认新密码</label><input type="password" id="chpwd-new2"></div>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="App.doChangePassword()">确认修改</button>
      </div>
    `;
    Modal.show(html);
  },

  async doChangePassword() {
    const oldPwd = document.getElementById('chpwd-old').value;
    const newPwd = document.getElementById('chpwd-new').value;
    const newPwd2 = document.getElementById('chpwd-new2').value;
    if (!oldPwd || !newPwd) { Toast.show('请填写完整', 'error'); return; }
    if (newPwd.length < 6) { Toast.show('新密码至少6位', 'error'); return; }
    if (newPwd !== newPwd2) { Toast.show('两次新密码不一致', 'error'); return; }
    const res = await fetch('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd })
    });
    const data = await res.json();
    if (!res.ok) { Toast.show(data.error || '修改失败', 'error'); return; }
    Toast.show('密码修改成功');
    Modal.close();
  },

  async createUser() {
    const html = `
      <h3>👤 创建用户</h3>
      <div class="form-group"><label>用户名</label><input type="text" id="cuser-name" placeholder="新用户名"></div>
      <div class="form-group"><label>密码（至少6位）</label><input type="password" id="cuser-pwd"></div>
      <div class="form-group"><label>确认密码</label><input type="password" id="cuser-pwd2"></div>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="App.doCreateUser()">创建</button>
      </div>
    `;
    Modal.show(html);
  },

  async doCreateUser() {
    const name = document.getElementById('cuser-name').value.trim();
    const pwd = document.getElementById('cuser-pwd').value;
    const pwd2 = document.getElementById('cuser-pwd2').value;
    if (!name || !pwd) { Toast.show('请填写完整', 'error'); return; }
    if (pwd.length < 6) { Toast.show('密码至少6位', 'error'); return; }
    if (pwd !== pwd2) { Toast.show('两次密码不一致', 'error'); return; }
    const res = await fetch('/api/auth/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, password: pwd })
    });
    const data = await res.json();
    if (!res.ok) { Toast.show(data.error || '创建失败', 'error'); return; }
    Toast.show('用户 ' + name + ' 创建成功');
    Modal.close();
  },

  init() {
    // 导航点击
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const page = el.dataset.page;
        window.location.hash = page;
        this.navigate(page);
      });
    });

    // 底部导航点击
    document.querySelectorAll('.bn-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const page = el.dataset.page;
        window.location.hash = page;
        this.navigate(page);
      });
    });

    // hash 路由
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigate(hash);

    window.addEventListener('hashchange', () => {
      const page = window.location.hash.replace('#', '') || 'dashboard';
      this.navigate(page);
    });
  }
};

// 启动
App.init();
