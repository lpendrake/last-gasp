---
name: orchestrate
description: Use this skill to orchestrate the implementation of a complex, multi-part task. The orchestrator (opus) never writes code — it plans, delegates to sonnet/haiku agents in parallel worktrees, reviews their output, merges results, resolves conflicts, and ships a single PR. Use when a task spans multiple files or systems and would benefit from parallel execution with unified oversight.
---

# Orchestrate a Complex Task

You are the orchestrator. You plan, delegate, review, and merge — you
**never write code yourself**. Cheaper models (sonnet, haiku) do the
implementation in isolated worktrees. You maintain the big picture,
catch mistakes early, and ship one cohesive PR.

## When to use

| Scenario | Use this? |
|---|---|
| Task touches 3+ files across different systems | Yes |
| Epic or sub-epic with multiple sub-tasks | Yes |
| Task is large but confined to one file/module | No — give it to sonnet directly |
| Quick bug fix or typo | No |

## Why this works

Opus holds full context while cheaper agents implement slices in
parallel worktrees; unified review catches cross-cutting issues and
ships one PR instead of many.

---

## Phase 1: Understand

Before planning anything, build a complete picture.

1. **Read the task** — fetch the issue body and labels. If it's an
   epic, fetch all sub-issues too.
2. **Explore the codebase** — use Explore agents to understand the
   systems involved. Don't research yourself — let Explore agents do
   it so your context stays clean for orchestration. Right-size the
   fan-out: a single well-scoped ticket usually needs 1–2 targeted
   Explores; reserve 3+ parallel Explores for genuine multi-system
   epics. Each agent has real token cost — orchestration earns its
   overhead through parallelism and isolation, not through spawning
   agents for their own sake.
3. **Identify the AGENTS.md and CLAUDE.md rules** that apply. Your
   sub-agents won't read these unless you tell them to.
4. **Ask the user** if anything is ambiguous. Do this now, not after
   you've spun up six agents.

## Phase 2: Plan

Break the work into **tasks** and organise them into **batches**.

### Task design

Each task must be:
- **Self-contained** — completable by a sonnet agent with no knowledge
  of other tasks. Include all context it needs in the prompt.
- **One output area** — ideally one file, at most a handful of closely
  related files. Two tasks must never write to the same file in the
  same batch.
- **Testable in isolation** — if it changes code, it should leave
  tests passing.

### Batch ordering

Tasks within a batch run in parallel. Batches run sequentially.

```
Batch 1:  [A] [B] [C]     ← no dependencies between A, B, C
              ↓
Batch 2:  [D] [E]          ← D depends on A; E depends on B
              ↓
Batch 3:  [F]              ← F depends on D and E
```

Rules:
- Two tasks in the same batch must not touch the same files.
- If task X depends on task Y's output, X goes in a later batch.
- If task A modifies file X and task B **reads** file X to inform
  its work, B must go in a later batch — even if B doesn't write
  to file X. Otherwise B works against stale content.
- Maximise parallelism — if a task has no dependencies, put it in
  the earliest possible batch.

### Choosing the model

| Task type | Model |
|---|---|
| New feature code, refactors, anything non-trivial | sonnet |
| Mechanical renames, simple doc updates, config changes | haiku |
| Conflict resolution (needs understanding of both sides) | sonnet |

### Present the plan

Before executing, tell the user:
- The batch structure (which tasks, which batch, which model)
- Which files each task will touch
- Any risks or judgment calls

Don't ask "is this plan OK?" — just present it clearly and proceed
unless the user intervenes. They asked you to orchestrate, not to
ask permission at every step.

## Phase 3: Execute

### Setup

1. Create a feature branch off `main`: `git checkout -b <branch-name>`
2. Ensure `npm install` has been run (pre-commit hooks need it).

### Launch a batch

For each task in the batch, launch an Agent with `isolation: "worktree"`:

```
Agent({
  description: "Short task name",
  isolation: "worktree",
  model: "sonnet",  // or "haiku"
  run_in_background: true,
  prompt: "<your detailed prompt>"
})
```

**Writing good prompts** — the agent has zero context, so include:
- **For batch 2+ only:** a literal step 0 — "before anything else, run
  `git reset --hard <feature-branch>` to base your work on the merged
  output of earlier batches" (see Phase 5 → *Between batches* for why).
  Batch-1 agents skip this; `main` is already their correct base.
