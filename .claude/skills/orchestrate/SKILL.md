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

- **Opus keeps full context** across all sub-tasks instead of each
  sonnet session starting cold from a ticket.
- **Parallel worktrees** mean agents don't block each other.
- **Unified review** catches cross-cutting issues that per-ticket
  reviews miss.
- **One PR** instead of many — less overhead for the human, fewer
  merge conflicts, testable as a whole.

---

## Phase 1: Understand

Before planning anything, build a complete picture.

1. **Read the task** — fetch the issue body and labels. If it's an
   epic, fetch all sub-issues too.
2. **Explore the codebase** — use Explore agents to understand the
   systems involved. Don't research yourself — let Explore agents do
   it so your context stays clean for orchestration.
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
- What the project is and what it does (one sentence)
- What specific change to make and why
- Which files to read first for context
- Which files to create or modify
- The exact output file path(s)
- Relevant conventions (from AGENTS.md, CLAUDE.md)
- Instruction to commit with a descriptive message
- Any patterns to follow (point at existing code as examples)

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

For each approved worktree:

```bash
git cherry-pick <commit-sha>
```

Cherry-pick in dependency order (batch 1 first, then batch 2, etc.).
This avoids conflicts from later batches depending on earlier ones.

### Handling merge conflicts

When a cherry-pick conflicts:

1. **Don't resolve it yourself.** You are the orchestrator.
2. Check what conflicted and why (usually two tasks touched adjacent
   lines, or a batch-2 task assumed batch-1 output that merged
   slightly differently).
3. Spin up a **sonnet** agent with the conflict context:

```
Agent({
  description: "Resolve merge conflict in <file>",
  model: "sonnet",
  prompt: "
    You are resolving a merge conflict in <file>.
    
    The conflict arose because:
    - Change A (from task '<description>'): <what it did and why>
    - Change B (from task '<description>'): <what it did and why>
    
    Both changes are correct and should be preserved. The intended
    final state is: <describe the desired outcome>.
    
    The file currently has conflict markers. Resolve them so both
    changes coexist correctly. Run `npm test` to verify.
    
    Commit the resolution.
  "
})
```

4. Review the resolution. If it's wrong, try again with a more
   specific prompt.

### After all merges

Run the full test suite:

```bash
npm test
```

If tests fail, diagnose which merge introduced the failure and spin
up a fix agent. The orchestrator reads the error, identifies the
cause, and writes a precise prompt for the fix — but never fixes
the code directly.

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
- **Under-specifying conventions** → agent doesn't know about
  kebab-case files, theme system, no-logic-in-hooks rule. Copy
  the relevant AGENTS.md/CLAUDE.md rules into the prompt.
- **Sending the agent on a research mission** → "explore the
  codebase and figure out what to do" wastes tokens and produces
  unfocused results. Do the research yourself (via Explore agents)
  in Phase 1, then give the implementation agent precise instructions.
