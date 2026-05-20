# Claude instructions

## Running scripts

Prefer npm scripts over calling binaries directly. Check `package.json` first and use:

- `npm test` — run all tests once and exit
- `npm test -- <pattern>` — run only tests matching a file path or name pattern
- `npm run test:watch` — run tests in watch mode
- `npm run build` — build renderer + main
- `npm run lint` — lint check
- `npm run lint:fix` — lint and auto-fix

Only use `npx <tool>` when there is genuinely no npm script for the task.

## Planning workflow for issue-driven tasks

When you've been pointed at a GitHub issue (e.g. given a URL with a "title" prefix and told to use the ticket as your prompt):

### 1. Fetch the issue first

Before doing anything else, fetch both the **body** and the **labels** of the issue via the GitHub MCP tools. The body is your task description; the labels determine how much oversight is required.

### 2. Read the oversight tier from the labels

| Label | Plan stage                                                                       | Pre-PR review |
| --- |----------------------------------------------------------------------------------| --- |
| `oversight:none` | Sonnet plans inline.                                                             | No opus review required. |
| `oversight:basic` | Sonnet plans inline.                                                             | Opus advisor reviews the diff before the PR is opened. |
| `oversight:extended` | Spawn an Opus `Plan` subagent first and post its plan as a comment on the issue. | Opus advisor reviews the diff before the PR is opened. |
| (no `oversight:*` label) | Treat as `oversight:basic`.                                                      | Treat as `oversight:basic`. |

The ticket body may add **extra** reviewer criteria (e.g. "zero changes outside `./desktop/`"). It cannot waive the ones below.

### 3. Build a TodoWrite list

Convert the plan (the Plan subagent's output for `extended`, or your own sketch for `basic`/`none`) into a `TodoWrite` list before writing code. Keep exactly one item `in_progress` at a time and mark items `completed` as you go. If you discover the plan is wrong mid-implementation, stop, update the todos (and the plan comment, if `extended`), then continue — don't silently deviate.

If you're about to edit a file without an active todo covering that work, that's the signal to go back to step 3.

### 4. Pre-PR opus advisor review (`basic` and `extended`)

Before opening the PR, spawn an opus advisor on the diff. The advisor must verify, on top of any ticket-specific checks:

- **Spec coverage** — whatever the ticket body specifies as the work to be done is actually implemented.
- **De-duplication** — flag repeated logic that should be a shared helper, hook, or component.
- **Abstraction & pattern adherence** — render / interaction / IO / state stay cleanly separated; the change follows the patterns documented in the nearest `AGENTS.md` / `CLAUDE.md`.
- **Meaningful tests** — tests exercise behaviour and edge cases, not just mirror the implementation.

Address the advisor's findings (or push back with a reason) before opening the PR.

# File Naming Convention

kebab-case for all files and folders.

# PR Template

The template is in [pull-request-template.md](../.github/pull_request_template.md)
