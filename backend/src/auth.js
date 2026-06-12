const { db } = require('./db');
const bcrypt = require('bcryptjs');

// 初始化默认管理员
function initAdmin() {
  const row = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (!row) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')").run(hash);
    console.log('🔐 默认管理员已创建: admin / admin123');
  }
}

// 登录验证
function verifyLogin(username, password) {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, username: user.username, role: user.role };
}

// 修改密码
function changePassword(userId, oldPwd, newPwd) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user || !bcrypt.compareSync(oldPwd, user.password_hash)) return false;
  const hash = bcrypt.hashSync(newPwd, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
  return true;
}

// 鉴权中间件
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();

  // API 返回 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: '未登录' });
  }
  // 页面重定向到登录页
  return res.redirect('/login.html');
}

module.exports = { initAdmin, verifyLogin, changePassword, requireAuth };
