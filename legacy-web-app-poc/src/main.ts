// NOTE FOR AGENTS: do not extend this file. New client code goes in
// the relevant slice — DOM scaffolding in bootstrap/mount.ts, view
// switching in bootstrap/view-switcher.ts, hotkeys in
// bootstrap/shortcuts.ts, timeline behaviour in timeline/app.ts. See
// app/src/AGENTS.md and app/src/timeline/AGENTS.md.
import { mountAppShell } from './bootstrap/mount.ts';
import { createViewSwitcher } from './bootstrap/view-switcher.ts';
import { attachGlobalShortcuts } from './bootstrap/shortcuts.ts';
import { createTimelineApp } from './timeline/app.ts';

async function main() {
  const appEl = document.getElementById('app')!;
  mountAppShell(appEl);
  const { showNotes } = createViewSwitcher();
  const timeline = await createTimelineApp();
  attachGlobalShortcuts(timeline);
  if (location.pathname.startsWith('/notes')) showNotes();
}

main().catch(err => {
  console.error(err);
  const root = document.getElementById('app')!;
  root.innerHTML = `<div style="padding: 20px; color: #c06040;">
    <h2>Error loading timeline</h2>
    <pre>${String(err?.message ?? err)}</pre>
  </div>`;
});
