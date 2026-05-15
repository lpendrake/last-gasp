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
