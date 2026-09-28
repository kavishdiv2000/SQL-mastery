#!/usr/bin/env node
// Self-test for course content: every exercise and lab task must pass when its own
// model solution is submitted. Also flags solutions that return 0 rows (usually a
// sign that the task wording or the seed data is off).
//   docker exec sqlm-app node scripts/verify-content.js
const path = require('path');
const { grade } = require('../lib/grader');
const modules = require('../content/exercises');

const LAB_DIR = process.env.LAB_DIR || path.join(__dirname, '..', '..', 'lab');
const lab = require(path.join(LAB_DIR, 'lab-tasks.js'));

(async () => {
  const tasks = [
    ...modules.flatMap((m) => m.exercises.map((e) => ({ ...e, _group: m.id }))),
    ...lab.tasks.map((t) => ({ ...t, _group: 'lab' })),
  ];
  let failures = 0;
  for (const task of tasks) {
    const r = await grade(task, task.solution, { revealDiff: true });
    const rows = r.actual ? r.actual.rows.length : 0;
    const flag = !r.pass ? 'FAIL' : rows === 0 ? 'EMPTY' : 'ok';
    if (flag !== 'ok') failures++;
    console.log(`${flag.padEnd(5)} ${task._group.padEnd(4)} ${task.id.padEnd(20)} rows=${String(rows).padEnd(5)} ${r.pass ? '' : r.message}`);
  }
  console.log(`\n${tasks.length} tasks checked, ${failures} problem(s).`);
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
