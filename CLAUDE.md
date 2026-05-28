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
| `oversight:orchestrator` | Fire up the `orchestrate` skill. All sub-tasks of this issue are taken into account and orchestrated together as a single coordinated effort. | The orchestrator handles review across sub-tasks before opening the PR. |
| `oversight:orchestrated` | This issue is a sub-task being driven by an `oversight:orchestrator` parent. Oversight is provided by the orchestrator model itself — do not plan or open a PR independently. | Review is handled by the orchestrator. |
| (no `oversight:*` label) | Treat as `oversight:basic`.                                                      | Treat as `oversight:basic`. |

The ticket body may add **extra** reviewer criteria (e.g. "zero changes outside `./desktop/`"). It cannot waive the ones below.

!Important! When asking a sub-agent to plan for you do not do research first, let it do its own research, else you pollute its views.
Once it has a plan for you and has highlighted files, look into what it has guided you towards.

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

## Git etiquette

### Branch names

Branch names must include the ticket number and a few words related to the issue being resolved, e.g. `160/sync-entity-tags-on-save`.

### Commit messages

- Start every commit with the issue number: `#156 resolving wiki link display labels from the entity index`
- Write for release notes, not for engineers — describe what changes about the **product**, not what changed in the code.
- If there is no clear user-facing gain, prefix with `#{issue-number} TECHNICAL CHANGE`: e.g. `#156 TECHNICAL CHANGE refactor entity index lookup to use Map`

### No rebase or force-push once a PR is open

Once a PR is open (even as a draft), **never rebase or force-push**. Doing so destroys reviewers' ability to track what they've already reviewed. Merge commits are fine; a clean history is not worth the reviewer confusion.

### Pre-commit hooks

Husky pre-commit hooks run linting and tests before each commit. **Never skip them** (`--no-verify` is forbidden). If a hook fails, fix the underlying issue before committing — do not work around it. This keeps CI from failing on formatting errors or test regressions that should have been caught locally.

## No logic inside hooks or components

Do not declare functions containing business logic inside a React hook or component body.
Functions defined this way close over state and become untestable without mounting React.

- Pure logic (no IO, no React) belongs in `domain/`
- Non-React IO logic belongs as a named `.ts` file alongside `data.ts`
- The hook body wires those up to React state — it does not contain the logic itself

## Theme system

All colours come from the theme system at `src/renderer/theme/`. Never hardcode hex colour values — import from `ThemeProvider.get()` for TS/TSX or use `var(--theme-*)` CSS variables, which are set by the ThemeProvider before React mounts.

- `dark-pathfinder.ts` — the default (and currently only) theme; single source of truth for every colour
- `types.ts` — `Theme` interface organised by view: `chrome`, `timeline`, `notes`, `editor`, `bootstrap`
- `provider.ts` — `ThemeProvider` singleton: `init()`, `get()`, `set(partial)` with Dark Pathfinder fallback

# File Naming Convention

kebab-case for all files and folders.

# PR Template

The template is in [pull-request-template.md](../.github/pull_request_template.md)
