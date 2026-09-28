// SQL Mastery learning app - Express server
const path = require('path');
const fs = require('fs');
const express = require('express');
const { marked } = require('marked');

const { connect, runScript, splitStatements, truncateForClient, formatError } = require('./lib/sql');
const { grade } = require('./lib/grader');
const modules = require('./content/exercises');

const ROOT = path.join(__dirname, '..');
const PLAYBOOK_DIR = process.env.PLAYBOOK_DIR || path.join(ROOT, 'playbook');
const LAB_DIR = process.env.LAB_DIR || path.join(ROOT, 'lab');
const SEED_DIR = process.env.SEED_DIR || path.join(ROOT, 'workstation', 'mysql', 'init');
const PORT = Number(process.env.PORT || 3000);
const ALLOWED_DBS = ['shopdb', 'playground'];

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: formatError(err) });
  });

const pickDb = (db) => (ALLOWED_DBS.includes(db) ? db : 'shopdb');

// ---------------------------------------------------------------------------
// Console: one persistent session, so BEGIN / SET @var / USE carry over
// between runs exactly like a real SQL client.
// ---------------------------------------------------------------------------
let consoleConn = null;

async function getConsoleConn() {
  if (consoleConn) return consoleConn;
  consoleConn = await connect('shopdb');
  consoleConn.on('error', () => { consoleConn = null; });
  await consoleConn.query('SET SESSION max_execution_time = 60000');
  return consoleConn;
}

async function closeConsoleConn() {
  if (!consoleConn) return;
  const c = consoleConn;
  consoleConn = null;
  await c.end().catch(() => c.destroy());
}

app.post('/api/console/run', wrap(async (req, res) => {
  const { sql, db } = req.body || {};
  const conn = await getConsoleConn();
  if (db) await conn.query(`USE \`${pickDb(db)}\``);
  const started = Date.now();
  try {
    const results = await runScript(conn, sql);
    const [[current]] = await conn.query({ sql: 'SELECT DATABASE()', rowsAsArray: true });
    res.json({ results: truncateForClient(results), elapsedMs: Date.now() - started, database: current[0] });
  } catch (err) {
    if (err.fatal) consoleConn = null;
    res.json({ error: formatError(err), elapsedMs: Date.now() - started });
  }
}));

