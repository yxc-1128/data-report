// 单位管理页面
const PageEntities = {

  async render() {
    await Store.loadEntities();

    const html = `
      <div class="card">
        <div class="card-header">
          <h3>单位 / 部门管理</h3>
          <button class="btn btn-primary btn-sm" onclick="PageEntities.showForm()">+ 新增单位</button>
        </div>
        <div class="table-wrap">
          <table class="mobile-table">
            <thead><tr>
              <th>名称</th><th>编码</th><th>描述</th><th>创建时间</th><th>操作</th>
            </tr></thead>
            <tbody>
              ${Store.entities.map(e => `
                <tr>
                  <td data-label="名称"><strong>${escHtml(e.name)}</strong></td>
                  <td data-label="编码">${escHtml(e.code||'')}</td>
                  <td data-label="描述" class="mob-hide">${escHtml((e.description||'').slice(0,40))}</td>
                  <td data-label="创建时间" class="mob-hide">${e.created_at?.slice(0,10)||''}</td>
                  <td data-label="操作">
                    <button class="btn btn-outline btn-sm" onclick="PageEntities.showForm('${e.id}')">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="PageEntities.del('${e.id}')">删除</button>
                  </td>
                </tr>
              `).join('')}
              ${Store.entities.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">暂无单位，请新增</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('page-entities').innerHTML = html;
  },

  showForm(id) {
    const entity = id ? Store.entities.find(e => e.id === id) : null;
    const html = `
      <h3>${id ? '编辑' : '新增'}单位</h3>
      <div class="form-group">
        <label>名称 *</label>
        <input type="text" id="form-name" value="${escHtml(entity?entity.name:'')}">
      </div>
      <div class="form-group">
        <label>编码</label>
        <input type="text" id="form-code" value="${escHtml(entity?entity.code||'':'')}" placeholder="可选，如 DEPT-001">
      </div>
      <div class="form-group">
        <label>描述</label>
        <textarea id="form-desc">${escHtml(entity?entity.description||'':'')}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="PageEntities.save('${id||''}')">保存</button>
      </div>
    `;
    Modal.show(html);
  },

  async save(id) {
    const data = {
      name: document.getElementById('form-name').value,
      code: document.getElementById('form-code').value,
      description: document.getElementById('form-desc').value,
    };
    if (!data.name) { Toast.show('名称必填', 'error'); return; }
    if (id) {
      await API.put('/entities/' + id, data);
      Toast.show('更新成功');
    } else {
      await API.post('/entities', data);
      Toast.show('创建成功');
    }
    Modal.close();
    this.render();
  },

  async del(id) {
    if (!confirm('删除单位将同时删除其下所有收支记录，确认？')) return;
    await API.del('/entities/' + id);
    Toast.show('已删除');
    this.render();
  }
};
