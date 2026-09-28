// Auto-grading: runs the learner's SQL and the model solution the same way,
// then compares what they produce.
//
// Task / exercise fields used here:
//   db        database to run in (default 'shopdb')
//   ddl       true when the SQL contains DDL (CREATE/ALTER/DROP...). DDL causes an
//             implicit COMMIT in MySQL, so it cannot run inside a rolled-back transaction.
//   setup     SQL run before each attempt (e.g. DROP TABLE IF EXISTS ...)
//   check     SQL whose result is compared (default: the learner's own last result set).
//             It always runs inside a transaction that is rolled back.
//   cleanup   SQL run after each attempt
//   ordered   true when row order matters (the task asks for ORDER BY)
//   requires  [[regexSource, message], ...]  the SQL text must match these
//   forbids   [[regexSource, message], ...]  the SQL text must NOT match these
const { connect, runScript, lastRowSet } = require('./sql');

function normalizeValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v.trim()))) {
    const n = Number(v);
    if (Number.isFinite(n)) return (Math.round(n * 100) / 100).toFixed(2);
  }
  return String(v);
}

/** Returns [{ norm, raw }] - normalised values for comparing, raw values for messages. */
function normalizeRows(rows, ordered) {
  const out = rows.map((raw) => ({ raw, norm: raw.map(normalizeValue), key: JSON.stringify(raw.map(normalizeValue)) }));
  if (!ordered) out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return out;
}

// Numbers may differ by one cent when the learner rounds at a different step
// than the model solution (e.g. rounds each order before averaging).
function cellsEqual(a, b) {
  if (a === b) return true;
  const num = /^-?\d+\.\d{2}$/;
  return num.test(a) && num.test(b) && Math.abs(Number(a) - Number(b)) < 0.0101;
}

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(--\s|#).*$/gm, ' ');
}

function checkTextRules(task, sql) {
  const text = stripComments(sql);
  for (const [pattern, message] of task.requires || []) {
    if (!new RegExp(pattern, 'i').test(text)) return message;
  }
  for (const [pattern, message] of task.forbids || []) {
    if (new RegExp(pattern, 'i').test(text)) return message;
  }
  return null;
}

/** Runs one attempt in a fresh connection and returns the result set to compare. */
async function runAttempt(task, sql) {
  const conn = await connect(task.db || 'shopdb');
  try {
    await conn.query('SET SESSION innodb_lock_wait_timeout = 5, SESSION max_execution_time = 30000');
    if (task.setup) await runScript(conn, task.setup);
    let results;
    try {
      if (!task.ddl) await conn.query('START TRANSACTION');
      results = await runScript(conn, sql);
      if (task.check) {
        if (task.ddl) await conn.query('START TRANSACTION');
        results = await runScript(conn, task.check);
      }
    } finally {
      await conn.query('ROLLBACK').catch(() => {});
      if (task.cleanup) await runScript(conn, task.cleanup).catch(() => {});
    }
    return lastRowSet(results);
  } finally {
    await conn.end().catch(() => {});
  }
}

// The solution is re-run on every grade (not cached) so that it always sees the
// same data as the learner's attempt, even after they changed data in the console.
function expectedResult(task) {
  return runAttempt(task, task.solution);
}

function describeRow(row) {
  return '(' + row.map((v) => (v === null ? 'NULL' : v)).join(', ') + ')';
}

/**
 * Grades one answer.
 * @param {object} task    exercise or lab task definition
 * @param {string} sql     learner's SQL
 * @param {object} opts    { revealDiff: boolean } - show expected values in feedback
 * @returns {Promise<{pass:boolean, message:string, actual?:object}>}
 */
async function grade(task, sql, opts = { revealDiff: true }) {
  if (!sql || !sql.trim()) return { pass: false, message: 'No answer submitted.' };

  const ruleFailure = checkTextRules(task, sql);

  let actual;
  try {
    actual = await runAttempt(task, sql);
  } catch (err) {
    return { pass: false, message: `Your SQL raised an error: ${err.sqlMessage || err.message}` };
  }

  let expected;
  try {
    expected = await expectedResult(task);
  } catch (err) {
    return { pass: false, message: `Could not run the model solution (is the database reset?): ${err.sqlMessage || err.message}` };
  }

  if (!expected) return { pass: false, message: 'The model solution returned no result set - please report this task.' };
  if (!actual) {
    return {
      pass: false,
      message: task.check
        ? 'The check query returned nothing.'
        : 'Your SQL did not return a result set. This task expects rows - is it a SELECT?',
    };
  }

  const fail = (message) => ({ pass: false, message, actual });

  if (actual.columns.length !== expected.columns.length) {
    return fail(
      task.check
        ? `The resulting structure differs from what was asked (expected ${expected.columns.length} values, got ${actual.columns.length}).`
        : `Expected ${expected.columns.length} column(s) [${expected.columns.join(', ')}], but your query returned ${actual.columns.length} [${actual.columns.join(', ')}].`
    );
  }
  if (actual.rows.length !== expected.rows.length) {
    return fail(`Expected ${expected.rows.length} row(s), but got ${actual.rows.length}.`);
  }

  const a = normalizeRows(actual.rows, task.ordered);
  const e = normalizeRows(expected.rows, task.ordered);
  for (let i = 0; i < e.length; i++) {
    for (let c = 0; c < e[i].norm.length; c++) {
      if (!cellsEqual(a[i].norm[c], e[i].norm[c])) {
        const where = task.ordered ? `Row ${i + 1}` : 'At least one row';
        const detail = opts.revealDiff ? ` Expected ${describeRow(e[i].raw)} but found ${describeRow(a[i].raw)}.` : '';
        const orderHint = task.ordered ? ' (Row order matters for this task - check your ORDER BY.)' : '';
        return fail(`${where} does not match.${detail}${orderHint}`);
      }
    }
  }

  if (ruleFailure) return fail(`The result is correct, but: ${ruleFailure}`);
  return { pass: true, message: 'Correct! Your result matches the expected output.', actual };
}

module.exports = { grade, normalizeValue };
