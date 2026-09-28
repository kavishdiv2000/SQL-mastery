#!/usr/bin/env node
// Grades a lab answer sheet from the command line.
//   node scripts/grade-lab.js ../lab/answer-sheet.sql
//
// Answer sheet format: each answer starts with a marker line
//   -- @task A1
// followed by the SQL for that task (until the next marker).
const fs = require('fs');
const path = require('path');
const { grade } = require('../lib/grader');

const LAB_DIR = process.env.LAB_DIR || path.join(__dirname, '..', '..', 'lab');
const file = process.argv[2] || path.join(LAB_DIR, 'answer-sheet.sql');

function parseAnswerSheet(text) {
  const answers = {};
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*--\s*@task\s+([A-Za-z0-9_-]+)/.exec(line);
    if (m) { current = m[1].toUpperCase(); answers[current] = ''; continue; }
    if (current) answers[current] += line + '\n';
  }
  // Treat answers that contain only comments/whitespace as blank
  for (const id of Object.keys(answers)) {
    const code = answers[id].replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(--|#).*$/gm, '').trim();
    if (!code) delete answers[id];
  }
  return answers;
}

(async () => {
  if (!fs.existsSync(file)) {
    console.error(`Answer sheet not found: ${file}`);
    process.exit(1);
  }
  const lab = require(path.join(LAB_DIR, 'lab-tasks.js'));
  const answers = parseAnswerSheet(fs.readFileSync(file, 'utf8'));

  console.log(`\n${lab.title}\nGrading ${file}\n`);
  let score = 0;
  let total = 0;
  for (const task of lab.tasks) {
    total += task.marks;
    const r = await grade(task, answers[task.id], { revealDiff: false });
    if (r.pass) score += task.marks;
    const mark = r.pass ? 'PASS' : 'FAIL';
    console.log(`[${mark}] ${task.id.padEnd(3)} ${task.title.padEnd(48)} ${String(r.pass ? task.marks : 0).padStart(2)}/${task.marks}`);
    if (!r.pass) console.log(`        ${r.message}`);
  }
  const pct = Math.round((score / total) * 100);
  console.log(`\nScore: ${score}/${total} (${pct}%)  -  ${pct >= lab.passMark ? 'PASSED' : 'NOT YET PASSED'} (pass mark ${lab.passMark}%)\n`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
