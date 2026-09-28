/* ER diagram: renders the live database schema (tables, columns, foreign keys) as SVG.
 * Usage:  ErDiagram.mount(container, { db: 'shopdb', highlight: ['orders'], allowDbSwitch: true })
 */
(() => {
  'use strict';

  const BOX_W = 230;
  const HEAD_H = 28;
  const ROW_H = 18;
  const PAD = 20;

  // Hand-tuned positions for the ShopCo schema so related tables sit next to each other.
  // Tables not listed here (e.g. ones you create) are placed automatically underneath.
  const LAYOUTS = {
    shopdb: {
      departments: [20, 20], employees: [20, 170], web_events: [20, 440],
      customers: [320, 20], orders: [320, 280], payments: [320, 500],
      product_reviews: [620, 20], order_items: [620, 280],
      products: [920, 20], legacy_sales: [920, 300],
      categories: [1220, 20], suppliers: [1220, 170],
    },
  };

  const DESCRIPTIONS = {
    departments: 'Company departments. "Research" has no employees.',
    employees: 'Staff. manager_id points to another employee, forming an org chart. One contractor has no department.',
    customers: 'People who shop at ShopCo. Customers 111-120 have never ordered; some have no phone.',
    orders: 'One row per order (2023-2024). employee_id = sales rep, NULL for self-service web orders.',
    order_items: 'The lines of an order. Revenue of a line = quantity * unit_price * (1 - discount).',
    payments: 'One payment per order that was not cancelled and is not pending.',
    products: 'The catalogue. Products 37-40 were never ordered; 39 is discontinued.',
    categories: 'A category tree: parent_category_id points to the parent category.',
    suppliers: 'Companies that supply the products.',
    product_reviews: 'Customer ratings (1-5) and optional review text.',
    web_events: '200,000 website clicks. Only a primary key - perfect for index experiments.',
    legacy_sales: 'A badly designed spreadsheet import, used to practise normalisation.',
    accounts: 'Bank accounts for the transaction lessons.',
    transfers: 'A log of money transfers between accounts.',
    app_users: 'Login table for the SQL-injection lesson.',
  };

  const cache = new Map();

  async function fetchSchema(db) {
    if (!cache.has(db)) {
      cache.set(db, fetch('/api/schema?db=' + encodeURIComponent(db)).then((r) => r.json()).then((s) => {
        if (s.error) { cache.delete(db); throw new Error(s.error.message); }
        return s;
      }).catch((err) => { cache.delete(db); throw err; }));
    }
    return cache.get(db);
  }

  function invalidate() { cache.clear(); }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Table names from `names` that appear as whole words in `text`. */
  function tablesIn(text, names) {
    const t = String(text || '');
    return names.filter((n) => new RegExp('(^|[^A-Za-z0-9_])' + n + '([^A-Za-z0-9_]|$)', 'i').test(t));
  }

  function shortType(type) {
    if (/^enum\(/i.test(type)) return 'enum';
    return type.length > 16 ? type.slice(0, 15) + '…' : type;
  }

  function boxHeight(t) { return HEAD_H + t.columns.length * ROW_H + 8; }

  function layout(schema) {
    const tables = schema.tables.filter((t) => t.type !== 'VIEW');
    const preset = LAYOUTS[schema.db] || {};
    const pos = {};
    let maxY = 0;
    for (const t of tables) {
      if (preset[t.name]) {
        pos[t.name] = { x: preset[t.name][0], y: preset[t.name][1] };
        maxY = Math.max(maxY, pos[t.name].y + boxHeight(t));
      }
    }
    // Masonry placement for everything else
    const cols = 5;
    const bottoms = Array(cols).fill(maxY ? maxY + 40 : 20);
    for (const t of tables) {
      if (pos[t.name]) continue;
      const c = bottoms.indexOf(Math.min(...bottoms));
      pos[t.name] = { x: 20 + c * (BOX_W + 70), y: bottoms[c] };
      bottoms[c] += boxHeight(t) + 30;
    }
    let width = 0;
    let height = 0;
    for (const t of tables) {
      width = Math.max(width, pos[t.name].x + BOX_W);
      height = Math.max(height, pos[t.name].y + boxHeight(t));
    }
    // extra room on the right for self-reference loops
    return { tables, pos, width: width + PAD + 30, height: height + PAD };
  }

  function rowY(table, col, p) {
    const i = Math.max(0, table.columns.findIndex((c) => c.name === col));
    return p.y + HEAD_H + i * ROW_H + ROW_H / 2 + 2;
  }

  function renderSvg(schema, highlight) {
    const { tables, pos, width, height } = layout(schema);
    const byName = Object.fromEntries(tables.map((t) => [t.name, t]));
    const hl = new Set((highlight || []).filter((n) => byName[n]));
    const fkCols = new Set(schema.foreignKeys.map((f) => f.tbl + '.' + f.col));
    const parts = [];

    // --- relationships (drawn first so boxes sit on top)
    for (const fk of schema.foreignKeys) {
      const child = byName[fk.tbl];
      const parent = byName[fk.ref_tbl];
      if (!child || !parent) continue;
      const pc = pos[fk.tbl];
      const pp = pos[fk.ref_tbl];
      const y1 = rowY(child, fk.col, pc);
      const y2 = rowY(parent, fk.ref_col, pp);
      let x1, x2, d1, d2;
      if (fk.tbl === fk.ref_tbl || pc.x === pp.x) {
        x1 = pc.x + BOX_W; x2 = pp.x + BOX_W; d1 = 1; d2 = 1;           // loop on the right side
      } else if (pp.x > pc.x) {
        x1 = pc.x + BOX_W; x2 = pp.x; d1 = 1; d2 = -1;
      } else {
        x1 = pc.x; x2 = pp.x + BOX_W; d1 = -1; d2 = 1;
      }
      const bend = x1 === x2 ? 34 : Math.max(40, Math.abs(x2 - x1) / 2);
      const cls = hl.size ? (hl.has(fk.tbl) && hl.has(fk.ref_tbl) ? 'hl' : 'dim') : '';
      const path = `M${x1},${y1} C${x1 + d1 * bend},${y1} ${x2 + d2 * bend},${y2} ${x2},${y2}`;
      // crow's foot (many) at the child end, bar (one) at the parent end
      const crow = `M${x1 + d1 * 12},${y1} L${x1},${y1 - 6} M${x1 + d1 * 12},${y1} L${x1},${y1} M${x1 + d1 * 12},${y1} L${x1},${y1 + 6}`;
      const bar = `M${x2 + d2 * 7},${y2 - 6} L${x2 + d2 * 7},${y2 + 6}`;
      parts.push(`<g class="er-edge ${cls}" data-from="${esc(fk.tbl)}" data-to="${esc(fk.ref_tbl)}">
        <title>${esc(fk.tbl)}.${esc(fk.col)} → ${esc(fk.ref_tbl)}.${esc(fk.ref_col)} (many-to-one)</title>
        <path d="${path}"/><path d="${crow}"/><path d="${bar}"/></g>`);
    }

    // --- tables
    for (const t of tables) {
      const p = pos[t.name];
      const h = boxHeight(t);
      const cls = hl.size ? (hl.has(t.name) ? 'hl' : 'dim') : '';
      const rows = t.columns.map((c, i) => {
        const y = HEAD_H + i * ROW_H + ROW_H / 2 + 6;
        const isFk = fkCols.has(t.name + '.' + c.name);
        const badge = c.key === 'PRI' ? '<tspan class="er-pk">PK</tspan>' : isFk ? '<tspan class="er-fk">FK</tspan>' : c.key === 'UNI' ? '<tspan class="er-uq">UQ</tspan>' : '';
        return `<text class="er-badge" x="10" y="${y}">${badge}</text>
          <text class="er-col${c.nullable === 'YES' ? ' er-null' : ''}" x="34" y="${y}">${esc(c.name)}<title>${esc(c.name)} ${esc(c.type)}${c.nullable === 'YES' ? ' NULL' : ' NOT NULL'}</title></text>
          <text class="er-type" x="${BOX_W - 10}" y="${y}" text-anchor="end">${esc(shortType(c.type))}</text>`;
      }).join('');
      const rowsHint = t.approx_rows != null ? `~${Number(t.approx_rows).toLocaleString()} rows` : '';
      parts.push(`<g class="er-table ${cls}" data-table="${esc(t.name)}" transform="translate(${p.x},${p.y})">
        <title>${esc(t.name)}${DESCRIPTIONS[t.name] ? ' - ' + esc(DESCRIPTIONS[t.name]) : ''}</title>
        <rect class="er-box" width="${BOX_W}" height="${h}" rx="7"/>
        <path class="er-head" d="M0,7 a7,7 0 0 1 7,-7 h${BOX_W - 14} a7,7 0 0 1 7,7 v${HEAD_H - 7} h-${BOX_W} z"/>
        <text class="er-title" x="10" y="19">${esc(t.name)}</text>
        <text class="er-rows" x="${BOX_W - 10}" y="19" text-anchor="end">${esc(rowsHint)}</text>
        ${rows}</g>`);
    }

    return { svg: `<svg class="er-svg" viewBox="0 0 ${width} ${height}" data-w="${width}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Entity relationship diagram of ${esc(schema.db)}">${parts.join('')}</svg>`, hl };
  }

  /** Hovering a table highlights it, its relationships and its neighbours. */
  function wireHover(root) {
    const svg = root.querySelector('.er-svg');
    if (!svg) return;
    svg.querySelectorAll('.er-table').forEach((g) => {
      g.addEventListener('mouseenter', () => {
        const name = g.dataset.table;
        const related = new Set([name]);
        svg.querySelectorAll('.er-edge').forEach((e) => {
          const on = e.dataset.from === name || e.dataset.to === name;
          e.classList.toggle('focus', on);
          if (on) { related.add(e.dataset.from); related.add(e.dataset.to); }
        });
        svg.querySelectorAll('.er-table').forEach((t) => t.classList.toggle('focus', related.has(t.dataset.table)));
        svg.classList.add('hovering');
      });
      g.addEventListener('mouseleave', () => {
        svg.classList.remove('hovering');
        svg.querySelectorAll('.focus').forEach((x) => x.classList.remove('focus'));
      });
    });
  }

  /**
   * Renders an interactive diagram panel into `container`.
   * opts: db, highlight (array of table names), allowDbSwitch, compact
   */
  async function mount(container, opts = {}) {
    let db = opts.db || 'shopdb';
    let fit = true;
    const draw = async () => {
      container.innerHTML = '<div class="result-meta">Loading diagram…</div>';
      let schema;
      try {
        schema = await fetchSchema(db);
      } catch (err) {
        container.innerHTML = `<div class="alert bad">Could not load the schema: ${esc(err.message)}</div>`;
        return;
      }
      const { svg, hl } = renderSvg(schema, opts.highlight);
      const views = schema.tables.filter((t) => t.type === 'VIEW').map((t) => t.name);
      container.innerHTML = `
        <div class="er-panel">
          <div class="er-toolbar">
            ${opts.allowDbSwitch ? `<div class="er-tabs">${['shopdb', 'playground'].map((d) =>
              `<button class="btn ${d === db ? 'primary' : ''}" data-db="${d}">${d}</button>`).join('')}</div>` : `<strong>${esc(db)}</strong>`}
            <span class="er-legend"><span class="er-pk">PK</span> primary key <span class="er-fk">FK</span> foreign key
              <span class="er-uq">UQ</span> unique <em>italic</em> = nullable · ┤ one ─ ≺ many</span>
            <span style="flex:1"></span>
            <button class="btn" data-zoom>${fit ? 'Actual size' : 'Fit to width'}</button>
          </div>
          ${hl.size ? `<div class="er-note">Highlighted: tables this question uses (${[...hl].map(esc).join(', ')}). Hover any table to see its relationships.</div>`
                    : '<div class="er-note">Hover a table to highlight its relationships. Hover a column for its full type.</div>'}
          <div class="er-scroll ${fit ? 'fit' : ''}">${svg}</div>
          ${views.length ? `<div class="er-note">Views: ${views.map((v) => `<code>${esc(v)}</code>`).join(' ')}</div>` : ''}
          ${!schema.tables.length ? '<div class="er-note">This database has no tables yet.</div>' : ''}
        </div>`;
      const svgEl = container.querySelector('.er-svg');
      if (svgEl && !fit) svgEl.style.width = svgEl.dataset.w + 'px';
      wireHover(container);
      container.querySelector('[data-zoom]').onclick = () => { fit = !fit; draw(); };
      container.querySelectorAll('[data-db]').forEach((b) => { b.onclick = () => { db = b.dataset.db; draw(); }; });
    };
    await draw();
  }

  window.ErDiagram = { mount, fetchSchema, invalidate, tablesIn, DESCRIPTIONS };
})();