app.post('/api/console/new-session', wrap(async (req, res) => {
  await closeConsoleConn();
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Sandbox run: used by Practice and Lab "Run" buttons. Runs in a fresh
// connection inside a transaction that is always rolled back, so trying out
// an UPDATE/DELETE does not change the data. (DDL still auto-commits.)
// ---------------------------------------------------------------------------
app.post('/api/sandbox/run', wrap(async (req, res) => {
  const { sql, db } = req.body || {};
  const conn = await connect(pickDb(db));
  const started = Date.now();
  try {
    await conn.query('SET SESSION max_execution_time = 30000, SESSION innodb_lock_wait_timeout = 5');
    await conn.query('START TRANSACTION');
    const results = await runScript(conn, sql);
    res.json({ results: truncateForClient(results), elapsedMs: Date.now() - started, rolledBack: true });
  } catch (err) {
    res.json({ error: formatError(err), elapsedMs: Date.now() - started });
  } finally {
    await conn.query('ROLLBACK').catch(() => {});
    await conn.end().catch(() => {});
  }
}));

// ---------------------------------------------------------------------------
// Schema browser
// ---------------------------------------------------------------------------
app.get('/api/schema', wrap(async (req, res) => {
  const db = pickDb(req.query.db);
  const conn = await connect(db);
  try {
    const [tables] = await conn.query(
      `SELECT table_name AS name, table_type AS type, table_rows AS approx_rows
         FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`, [db]);
    const [columns] = await conn.query(
      `SELECT table_name AS tbl, column_name AS name, column_type AS type, is_nullable AS nullable, column_key AS \`key\`
         FROM information_schema.columns WHERE table_schema = ? ORDER BY table_name, ordinal_position`, [db]);
    const [routines] = await conn.query(
      `SELECT routine_name AS name, routine_type AS type FROM information_schema.routines
        WHERE routine_schema = ? ORDER BY routine_type, routine_name`, [db]);
    const [foreignKeys] = await conn.query(
      `SELECT table_name AS tbl, column_name AS col, referenced_table_name AS ref_tbl, referenced_column_name AS ref_col
         FROM information_schema.key_column_usage
        WHERE table_schema = ? AND referenced_table_name IS NOT NULL`, [db]);
    for (const t of tables) t.columns = columns.filter((c) => c.tbl === t.name);
    res.json({ db, tables, routines, foreignKeys });
  } finally {
    await conn.end().catch(() => {});
  }
}));

app.get('/api/health', wrap(async (req, res) => {
  const conn = await connect('shopdb');
  try {
    const [[row]] = await conn.query(
      `SELECT VERSION() AS version,
              (SELECT COUNT(*) FROM customers) AS customers,
              (SELECT COUNT(*) FROM orders) AS orders,
              (SELECT COUNT(*) FROM order_items) AS order_items,
              (SELECT COUNT(*) FROM web_events) AS web_events`);
    res.json({ ok: true, ...row });
  } catch (err) {
    res.json({ ok: false, error: formatError(err) });
  } finally {
    await conn.end().catch(() => {});
  }
}));

// ---------------------------------------------------------------------------
// Practice exercises
// ---------------------------------------------------------------------------
const publicExercise = ({ setup, check, cleanup, requires, forbids, ...rest }) => rest;
const allExercises = new Map(modules.flatMap((m) => m.exercises.map((e) => [e.id, e])));

app.get('/api/modules', (req, res) => {
  res.json(modules.map((m) => ({ ...m, exercises: m.exercises.map(publicExercise) })));
});

app.post('/api/exercises/:id/check', wrap(async (req, res) => {
  const ex = allExercises.get(req.params.id);
  if (!ex) return res.status(404).json({ error: { message: 'Unknown exercise' } });
  const result = await grade(ex, (req.body || {}).sql, { revealDiff: true });
  res.json({ pass: result.pass, message: result.message, actual: result.actual && truncateForClient([result.actual])[0] });
}));

// ---------------------------------------------------------------------------
// Lab assessment (task file lives in /lab so it can be edited without rebuilding)
// ---------------------------------------------------------------------------
function loadLab() {
  const file = path.join(LAB_DIR, 'lab-tasks.js');
  delete require.cache[require.resolve(file)];
  return require(file);
}

app.get('/api/lab', (req, res) => {
  const lab = loadLab();
  res.json({
    ...lab,
    tasks: lab.tasks.map(({ solution, setup, check, cleanup, requires, forbids, ...t }) => t),
  });
});

app.post('/api/lab/submit', wrap(async (req, res) => {
  const lab = loadLab();
  const answers = (req.body || {}).answers || {};
  const results = [];
  // Sequential on purpose: several tasks create/drop the same objects.
  for (const task of lab.tasks) {
    const r = await grade(task, answers[task.id], { revealDiff: false });
    results.push({
      id: task.id, title: task.title, section: task.section, marks: task.marks,
      awarded: r.pass ? task.marks : 0, pass: r.pass, message: r.message, solution: task.solution,
    });
  }
  const total = lab.tasks.reduce((s, t) => s + t.marks, 0);
  const score = results.reduce((s, r) => s + r.awarded, 0);
  res.json({ score, total, percent: Math.round((score / total) * 100), passMark: lab.passMark, passed: (score / total) * 100 >= lab.passMark, results });
}));

// ---------------------------------------------------------------------------
// Playbook (markdown files rendered to HTML)
// ---------------------------------------------------------------------------
function listChapters() {
  if (!fs.existsSync(PLAYBOOK_DIR)) return [];
  return fs.readdirSync(PLAYBOOK_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const text = fs.readFileSync(path.join(PLAYBOOK_DIR, file), 'utf8');
      const title = (text.match(/^#\s+(.+)$/m) || [null, file])[1];
      return { slug: file.replace(/\.md$/, ''), file, title };
    });
}

app.get('/api/playbook', (req, res) => res.json(listChapters()));

app.get('/api/playbook/:slug', (req, res) => {
  const chapter = listChapters().find((c) => c.slug === req.params.slug);
  if (!chapter) return res.status(404).json({ error: { message: 'Chapter not found' } });
  const md = fs.readFileSync(path.join(PLAYBOOK_DIR, chapter.file), 'utf8');
  res.json({ ...chapter, html: marked.parse(md) });
});

// ---------------------------------------------------------------------------
// Reset the practice databases from the seed scripts
// ---------------------------------------------------------------------------
app.post('/api/admin/reset', wrap(async (req, res) => {
  const scope = (req.body || {}).scope === 'playground' ? 'playground' : 'all';
  await closeConsoleConn(); // release any locks held by an open console transaction
  const files = fs.readdirSync(SEED_DIR)
    .filter((f) => /^\d+-.*\.sql$/.test(f) && !f.startsWith('00-'))
    .filter((f) => scope === 'all' || f.includes('playground'))
    .sort();
  const conn = await connect(null); // no default db: shopdb may be missing or about to be dropped
  const started = Date.now();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(SEED_DIR, file), 'utf8');
      for (const statement of splitStatements(sql)) await conn.query(statement);
    }
    res.json({ ok: true, files, elapsedMs: Date.now() - started });
  } catch (err) {
    res.json({ ok: false, files, error: formatError(err) });
  } finally {
    await conn.end().catch(() => {});
  }
}));

app.listen(PORT, () => {
  console.log(`SQL Mastery app listening on http://localhost:${PORT}`);
});
