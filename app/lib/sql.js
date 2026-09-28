// SQL execution helpers shared by the web server, the grader and the CLI.
const mysql = require('mysql2/promise');

const MAX_ROWS_RETURNED = 1000;

function connectionOptions(database) {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'learner',
    password: process.env.DB_PASSWORD || 'learnerpass',
    database: database === null ? undefined : database || 'shopdb', // null = no default database
    multipleStatements: true, // lets learners run a whole script in one go
    dateStrings: true,        // show DATE/DATETIME exactly as MySQL stores them
    charset: 'utf8mb4',
  };
}

function connect(database) {
  return mysql.createConnection(connectionOptions(database));
}

/**
 * Splits a script that uses the mysql-client `DELIMITER` command into
 * individual statements. Quotes and comments are respected so a delimiter
 * inside a string or comment does not end the statement.
 */
function splitStatements(sql) {
  const statements = [];
  let delimiter = ';';
  let current = '';
  let i = 0;
  let atLineStart = true;

  const push = () => {
    if (current.trim()) statements.push(current.trim());
    current = '';
  };

  while (i < sql.length) {
    // DELIMITER directive (only valid at the start of a line)
    if (atLineStart) {
      const m = /^[ \t]*DELIMITER[ \t]+(\S+)[ \t]*(\r?\n|$)/i.exec(sql.slice(i));
      if (m) {
        push();
        delimiter = m[1];
        i += m[0].length;
        continue;
      }
    }

    const ch = sql[i];
    const next = sql[i + 1];

    // Comments: copy through without interpreting
    if ((ch === '-' && next === '-' && /\s/.test(sql[i + 2] || ' ')) || ch === '#') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      current += sql.slice(i, stop);
      i = stop;
      atLineStart = false;
      continue;
    }

    // Quoted strings / identifiers
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '\\' && ch !== '`') { j += 2; continue; }
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) { j += 2; continue; } // doubled quote
          break;
        }
        j++;
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
      atLineStart = false;
      continue;
    }

    if (sql.startsWith(delimiter, i)) {
      push();
      i += delimiter.length;
      atLineStart = false;
      continue;
    }

    current += ch;
    atLineStart = ch === '\n';
    i++;
  }
  push();
  return statements;
}

function cellValue(v) {
  if (Buffer.isBuffer(v)) {
    const text = v.toString('utf8');
    return /^[\x09\x0a\x0d\x20-\x7e -￿]*$/.test(text) ? text : '0x' + v.toString('hex');
  }
  if (typeof v === 'bigint') return v.toString();
  return v;
}

function toResult(rows, fields) {
  if (Array.isArray(fields)) {
    return {
      type: 'rows',
      columns: fields.map((f) => f.name),
      rows: rows.map((r) => r.map(cellValue)),
    };
  }
  return {
    type: 'ok',
    affectedRows: rows.affectedRows,
    insertId: rows.insertId,
    info: rows.info || '',
    warningStatus: rows.warningStatus,
  };
}

/** Runs one server round-trip and normalises the (possibly multi-statement) response. */
async function execRaw(conn, sql) {
  const [rows, fields] = await conn.query({ sql, rowsAsArray: true });
  const isMulti =
    Array.isArray(fields) && fields.length > 0 && fields.every((f) => f === undefined || f === null || Array.isArray(f));
  if (!isMulti) return [toResult(rows, fields)];
  return rows.map((r, idx) => toResult(r, fields[idx]));
}

/**
 * Runs a script. Without DELIMITER the whole text is sent to the server,
 * which understands multi-statement scripts (including BEGIN...END bodies).
 * With DELIMITER the script is split client-side, like the mysql CLI does.
 */
async function runScript(conn, sql) {
  if (!sql || !sql.trim()) throw new Error('Nothing to run - the SQL is empty.');
  if (!/^[ \t]*DELIMITER[ \t]+/im.test(sql)) return execRaw(conn, sql);
  const results = [];
  for (const statement of splitStatements(sql)) {
    results.push(...(await execRaw(conn, statement)));
  }
  return results;
}

/** Last result set that actually returned rows/columns (e.g. the SELECT after a CALL). */
function lastRowSet(results) {
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].type === 'rows') return results[i];
  }
  return null;
}

function truncateForClient(results) {
  return results.map((r) => {
    if (r.type !== 'rows' || r.rows.length <= MAX_ROWS_RETURNED) return { ...r, rowCount: r.rows ? r.rows.length : undefined };
    return { ...r, rowCount: r.rows.length, rows: r.rows.slice(0, MAX_ROWS_RETURNED), truncated: true };
  });
}

function formatError(err) {
  return {
    message: err.sqlMessage || err.message,
    code: err.code,
    errno: err.errno,
  };
}

module.exports = { connect, connectionOptions, splitStatements, runScript, lastRowSet, truncateForClient, formatError };
