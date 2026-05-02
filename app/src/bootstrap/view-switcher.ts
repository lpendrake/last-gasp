import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { NotesApp } from '../notes/Notes.tsx';

export interface ViewSwitcher {
  showNotes(): void;
  showTimeline(): void;
}

/** Toggle the timeline-shell / notes-shell visibility, mount the React
 * notes app on first show, and wire up history (pushState + popstate +
 * the `notes:exit` event from inside the notes app).
 *
 * The DOM scaffold from `mountAppShell` is required to be in place
 * before this is called. */
export function createViewSwitcher(): ViewSwitcher {
  const timelineShell = document.getElementById('timeline-shell') as HTMLDivElement;
  const notesShell = document.getElementById('notes-shell') as HTMLDivElement;
  const root = document.getElementById('app')!;
  let notesReactRoot: ReturnType<typeof createRoot> | null = null;

  function showNotes() {
    // Set app to flex-column so notes-shell fills it
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    timelineShell.style.display = 'none';
    notesShell.style.display = 'flex';
    notesShell.style.flexDirection = 'column';
    notesShell.style.flex = '1 1 auto';
    notesShell.style.minHeight = '0';
    if (!notesReactRoot) {
      notesReactRoot = createRoot(notesShell);
    }
    notesReactRoot.render(createElement(NotesApp));
    document.getElementById('btn-view-timeline')!.classList.remove('is-active');
    document.getElementById('btn-view-notes')!.classList.add('is-active');
  }

  function showTimeline() {
    notesShell.style.display = 'none';
    timelineShell.style.display = 'contents';
    // notesReactRoot stays alive so state is preserved between switches
    document.getElementById('btn-view-timeline')!.classList.add('is-active');
    document.getElementById('btn-view-notes')!.classList.remove('is-active');
  }

  document.getElementById('btn-view-notes')!.addEventListener('click', () => {
    history.pushState(null, '', '/notes');
    showNotes();
  });
  window.addEventListener('notes:exit', () => {
    history.pushState(null, '', '/timeline');
    showTimeline();
  });
  window.addEventListener('popstate', () => {
    if (location.pathname.startsWith('/notes')) showNotes();
    else showTimeline();
  });

  return { showNotes, showTimeline };
}
