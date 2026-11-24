const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const PASS = process.env.ADMIN_PASSWORD, SECRET = process.env.SESSION_SECRET;
if (!PASS || !SECRET || SECRET.length < 16) {
  console.error('ADMIN_PASSWORD және SESSION_SECRET (кемінде 16 таңба) .env файлында болуы керек');
  process.exit(1);
}
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS services(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price TEXT NOT NULL, descr TEXT DEFAULT '', pos INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT NOT NULL, text TEXT NOT NULL, stars INTEGER DEFAULT 5, pos INTEGER DEFAULT 0);
`);
if (!db.prepare('SELECT COUNT(*) c FROM settings').get().c) {
  const st = db.prepare('INSERT INTO settings VALUES(?,?)');
  Object.entries({ name: 'Merey Beauty Studio', tagline: 'Кірпік жасау — сіздің көзіңізге ерекше көрініс береміз', phone: '+7 700 000 00 00', address: 'Мекенжайды админ панельден енгізіңіз', hours: 'Күнде 10:00 – 20:00', instagram: '' }).forEach(([k, v]) => st.run(k, v));
  const sv = db.prepare('INSERT INTO services(name,price,descr,pos) VALUES(?,?,?,?)');
  [['Классика 1D', '8 000 ₸', 'Табиғи, жеңіл көрініс'], ['2D көлем', '10 000 ₸', 'Қою әрі нәзік'], ['3D көлем', '12 000 ₸', 'Айқын, әдемі көз'], ['Голливуд', '14 000 ₸', 'Максималды көлем'], ['Коррекция', '6 000 ₸', '2–3 апта сайын'], ['Кірпікті алу', '2 000 ₸', 'Қауіпсіз алып тастау']].forEach((r, i) => sv.run(...r, i));
  const rv = db.prepare('INSERT INTO reviews(author,text,stars,pos) VALUES(?,?,?,?)');
  [['Айгерім', 'Өте ұнады! Кірпіктер әдемі, ұзақ тұрады.', 5], ['Динара', 'Таза, жайлы студия. Шебері өте мұқият.', 5], ['Жанар', 'Үшінші рет келемін, нәтижесі керемет.', 5]].forEach((r, i) => rv.run(...r, i));
}

// ---- сессия (қол қойылған cookie) ----
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const makeToken = () => { const exp = Date.now() + 7 * 864e5; return exp + '.' + sign(String(exp)); };
const validToken = (t) => {
  if (!t) return false;
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const getCookie = (req, n) => (req.headers.cookie || '').split(';').map(c => c.trim().split('=')).find(c => c[0] === n)?.[1];
const auth = (req, res, next) => validToken(getCookie(req, 'sid')) ? next() : res.status(401).json({ error: 'Кіру қажет' });
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();

const tries = new Map();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' }); next(); });

const content = () => ({
  settings: Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r => [r.key, r.value])),
  services: db.prepare('SELECT name,price,descr FROM services ORDER BY pos').all(),
  reviews: db.prepare('SELECT author,text,stars FROM reviews ORDER BY pos').all(),
});
app.get('/api/content', (req, res) => res.json(content()));

app.post('/api/login', (req, res) => {
  const ip = req.ip, t = tries.get(ip) || { n: 0, until: 0 };
  if (t.until > Date.now()) return res.status(429).json({ error: 'Тым көп әрекет. 15 минуттан кейін қайталаңыз' });
  if (crypto.timingSafeEqual(hash(req.body?.password ?? ''), hash(PASS))) {
    tries.delete(ip);
    res.cookie('sid', makeToken(), { httpOnly: true, sameSite: 'strict', secure: process.env.SECURE_COOKIE === 'true', maxAge: 7 * 864e5 });
    return res.json({ ok: true });
  }
  t.n++; if (t.n >= 5) { t.until = Date.now() + 15 * 60e3; t.n = 0; }
  tries.set(ip, t);
  res.status(401).json({ error: 'Пароль қате' });
});
app.post('/api/logout', (req, res) => { res.clearCookie('sid'); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json({ admin: validToken(getCookie(req, 'sid')) }));

const str = (v, max) => String(v ?? '').trim().slice(0, max);
app.put('/api/content', auth, (req, res) => {
  const { settings = {}, services = [], reviews = [] } = req.body || {};
  if (!Array.isArray(services) || !Array.isArray(reviews) || services.length > 100 || reviews.length > 200) return res.status(400).json({ error: 'Қате деректер' });
  db.transaction(() => {
    const up = db.prepare('INSERT OR REPLACE INTO settings VALUES(?,?)');
    for (const k of ['name', 'tagline', 'phone', 'address', 'hours', 'instagram']) if (k in settings) up.run(k, str(settings[k], 300));
    db.prepare('DELETE FROM services').run(); db.prepare('DELETE FROM reviews').run();
    const sv = db.prepare('INSERT INTO services(name,price,descr,pos) VALUES(?,?,?,?)');
    services.forEach((s, i) => sv.run(str(s.name, 100), str(s.price, 40), str(s.descr, 200), i));
    const rv = db.prepare('INSERT INTO reviews(author,text,stars,pos) VALUES(?,?,?,?)');
    reviews.forEach((r, i) => rv.run(str(r.author, 60), str(r.text, 600), Math.min(5, Math.max(1, parseInt(r.stars) || 5)), i));
  })();
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.listen(process.env.PORT || 3000, () => console.log('Сайт іске қосылды: http://localhost:' + (process.env.PORT || 3000)));
