/* SQL Mastery - front-end (no framework, no build step) */
(() => {
  'use strict';

  const view = document.getElementById('view');
  let modulesCache = null;
  let labTimer = null;

  // ------------------------------------------------------------------ storage
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('sqlm.' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('sqlm.' + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
    remove(key) {
      try { localStorage.removeItem('sqlm.' + key); } catch { /* ignore */ }
    },
  };

  // ------------------------------------------------------------------ helpers
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Tiny inline markdown: `code`, **bold**, newlines. */
  const md = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  const h = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  async function api(path, body) {
    const res = await fetch('/api' + path, body === undefined
      ? {}
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    if (!res.ok && !data.error) data.error = { message: `HTTP ${res.status}` };
    return data;
  }

  async function getModules() {
    if (!modulesCache) modulesCache = await api('/modules');
    return modulesCache;
  }

  function setActiveNav(route) {
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
  }

  function updateProgress() {
    if (!modulesCache) return;
    const all = modulesCache.flatMap((m) => m.exercises);
    const done = store.get('progress', {});
    const n = all.filter((e) => done[e.id]).length;
    document.getElementById('progress-count').textContent = `${n}/${all.length}`;
    document.getElementById('progress-fill').style.width = `${all.length ? (n / all.length) * 100 : 0}%`;
  }

  /** Makes a textarea behave a little more like a code editor. */
  function enhanceEditor(textarea, { onRun, onSave } = {}) {
    textarea.spellcheck = false;
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (onRun) onRun();
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const { selectionStart: s, selectionEnd: end, value } = textarea;
        textarea.value = value.slice(0, s) + '  ' + value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = s + 2;
        if (onSave) onSave(textarea.value);
      }
    });
    if (onSave) textarea.addEventListener('input', () => onSave(textarea.value));
  }

  function renderTable(result) {
    const numeric = (v) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v));
    const head = result.columns.map((c) => `<th>${esc(c)}</th>`).join('');
    const body = result.rows.map((row) => '<tr>' + row.map((v) =>
      v === null ? '<td class="null">NULL</td>' : `<td class="${numeric(v) ? 'num' : ''}" title="${esc(v)}">${esc(v)}</td>`
    ).join('') + '</tr>').join('');
    return `<div class="table-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  /** Renders a /run response (results or error) into a container. */
  function renderRun(container, data, note) {
    if (data.error) {
      container.innerHTML = `<div class="alert bad"><strong>Error${data.error.errno ? ' ' + data.error.errno : ''}:</strong> ${esc(data.error.message)}</div>`;
      return;
    }
    const parts = [];
    if (note) parts.push(`<div class="alert info">${note}</div>`);
    data.results.forEach((r, i) => {
      const label = data.results.length > 1 ? `Statement ${i + 1}: ` : '';
      if (r.type === 'rows') {
        const count = r.truncated ? `${r.rowCount} rows (showing first ${r.rows.length})` : `${r.rowCount} row${r.rowCount === 1 ? '' : 's'}`;
        parts.push(`<div class="result-meta">${label}${count}</div>`);
        parts.push(r.columns.length ? renderTable(r) : '');
      } else {
        const info = r.info ? ` - ${esc(r.info)}` : '';
        parts.push(`<div class="result-meta">${label}OK, ${r.affectedRows} row${r.affectedRows === 1 ? '' : 's'} affected${info}</div>`);
      }
    });
    parts.push(`<div class="result-meta">Finished in ${data.elapsedMs} ms</div>`);
    container.innerHTML = parts.join('');
  }

  // ------------------------------------------------------------------ dashboard
  async function showDashboard() {
    const [modules, health] = await Promise.all([getModules(), api('/health')]);
    const done = store.get('progress', {});
    const lab = store.get('labResult', null);
    view.innerHTML = `
      <h1 class="page-title">Welcome to SQL Mastery</h1>
      <p class="lead">Read a chapter of the playbook, practise it with auto-graded exercises, experiment freely in the console,
      then prove it in the timed lab assessment. Everything runs against a real MySQL ${esc(health.version || '')} database.</p>
      <div class="btn-row" style="margin-bottom:18px"><a class="btn primary" href="#/practice">🗺 Meet the database (ER diagram)</a></div>
      <div class="grid" id="dash-stats"></div>
      <h2>Learning path</h2>
      <div class="grid" id="dash-modules"></div>`;
    const stats = document.getElementById('dash-stats');
    const total = modules.reduce((s, m) => s + m.exercises.length, 0);
    const solved = modules.reduce((s, m) => s + m.exercises.filter((e) => done[e.id]).length, 0);
    stats.append(
      h(`<div class="card"><div class="muted">Exercises solved</div><div class="stat">${solved} / ${total}</div></div>`),
      h(`<div class="card"><div class="muted">Best lab score</div><div class="stat">${lab ? lab.percent + '%' : '-'}</div><div class="muted">${lab ? (lab.passed ? 'Passed' : 'Not yet passed') : 'Not attempted'}</div></div>`),
      h(`<div class="card"><div class="muted">Database</div><div class="stat">${health.ok ? 'Online' : 'Offline'}</div>
         <div class="muted">${health.ok ? `${health.customers} customers · ${health.orders} orders · ${Number(health.web_events).toLocaleString()} web events` : esc((health.error || {}).message || '')}</div></div>`)
    );
    const list = document.getElementById('dash-modules');
    modules.forEach((m) => {
      const n = m.exercises.filter((e) => done[e.id]).length;
      list.append(h(`
        <div class="card">
          <h3 style="margin-top:0">${esc(m.title)}</h3>
          <p class="muted">${esc(m.summary)}</p>
          <p><span class="pill ${n === m.exercises.length ? 'ok' : ''}">${n}/${m.exercises.length} solved</span></p>
          <div class="btn-row">
            <a class="btn" href="#/playbook/${m.playbook}">Read</a>
            <a class="btn primary" href="#/practice/${(m.exercises.find((e) => !done[e.id]) || m.exercises[0]).id}">Practise</a>
          </div>
        </div>`));
    });
  }

  // ------------------------------------------------------------------ playbook
  async function showPlaybook(slug) {
    const chapters = await api('/playbook');
    if (!chapters.length) {
      view.innerHTML = '<div class="alert warn">No playbook chapters found.</div>';
      return;
    }
    const current = chapters.find((c) => c.slug === slug) || chapters[0];
    view.classList.add('full');
    view.innerHTML = `
      <div class="playbook">
        <nav class="list-pane">
          <h3>Playbook</h3>
          ${chapters.map((c) => `<a href="#/playbook/${c.slug}" class="${c.slug === current.slug ? 'active' : ''}">${esc(c.title)}</a>`).join('')}
        </nav>
        <div class="detail-pane"><article class="markdown" id="chapter">Loading…</article></div>
      </div>`;
    const chapter = await api('/playbook/' + current.slug);
    const article = document.getElementById('chapter');
    article.innerHTML = chapter.html; // rendered from local markdown files by the server

    // Chapter links like "02-intermediate.md" navigate inside the app
    article.querySelectorAll('a[href$=".md"], a[href*=".md#"]').forEach((a) => {
      const target = a.getAttribute('href').replace(/^.*\//, '').replace(/\.md(#.*)?$/, '');
      if (chapters.some((c) => c.slug === target)) a.setAttribute('href', '#/playbook/' + target);
    });

    // Live ER diagrams embedded in the markdown as <div class="er-embed" data-db="...">
    article.querySelectorAll('.er-embed').forEach((el) => ErDiagram.mount(el, { db: el.dataset.db || 'shopdb', allowDbSwitch: true }));

    // "Try it" buttons on SQL code blocks open the snippet in the console
    article.querySelectorAll('pre > code').forEach((code) => {
      const isSql = /language-sql/.test(code.className);
      if (!isSql) return;
      const btn = h('<button class="btn try-btn" title="Open in the SQL Console">Try it</button>');
      btn.addEventListener('click', () => {
        store.set('consoleDraft', code.textContent);
        location.hash = '#/console';
      });
      code.parentElement.append(btn);
    });
    document.querySelector('.detail-pane').scrollTop = 0;
  }

  // ------------------------------------------------------------------ practice
  function practiceListPane(modules, activeId, done) {
    return `
      <nav class="list-pane">
        <a href="#/practice" class="${activeId ? '' : 'active'}"><span>🗺 Meet the database (ER diagram)</span></a>
        ${modules.map((m) => `
          <h3>${esc(m.title)}</h3>
          ${m.exercises.map((e) => `
            <a href="#/practice/${e.id}" class="${e.id === activeId ? 'active' : ''}">
              <span>${esc(e.title)}</span><span class="tick">${done[e.id] ? '✓' : ''}</span>
            </a>`).join('')}`).join('')}
      </nav>`;
  }

  /** Landing page: the whole ShopCo schema before any exercise. */
  async function showPracticeOverview(modules) {
    const done = store.get('progress', {});
    const first = modules[0].exercises.find((e) => !done[e.id]) || modules[0].exercises[0];
    view.classList.add('full');
    view.innerHTML = `
      <div class="split">
        ${practiceListPane(modules, null, done)}
        <section class="detail-pane">
          <h1 class="page-title">Meet the ShopCo database</h1>
          <p class="lead">Every exercise runs against <code>shopdb</code>, the database of <strong>ShopCo</strong>, a small online retailer
            (DDL and transaction exercises use the scratch database <code>playground</code>). Get to know it here first:
            boxes are tables, lines are foreign keys (┤ = one, ≺ = many). Hover a table to see how it connects.
            You can reopen this diagram from any question with the <strong>ER diagram</strong> button.</p>
          <div class="btn-row"><a class="btn primary" href="#/practice/${first.id}">Start: ${esc(first.title)} →</a>
            <a class="btn" href="#/playbook/00-roadmap">Read the dataset guide</a></div>
          <div id="overview-diagram"></div>
          <h2>What each table holds</h2>
          <div class="desc-grid" id="overview-desc"></div>
          <h2>How to read the diagram</h2>
          <ul>
            <li><strong>PK</strong> (primary key) uniquely identifies a row, e.g. <code>orders.order_id</code>.</li>
            <li><strong>FK</strong> (foreign key) points to a PK in another table, e.g. <code>orders.customer_id → customers.customer_id</code>.
              Follow the FK lines to know what to put in a <code>JOIN ... ON</code>.</li>
            <li>A line's <em>many</em> end (≺) is the FK side: one customer has many orders.</li>
            <li><code>order_items</code> is a <em>junction table</em>: it links orders and products (many-to-many).</li>
            <li><code>employees.manager_id</code> and <code>categories.parent_category_id</code> point back to their own table (self-references → self joins and recursive CTEs).</li>
          </ul>
        </section>
      </div>`;
    ErDiagram.mount(document.getElementById('overview-diagram'), { db: 'shopdb', allowDbSwitch: true });
    try {
      const schema = await ErDiagram.fetchSchema('shopdb');
      document.getElementById('overview-desc').innerHTML = schema.tables.map((t) => `
        <div class="card"><code>${esc(t.name)}</code> <span class="muted">${t.type === 'VIEW' ? 'view' : '~' + Number(t.approx_rows || 0).toLocaleString() + ' rows'}</span>
          <div class="muted">${esc(ErDiagram.DESCRIPTIONS[t.name] || (t.type === 'VIEW' ? 'A saved query you can select from like a table.' : ''))}</div></div>`).join('');
    } catch { /* the diagram shows the error */ }
  }

  async function showPractice(exerciseId) {
    const modules = await getModules();
    if (!exerciseId) return showPracticeOverview(modules);
    const all = modules.flatMap((m) => m.exercises.map((e) => ({ ...e, module: m })));
    const ex = all.find((e) => e.id === exerciseId) || all[0];
    const idx = all.indexOf(ex);
    const done = store.get('progress', {});
    const drafts = store.get('drafts', {});

    view.classList.add('full');
    view.innerHTML = `
      <div class="split">
        ${practiceListPane(modules, ex.id, done)}
        <section class="detail-pane">
          <div class="meta-row">
            <span>${esc(ex.module.title)}</span><span>·</span><span class="pill">${esc(ex.topic)}</span>
            <span class="pill">${esc(ex.db || 'shopdb')}</span>
            ${done[ex.id] ? '<span class="pill ok">Solved</span>' : ''}
          </div>
          <h1 class="page-title">${esc(ex.title)}</h1>
          <div class="prompt">${md(ex.prompt)}</div>
          <div class="meta-row" id="ex-tables"></div>
          <div id="ex-diagram"></div>
          <textarea class="editor" id="ex-editor" placeholder="Write your SQL here…  (Ctrl+Enter = Run)"></textarea>
          <div class="btn-row" style="margin-top:10px">
            <button class="btn" id="ex-run">Run <span class="kbd">Ctrl+Enter</span></button>
            <button class="btn primary" id="ex-check">Check answer</button>
            <button class="btn" id="ex-hint">Hint</button>
            <button class="btn" id="ex-diagram-toggle">ER diagram</button>
            <button class="btn" id="ex-solution">Show solution</button>
            <a class="btn" href="#/playbook/${ex.module.playbook}">Read the chapter</a>
            <span style="flex:1"></span>
            ${idx > 0 ? `<a class="btn" href="#/practice/${all[idx - 1].id}">← Prev</a>` : ''}
            ${idx < all.length - 1 ? `<a class="btn" href="#/practice/${all[idx + 1].id}">Next →</a>` : ''}
          </div>
          <div id="ex-feedback"></div>
          <div id="ex-extra"></div>
          <div id="ex-results" class="results"></div>
        </section>
      </div>`;

    const editor = document.getElementById('ex-editor');
    const feedback = document.getElementById('ex-feedback');
    const extra = document.getElementById('ex-extra');
    const results = document.getElementById('ex-results');
    editor.value = drafts[ex.id] || '';

    const saveDraft = (value) => {
      const d = store.get('drafts', {});
      d[ex.id] = value;
      store.set('drafts', d);
    };

    // ---- ER diagram for this question, highlighting the tables it involves
    const diagramBox = document.getElementById('ex-diagram');
    const diagramBtn = document.getElementById('ex-diagram-toggle');
    const questionText = `${ex.prompt}\n${ex.solution}`;
    // e.g. a playground task that reads shopdb.legacy_sales is better explained with the shopdb diagram
    const diagramDb = /\bshopdb\./i.test(questionText) ? 'shopdb' : (ex.db || 'shopdb');
    let diagramTables = [];
    const showDiagram = (open) => {
      store.set('diagramOpen', open);
      diagramBtn.classList.toggle('primary', open);
      diagramBtn.textContent = open ? 'Hide ER diagram' : 'ER diagram';
      if (open) ErDiagram.mount(diagramBox, { db: diagramDb, highlight: diagramTables, allowDbSwitch: true });
      else diagramBox.innerHTML = '';
    };
    diagramBtn.onclick = () => showDiagram(!store.get('diagramOpen', false));
    ErDiagram.fetchSchema(diagramDb).then((schema) => {
      diagramTables = ErDiagram.tablesIn(questionText, schema.tables.map((t) => t.name));
      const chips = document.getElementById('ex-tables');
      if (chips && diagramTables.length) {
        chips.innerHTML = `<span>Tables in this question:</span>${diagramTables.map((t) =>
          `<button class="table-chip" title="${esc(ErDiagram.DESCRIPTIONS[t] || '')}">${esc(t)}</button>`).join('')}`;
        chips.querySelectorAll('.table-chip').forEach((c) => { c.onclick = () => showDiagram(true); });
      }
      if (store.get('diagramOpen', false)) showDiagram(true);
    }).catch(() => {});

    const run = async () => {
      if (ex.ddl) ErDiagram.invalidate(); // the structure may have changed
      results.innerHTML = '<div class="result-meta">Running…</div>';
      const data = await api('/sandbox/run', { sql: editor.value, db: ex.db || 'shopdb' });
      renderRun(results, data, ex.ddl
        ? 'Note: CREATE / ALTER / DROP statements are committed immediately (MySQL cannot roll back DDL).'
        : 'Practice runs are rolled back - data changes you see here are not saved.');
    };

    const check = async () => {
      if (ex.ddl) ErDiagram.invalidate();
      feedback.innerHTML = '<div class="result-meta">Checking…</div>';
      const data = await api(`/exercises/${ex.id}/check`, { sql: editor.value });
      if (data.error) {
        feedback.innerHTML = `<div class="alert bad">${esc(data.error.message)}</div>`;
        return;
      }
      feedback.innerHTML = `<div class="alert ${data.pass ? 'ok' : 'bad'}">${esc(data.message)}</div>`;
      if (data.actual) renderRun(results, { results: [data.actual], elapsedMs: '-' }, ex.check ? 'Result of the grader\'s check query after running your SQL:' : null);
      if (data.pass) {
        const d = store.get('progress', {});
        d[ex.id] = true;
        store.set('progress', d);
        updateProgress();
        const tick = document.querySelector(`.list-pane a[href="#/practice/${ex.id}"] .tick`);
        if (tick) tick.textContent = '✓';
      }
    };

    enhanceEditor(editor, { onRun: run, onSave: saveDraft });
    document.getElementById('ex-run').onclick = run;
    document.getElementById('ex-check').onclick = check;
    document.getElementById('ex-hint').onclick = () => { extra.innerHTML = `<div class="alert info"><strong>Hint:</strong> ${md(ex.hint || 'No hint for this one.')}</div>`; };
    document.getElementById('ex-solution').onclick = () => {
      extra.innerHTML = `<div class="result-meta">Model solution (other correct answers exist):</div><pre class="solution">${esc(ex.solution)}</pre>
        <button class="btn" id="ex-copy">Copy into editor</button>`;
      document.getElementById('ex-copy').onclick = () => { editor.value = ex.solution; saveDraft(ex.solution); editor.focus(); };
    };
    editor.focus();
  }

  // ------------------------------------------------------------------ console
  async function showConsole() {
    view.classList.add('full');
    const db = store.get('consoleDb', 'shopdb');
    view.innerHTML = `
      <div class="console">
        <aside class="schema-pane">
          <select id="db-select">
            <option value="shopdb">shopdb</option>
            <option value="playground">playground</option>
          </select>
          <div id="schema">Loading…</div>
        </aside>
        <section class="console-main">
          <h1 class="page-title">SQL Console</h1>
          <p class="muted" style="margin-top:0">A persistent session: transactions, variables and <code>USE</code> carry over between runs.
            Changes here are real - use <a href="#/settings">Settings → Reset</a> to restore the data.</p>
          <textarea class="editor" id="console-editor" style="min-height:220px" placeholder="SELECT * FROM customers LIMIT 10;"></textarea>
          <div class="btn-row" style="margin-top:10px">
            <button class="btn primary" id="console-run">Run <span class="kbd" style="color:inherit">Ctrl+Enter</span></button>
            <button class="btn" id="console-explain">EXPLAIN ANALYZE</button>
            <button class="btn" id="console-new">New session</button>
            <button class="btn" id="console-diagram">ER diagram</button>
            <span class="muted" id="console-db"></span>
          </div>
          <div id="console-diagram-box"></div>
          <div id="console-results" class="results"></div>
        </section>
      </div>`;

    const select = document.getElementById('db-select');
    const editor = document.getElementById('console-editor');
    const results = document.getElementById('console-results');
    const dbLabel = document.getElementById('console-db');
    select.value = db;
    editor.value = store.get('consoleDraft', 'SELECT * FROM customers LIMIT 10;');

    const loadSchema = async () => {
      const schema = await api('/schema?db=' + encodeURIComponent(select.value));
      const box = document.getElementById('schema');
      if (schema.error) { box.innerHTML = `<div class="alert bad">${esc(schema.error.message)}</div>`; return; }
      box.innerHTML = schema.tables.map((t) => `
        <details>
          <summary title="${t.type === 'VIEW' ? 'view' : '~' + (t.approx_rows ?? 0) + ' rows'}">${t.type === 'VIEW' ? '👁 ' : ''}${esc(t.name)}</summary>
          <div class="cols">${t.columns.map((c) =>
            `<div title="${esc(c.type)}${c.nullable === 'YES' ? ' NULL' : ''}"><span class="${c.key ? 'key' : ''}">${esc(c.name)}</span> ${esc(c.type)}</div>`).join('')}</div>
        </details>`).join('')
        + (schema.routines.length ? `<h4>Routines</h4>${schema.routines.map((r) => `<div class="muted">${esc(r.type.toLowerCase())} ${esc(r.name)}</div>`).join('')}` : '');
    };

    const run = async (sqlOverride) => {
      const sql = typeof sqlOverride === 'string' ? sqlOverride : editor.value;
      results.innerHTML = '<div class="result-meta">Running…</div>';
      const data = await api('/console/run', { sql, db: select.value });
      renderRun(results, data);
      if (data.database) {
        dbLabel.textContent = `Current database: ${data.database}`;
        // Follow a USE statement typed by the learner
        if (data.database !== select.value && [...select.options].some((o) => o.value === data.database)) {
          select.value = data.database;
          store.set('consoleDb', data.database);
          loadSchema();
        }
      }
      if (/\b(CREATE|ALTER|DROP|RENAME)\b/i.test(sql)) loadSchema();
    };

    enhanceEditor(editor, { onRun: run, onSave: (v) => store.set('consoleDraft', v) });
    select.onchange = async () => {
      store.set('consoleDb', select.value);
      await api('/console/run', { sql: 'SELECT DATABASE()', db: select.value });
      dbLabel.textContent = `Current database: ${select.value}`;
      loadSchema();
    };
    document.getElementById('console-run').onclick = () => run();
    document.getElementById('console-explain').onclick = () => {
      const stmt = editor.value.trim().replace(/;\s*$/, '');
      if (!/^(WITH|SELECT|UPDATE|DELETE|INSERT|TABLE)\b/i.test(stmt) || stmt.includes(';')) {
        results.innerHTML = '<div class="alert warn">EXPLAIN ANALYZE works on a single SELECT (or WITH / UPDATE / DELETE) statement.</div>';
        return;
      }
      run('EXPLAIN ANALYZE ' + stmt);
    };
    const diagramBtn = document.getElementById('console-diagram');
    diagramBtn.onclick = () => {
      const box = document.getElementById('console-diagram-box');
      const open = !box.innerHTML;
      diagramBtn.classList.toggle('primary', open);
      if (!open) { box.innerHTML = ''; return; }
      ErDiagram.invalidate(); // the console may have changed the schema
      ErDiagram.mount(box, { db: select.value, allowDbSwitch: true });
    };
    document.getElementById('console-new').onclick = async () => {
      await api('/console/new-session', {});
      results.innerHTML = '<div class="alert info">Started a new session (any open transaction was rolled back).</div>';
    };
    loadSchema();
    editor.focus();
  }

  // ------------------------------------------------------------------ lab
  async function showLab() {
    const lab = await api('/lab');
    const state = store.get('lab', null);
    if (labTimer) { clearInterval(labTimer); labTimer = null; }

    if (!state || !state.startedAt) return renderLabIntro(lab);
    if (state.result) return renderLabResult(lab, state);
    return renderLabRunning(lab, state);
  }

  function renderLabIntro(lab) {
    const best = store.get('labResult', null);
    const total = lab.tasks.reduce((s, t) => s + t.marks, 0);
    view.innerHTML = `
      <h1 class="page-title">${esc(lab.title)}</h1>
      <p class="lead">${lab.tasks.length} tasks · ${total} marks · ${lab.durationMinutes} minutes · pass mark ${lab.passMark}%</p>
      <div class="card" style="max-width:860px">
        <h3 style="margin-top:0">Instructions</h3>
        <ul>${lab.instructions.map((i) => `<li>${md(i)}</li>`).join('')}</ul>
        <div class="alert warn">Tip: reset the database first (<a href="#/settings">Settings</a>) so earlier practice doesn't affect your answers.</div>
        <div class="btn-row"><button class="btn primary" id="lab-start">Start the lab</button>
        ${best ? `<span class="muted">Previous best: ${best.percent}%</span>` : ''}</div>
      </div>`;
    document.getElementById('lab-start').onclick = () => {
      store.set('lab', { startedAt: Date.now(), answers: {} });
      showLab();
    };
  }

  function renderLabRunning(lab, state) {
    const sections = [...new Set(lab.tasks.map((t) => t.section))];
    view.classList.add('full');
    view.style.overflow = 'auto';
    view.innerHTML = `
      <div class="lab-bar">
        <div class="task-nav">${lab.tasks.map((t) => `<a href="#task-${t.id}" data-task="${t.id}">${t.id}</a>`).join('')}</div>
        <div class="btn-row"><span class="timer" id="lab-timer"></span>
          <button class="btn danger" id="lab-abandon">Abandon</button>
          <button class="btn success" id="lab-submit">Submit for grading</button></div>
      </div>
      <div style="padding: 10px 32px 80px; max-width: 1000px">
        ${sections.map((s) => `<h2>Section ${esc(s)}</h2>` + lab.tasks.filter((t) => t.section === s).map((t) => `
          <div class="task" id="task-${t.id}">
            <h3>${t.id}. ${esc(t.title)} <span class="pill">${t.marks} marks</span> <span class="pill">${esc(t.db || 'shopdb')}</span></h3>
            <div class="prompt">${md(t.prompt)}</div>
            <textarea class="editor" data-task="${t.id}" placeholder="Your answer… (Ctrl+Enter = Run)"></textarea>
            <div class="btn-row" style="margin-top:6px"><button class="btn" data-run="${t.id}">Run</button>
              <button class="btn" data-diagram="${t.id}">ER diagram</button></div>
            <div id="diag-${t.id}"></div>
            <div class="results" id="res-${t.id}"></div>
          </div>`).join('')).join('')}
      </div>`;

    // Keep in-page anchors from changing the router hash
    view.querySelectorAll('.task-nav a').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('task-' + a.dataset.task).scrollIntoView({ behavior: 'smooth' });
    }));

    const markAnswered = () => {
      const answers = store.get('lab', state).answers || {};
      view.querySelectorAll('.task-nav a').forEach((a) => a.classList.toggle('answered', !!(answers[a.dataset.task] || '').trim()));
    };

    view.querySelectorAll('textarea[data-task]').forEach((ta) => {
      const id = ta.dataset.task;
      const task = lab.tasks.find((t) => t.id === id);
      ta.value = (state.answers || {})[id] || '';
      const run = async () => {
        const out = document.getElementById('res-' + id);
        if (task.ddl) ErDiagram.invalidate();
        out.innerHTML = '<div class="result-meta">Running…</div>';
        renderRun(out, await api('/sandbox/run', { sql: ta.value, db: task.db || 'shopdb' }),
          task.ddl ? 'DDL is committed immediately; the grader recreates objects when you submit.' : 'Rolled back - data unchanged.');
      };
      enhanceEditor(ta, {
        onRun: run,
        onSave: (v) => {
          const s = store.get('lab', state);
          s.answers = { ...(s.answers || {}), [id]: v };
          store.set('lab', s);
          markAnswered();
        },
      });
      view.querySelector(`[data-run="${id}"]`).onclick = run;
      // Full diagram without highlighting - picking the tables is part of the assessment
      const diagBtn = view.querySelector(`[data-diagram="${id}"]`);
      diagBtn.onclick = () => {
        const box = document.getElementById('diag-' + id);
        const open = !box.innerHTML;
        diagBtn.classList.toggle('primary', open);
        if (!open) { box.innerHTML = ''; return; }
        const db = /\bshopdb\./i.test(task.prompt) ? 'shopdb' : (task.db || 'shopdb');
        ErDiagram.mount(box, { db, allowDbSwitch: true });
      };
    });
    markAnswered();

    const endsAt = state.startedAt + lab.durationMinutes * 60000;
    const timerEl = document.getElementById('lab-timer');
    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      timerEl.classList.toggle('low', left < 10 * 60000);
      if (left === 0) { clearInterval(labTimer); labTimer = null; submit(true); }
    };
    labTimer = setInterval(tick, 1000);
    tick();

    const submit = async (timeUp) => {
      if (!timeUp && !confirm('Submit all answers for grading?')) return;
      const btn = document.getElementById('lab-submit');
      if (btn) { btn.disabled = true; btn.textContent = 'Grading… (this can take a minute)'; }
      const s = store.get('lab', state);
      const result = await api('/lab/submit', { answers: s.answers || {} });
      if (result.error) {
        alert('Grading failed: ' + result.error.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Submit for grading'; }
        return;
      }
      s.result = result;
      s.finishedAt = Date.now();
      store.set('lab', s);
      const best = store.get('labResult', null);
      if (!best || result.percent >= best.percent) store.set('labResult', { percent: result.percent, passed: result.passed });
      if (labTimer) { clearInterval(labTimer); labTimer = null; }
      showLab();
    };
    document.getElementById('lab-submit').onclick = () => submit(false);
    document.getElementById('lab-abandon').onclick = () => {
      if (!confirm('Abandon this attempt? Your answers will be discarded.')) return;
      store.remove('lab');
      showLab();
    };
  }

  function renderLabResult(lab, state) {
    const r = state.result;
    const band = r.percent >= 85 ? 'Distinction' : r.percent >= 70 ? 'Merit' : r.percent >= lab.passMark ? 'Pass' : 'Not yet - revise and retake';
    const mins = Math.round((state.finishedAt - state.startedAt) / 60000);
    const bySection = {};
    r.results.forEach((x) => {
      bySection[x.section] = bySection[x.section] || { got: 0, total: 0 };
      bySection[x.section].got += x.awarded;
      bySection[x.section].total += x.marks;
    });
    view.innerHTML = `
      <h1 class="page-title">Lab results</h1>
      <div class="grid">
        <div class="card"><div class="muted">Score</div><div class="score-big" style="color:var(${r.passed ? '--ok' : '--bad'})">${r.percent}%</div>
          <div>${r.score} / ${r.total} marks · <strong>${band}</strong></div><div class="muted">Time taken: ${mins} min</div></div>
        <div class="card"><div class="muted">By section</div>
          ${Object.entries(bySection).map(([s, v]) => `<div>${esc(s)}: <strong>${v.got}/${v.total}</strong></div>`).join('')}</div>
      </div>
      <div class="btn-row" style="margin:18px 0"><button class="btn primary" id="lab-retake">Retake the lab</button>
        <button class="btn" id="lab-export">Download my answers (.sql)</button></div>
      <div class="card">
        ${r.results.map((x) => `
          <div class="result-row ${x.pass ? 'pass' : 'fail'}">
            <strong>${x.id}</strong>
            <div><div><strong>${esc(x.title)}</strong></div>
              ${x.pass ? '' : `<div class="muted">${esc(x.message)}</div>`}
              <details><summary class="muted">Model solution</summary><pre class="solution">${esc(x.solution)}</pre>
                <div class="muted">Your answer:</div><pre class="solution">${esc((state.answers || {})[x.id] || '(blank)')}</pre></details>
            </div>
            <div class="mark">${x.awarded}/${x.marks}</div>
          </div>`).join('')}
      </div>`;
    document.getElementById('lab-retake').onclick = () => {
      if (!confirm('Start a new attempt? (Tip: reset the database first in Settings.)')) return;
      store.set('lab', { startedAt: Date.now(), answers: {} });
      showLab();
    };
    document.getElementById('lab-export').onclick = () => {
      const text = lab.tasks.map((t) => `-- @task ${t.id}   ${t.title}\n${((state.answers || {})[t.id] || '').trim()}\n`).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      a.download = 'lab-answers.sql';
      a.click();
      URL.revokeObjectURL(a.href);
    };
  }

  // ------------------------------------------------------------------ settings
  function showSettings() {
    view.innerHTML = `
      <h1 class="page-title">Settings</h1>
      <p class="lead">Restore the practice data whenever you have broken something - that is what it is for.</p>
      <div class="grid" style="max-width:900px">
        <div class="card"><h3 style="margin-top:0">Reset database</h3>
          <p class="muted">Rebuilds <code>shopdb</code> and <code>playground</code> from the seed scripts (about 10-30 seconds). Your own tables, views and routines are removed.</p>
          <button class="btn danger" data-reset="all">Reset everything</button></div>
        <div class="card"><h3 style="margin-top:0">Reset playground only</h3>
          <p class="muted">Rebuilds only the <code>playground</code> scratch database.</p>
          <button class="btn" data-reset="playground">Reset playground</button></div>
        <div class="card"><h3 style="margin-top:0">Progress</h3>
          <p class="muted">Clears solved exercises, saved drafts and lab attempts stored in this browser.</p>
          <button class="btn danger" id="clear-progress">Clear my progress</button></div>
      </div>
      <div id="settings-msg" style="max-width:900px"></div>`;
    const msg = document.getElementById('settings-msg');
    view.querySelectorAll('[data-reset]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Reset now?')) return;
        view.querySelectorAll('[data-reset]').forEach((b) => { b.disabled = true; });
        msg.innerHTML = '<div class="alert info">Resetting… please wait.</div>';
        const r = await api('/admin/reset', { scope: btn.dataset.reset });
        msg.innerHTML = r.ok
          ? `<div class="alert ok">Done in ${(r.elapsedMs / 1000).toFixed(1)} s (ran ${r.files.join(', ')}).</div>`
          : `<div class="alert bad">Reset failed: ${esc((r.error || {}).message || 'unknown error')}</div>`;
        view.querySelectorAll('[data-reset]').forEach((b) => { b.disabled = false; });
        checkHealth();
      };
    });
    document.getElementById('clear-progress').onclick = () => {
      if (!confirm('Clear all progress stored in this browser?')) return;
      ['progress', 'drafts', 'lab', 'labResult', 'consoleDraft'].forEach((k) => store.remove(k));
      updateProgress();
      msg.innerHTML = '<div class="alert ok">Progress cleared.</div>';
    };
  }

  // ------------------------------------------------------------------ router
  async function checkHealth() {
    const el = document.getElementById('db-status');
    try {
      const hlt = await api('/health');
      el.className = 'db-status ' + (hlt.ok ? 'ok' : 'bad');
      el.textContent = hlt.ok ? `MySQL ${hlt.version}` : 'Database unavailable';
    } catch {
      el.className = 'db-status bad';
      el.textContent = 'App server unreachable';
    }
  }

  async function route() {
    const [, name = 'dashboard', arg] = (location.hash || '#/dashboard').split('/');
    if (labTimer && name !== 'lab') { clearInterval(labTimer); labTimer = null; }
    view.classList.remove('full');
    view.style.overflow = '';
    setActiveNav(name);
    try {
      switch (name) {
        case 'playbook': await showPlaybook(arg); break;
        case 'practice': await showPractice(arg); break;
        case 'console': await showConsole(); break;
        case 'lab': await showLab(); break;
        case 'settings': showSettings(); break;
        default: await showDashboard();
      }
    } catch (err) {
      view.innerHTML = `<div class="alert bad">Something went wrong: ${esc(err.message)}</div>`;
    }
    view.focus({ preventScroll: true });
  }

  window.addEventListener('hashchange', route);
  getModules().then(updateProgress).catch(() => {});
  checkHealth();
  route();
})();
