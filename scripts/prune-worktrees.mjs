import { execSync } from 'node:child_process';
import { basename } from 'node:path';

const WORKTREE_DIR = '.claude/worktrees';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

function getWorktrees() {
  const raw = run('git worktree list --porcelain');
  const entries = [];
  let current = {};
  for (const line of raw.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length) };
    } else if (line === '') {
      if (current.path) entries.push(current);
      current = {};
    }
  }
  if (current.path) entries.push(current);
  return entries.filter((e) => e.path.includes(WORKTREE_DIR));
}

const nameFilter = process.argv[2];

const worktrees = getWorktrees();
const targets = nameFilter
  ? worktrees.filter((w) => basename(w.path).includes(nameFilter))
  : worktrees;

if (targets.length === 0) {
  const msg = nameFilter
    ? `No worktrees matching "${nameFilter}" found.`
    : 'No agent worktrees to clean up.';
  console.log(msg);
  process.exit(0);
}

console.log(`Removing ${targets.length} worktree(s):\n`);

for (const wt of targets) {
  const name = basename(wt.path);
  try {
    try { run(`git worktree unlock "${wt.path}"`); } catch { /* already unlocked */ }
    run(`git worktree remove "${wt.path}" --force`);
    console.log(`  pruned ${name}`);
  } catch (err) {
    console.error(`  FAILED ${name}: ${err.message}`);
  }
}

console.log('\nDone.');
