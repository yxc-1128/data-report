const express = require('express');
const cors = require('cors');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { init } = require('./db');
const { initAdmin, verifyLogin, changePassword, requireAuth } = require('./auth');

const entitiesRouter = require('./routes/entities');
const recordsRouter = require('./routes/records');
const invoicesRouter = require('./routes/invoices');
const filesRouter = require('./routes/files');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'data-report-secret-' + require('crypto').randomBytes(16).toString('hex');

// 初始化数据库 + 管理员
init();
initAdmin();

// ─── 安全中间件 ───
app.use(helmet({
  contentSecurityPolicy: false,  // ECharts CDN 需要放宽
  crossOriginEmbedderPolicy: false,
}));
app.disable('x-powered-by');

// 限流: 全局 200 req/min, 登录 10 req/min
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' }
}));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000  // 24h
  }
}));

// ─── 公开路由（无需登录）───
// 登录页
const frontendPath = (() => {
  let p = path.join(__dirname, '..', '..', 'frontend');
  if (!fs.existsSync(p)) p = path.join(__dirname, '..', 'frontend');
  return p;
})();
app.get('/login.html', (_req, res) => res.sendFile(path.join(frontendPath, 'login.html')));

// 登录 API
const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: '登录尝试过多，请1分钟后再试' } });
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
  const user = verifyLogin(username, password);
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });
  req.session.user = user;
  res.json({ ok: true, username: user.username, role: user.role });
});

// 登出
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// 创建用户
app.post('/api/auth/create', requireAuth, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请填写用户名和密码' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
  const bcrypt = require('bcryptjs');
  const { db } = require('./db');
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)').run(username, hash, 'user');
  res.json({ ok: true });
});

// 修改密码
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '请输入新旧密码' });
  if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少6位' });
  const ok = changePassword(req.session.user.id, oldPassword, newPassword);
  if (!ok) return res.status(400).json({ error: '原密码错误' });
  res.json({ ok: true });
});

// 检查登录状态
app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, username: req.session.user.username, role: req.session.user.role });
});

// ─── 受保护路由 ───
app.use('/api/entities', requireAuth, entitiesRouter);
app.use('/api/records', requireAuth, recordsRouter);
app.use('/api/invoices', requireAuth, invoicesRouter);
app.use('/api/files', requireAuth, filesRouter);
app.use('/api/reports', requireAuth, reportsRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// 静态文件 + 上传文件（受保护）
const uploadsPath = (() => {
  let p = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(p)) p = path.join(__dirname, '..', '..', 'uploads');
  return p;
})();
app.use('/uploads', requireAuth, express.static(uploadsPath, { dotfiles: 'deny', index: false }));

// 前端静态文件 + PWA 资源（无需登录：manifest/sw/icons）
app.get('/manifest.json', (_req, res) => res.sendFile(path.join(frontendPath, 'manifest.json')));
app.get('/sw.js', (_req, res) => res.type('application/javascript').sendFile(path.join(frontendPath, 'sw.js')));
app.use('/assets', express.static(path.join(frontendPath, 'assets'), { maxAge: '7d' }));
app.use(express.static(frontendPath, { dotfiles: 'deny', index: false }));

// SPA fallback → 未登录跳登录页
app.get('*', (req, res, next) => {
  if (!req.session || !req.session.user) return res.redirect('/login.html');
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 错误处理
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📊 data-report v2.5.0 已启动: http://0.0.0.0:${PORT}`);
  console.log(`🔐 默认管理员: admin / admin123  (请立即修改密码!)`);
});