- What the project is and what it does (one sentence)
- What specific change to make and why
- Which files to read first for context
- Which files to create or modify
- The exact output file path(s)
- Relevant conventions (from AGENTS.md, CLAUDE.md)
- Commit message format: start with `#<issue-number>`, describe the
  user-facing change (see CLAUDE.md Git etiquette). Instruct the
  agent to squash its work into a single commit before finishing.
- Any patterns to follow (point at existing code as examples)

**For tasks that produce testable code**, include a test scenario
table. The orchestrator has cross-cutting context that the agent
lacks — use it to specify meaningful edge cases upfront:

```markdown
| # | Test title | Intended coverage |
|---|---|---|
| 1 | "returns override when present" | verifies override ?? default fallback |
| 2 | "handles missing frontmatter gracefully" | empty file doesn't crash the scanner |
| 3 | "preserves custom tags during sync" | syncEntityTags only touches id:* tags |
```

The agent implements these as real test cases. This prevents the
common failure mode where agents write tests that mirror the
implementation instead of testing behavior. Skip the table for
docs-only or config-only tasks.

**Don't include**:
- Instructions about other tasks (the agent doesn't need to know)
- Your orchestration plan
- Vague instructions like "explore and figure it out" — be specific

### Wait for completion

Background agents notify you when done. Don't poll. Don't sleep.
Work on something else or wait.

## Phase 4: Review

When an agent completes, evaluate its worktree.

### Check the diff

```bash
git -C <worktree-path> diff HEAD~1 --stat
```

Verify:
- Only the expected files were changed (agents sometimes go rogue)
- No code changes in a docs-only task, no unrelated "improvements"
- The diff size is reasonable for the task

### Read the output

Read the key files the agent created/modified. Check for:
- **Accuracy** — does it match the actual codebase?
- **Completeness** — does it cover what was asked?
- **Convention adherence** — file names kebab-case, no hardcoded
  colors, logic not inside components, etc.
- **Quality** — is it clear, concise, well-structured?

### Decide

| Verdict | Action |
|---|---|
| **Approve** | Cherry-pick the commit into your branch (Phase 5) |
| **Minor fix needed** | Send a follow-up message to the same agent (via `SendMessage` with the agent's ID) with specific fix instructions. Or spin up a new agent in the same worktree. |
| **Major problems** | Discard the worktree. Diagnose what went wrong with the prompt. Rewrite the prompt and launch a fresh agent. |

### Rogue agent detection

Watch for these signs:
- Diff touches files outside the task scope
- Agent made code changes when only docs were requested
- Agent "improved" unrelated code
- Agent skipped pre-commit hooks

If an agent went rogue, discard its worktree entirely. Don't try to
salvage partial work — it's faster and safer to re-run with a better
prompt.

## Phase 5: Merge

### Cherry-pick approved work

Check how many commits the agent made (relative to your feature
branch, which is the agent's base once it has run step 0):

```bash
git -C <worktree-path> log --oneline <feature-branch>..HEAD
```

If the agent made a single commit (as instructed), cherry-pick it:

```bash
git cherry-pick <commit-sha>
```

If the agent made multiple commits, cherry-pick the range:

```bash
git cherry-pick <oldest-sha>^..<newest-sha>
```

Cherry-pick in dependency order (batch 1 first, then batch 2, etc.).

**Test after each cherry-pick**, not just at the end:

```bash
npm test
```

This immediately isolates any failure to the cherry-pick that caused
it, rather than forcing you to bisect across all merged work.

### Clean up worktrees after each batch

After cherry-picking all work from a batch, remove the worktrees
before running tests (they inflate test counts — see Common Pitfalls):

```bash
npm run prune-worktrees
```

To remove a specific worktree by name fragment:

```bash
npm run prune-worktrees -- agent-abc
```

### Between batches — rebase later agents onto your branch

**Worktrees branch from the base branch (`main`), not your feature
branch.** So a batch-2 agent does **not** automatically see batch-1's
merged work — left alone, it will re-implement against stale `main`
and its commit won't cherry-pick cleanly. Don't fight this on the
merge-back side; fix it at the source.

The repo's worktrees share the same `.git` (verified: commits survive
`prune-worktrees`, and local branch refs resolve from inside a
worktree). So every batch-2+ agent's **step 0** is to rebase its
worktree onto your feature branch using the **local ref** — no push,
no fetch needed:

```bash
git reset --hard <feature-branch>
```

Put that as the first instruction in the agent's prompt. Its commit is
then parented on your feature-branch tip, so merge-back is an ordinary
clean cherry-pick (Phase 5). Because of this, **the feature branch must
have all prior batches merged before you launch the next batch.**

Sanity-check the base of any agent you're unsure about:

```bash
git -C <worktree-path> rev-parse HEAD~1   # should be your feature-branch tip
```

> If a future harness ever isolates worktrees as separate clones
> (local refs won't resolve), fall back to: push the feature branch,
> then have the agent `git fetch origin <feature-branch> && git reset
> --hard origin/<feature-branch>`.

### Handling merge conflicts

If you rebased each batch's agents onto the feature branch (Phase 5 →
*Between batches*), clean cherry-picks are the norm. A conflict means
two tasks in the **same** batch touched adjacent lines — which the
"one file per batch" rule should have prevented.

When a cherry-pick does conflict:

1. **Don't resolve it yourself.** You are the orchestrator.
2. Diagnose which two changes collided and why.
3. Spin up a **sonnet** agent to resolve it. Give it: the file, a
   one-line summary of each colliding change and why both must be
   kept, the intended final state, and "resolve the conflict markers,
   run `npm test`, commit." Review the result; re-prompt if wrong.

## Phase 6: Ship

1. **Push** the branch:
   ```bash
   git push -u origin <branch-name>
   ```

2. **Create the PR** with a summary covering all sub-tasks. Reference
   all closed issues. Use the PR template.

3. **Subscribe to PR activity** so you can respond to CI failures
   and review comments.

---

## Orchestrator rules (non-negotiable)

1. **Never write code.** Not even "just this one quick fix." Delegate
   everything. If you catch yourself reaching for Edit or Write on a
   source file, stop and spin up an agent instead.

2. **Never skip pre-commit hooks.** If an agent's commit fails hooks,
   that's a bug in the agent's output — fix the prompt and re-run.

3. **Review every diff.** Don't blindly merge worktrees. Read the
   actual files, not just the agent's summary of what it did.

4. **Keep the user informed.** State what you're doing at each phase
   transition. Report batch progress. Flag risks early.

5. **One PR per orchestration.** The whole point is unified review.
   Don't split into multiple PRs unless the user asks.

## Common pitfalls

- **Prompts too vague** → agent explores randomly, produces generic
  output. Be specific: file paths, function names, expected patterns.
- **Two tasks in one batch touch the same file** → guaranteed merge
  conflict. Put them in separate batches with the second depending on
  the first.
- **Forgetting `npm install`** → pre-commit hooks fail with
  "command not found". Run it once before the first commit.
- **Not reading the worktree diff** → you miss rogue changes that
  modify unrelated code or make unauthorized "improvements".
- **Over-batching** → 10 parallel agents sounds fast but produces
  10 things to review simultaneously. 3-5 per batch is practical.
- **Splitting too fine** → a task smaller than the coordination
  overhead it creates (prompt-writing, review, cherry-pick) isn't
  worth its own agent. If two slices touch the same area and one is
  trivial, fold them into one task. Cost scales with agent count.
- **Under-specifying conventions** → agent doesn't know about
  kebab-case files, theme system, no-logic-in-hooks rule. Copy
  the relevant AGENTS.md/CLAUDE.md rules into the prompt.
- **Sending the agent on a research mission** → "explore the
  codebase and figure out what to do" wastes tokens and produces
  unfocused results. Do the research yourself (via Explore agents)
  in Phase 1, then give the implementation agent precise instructions.
- **Stale worktrees pollute test runs** → worktrees live under
  `.claude/worktrees/` inside the repo. Test runners will recurse
  into them and count every test file N extra times. Always clean
  up after each batch with `npm run prune-worktrees` (see Phase 5).
  Note: `vite.config.ts` excludes `.claude/worktrees/**` from
  vitest, but always prune anyway to avoid disk bloat.

## Aborting mid-orchestration

If the user asks to stop, or something goes fundamentally wrong:

1. Clean up all worktrees (use the cleanup script from Phase 5).
2. Ensure the feature branch is in a testable state — all
   cherry-picked work passes `npm test`.
3. Note which batches completed and which didn't.
4. If resuming later, the user can re-invoke the skill and point at
   the partial branch. The orchestrator picks up from the next
   incomplete batch.

## See also

- `CLAUDE.md` — planning workflow, git etiquette, commit message
  format, oversight tiers, pre-commit hook rules.
- The relevant module's `AGENTS.md` — conventions to include in
  agent prompts (layer rules, file naming, patterns).
