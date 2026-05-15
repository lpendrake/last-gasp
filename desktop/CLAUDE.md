# Claude instructions for desktop/

## Running scripts

Prefer npm scripts over calling binaries directly. Check `package.json` first and use:

- `npm test` — run tests
- `npm run build` — build renderer + main
- `npm run lint` — lint check
- `npm run lint:fix` — lint and auto-fix

Only use `npx <tool>` when there is genuinely no npm script for the task.
