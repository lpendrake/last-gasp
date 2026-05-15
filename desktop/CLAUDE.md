# Claude instructions for desktop/

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

When the task originates from a GitHub issue (the prompt is the issue body, or you've been told to "pick up" an issue):

1. **Plan first.** Before editing any code, spawn the `Plan` subagent with the issue body and any relevant context. Do not skip this step even if the issue looks small — if it's trivial, the plan will be short.
2. **Post the plan.** Add the returned plan as a comment on the originating issue (or PR, if one already exists) so it's reviewable.
3. **Build a TodoWrite list from the plan.** Convert each plan step into a todo item before writing code. Keep exactly one item `in_progress` at a time and mark items `completed` as you finish them.
4. **Work the list.** Implement step-by-step against the todos. If you discover the plan is wrong mid-implementation, stop, update the todo list (and ideally the issue comment), then continue — don't silently deviate.
5. **No skipping.** If you find yourself about to edit a file without an active todo covering that work, that's the signal to go back to step 1 or 3.
