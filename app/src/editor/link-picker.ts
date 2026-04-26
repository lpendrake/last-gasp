import Fuse from 'fuse.js';
import { getLinkIndex } from '../data/api.ts';
import type { LinkIndexEntry } from '../data/types.ts';

// Module-level cache: the link index changes rarely mid-session.
let indexCache: LinkIndexEntry[] | null = null;
let fuseCache: Fuse<LinkIndexEntry> | null = null;

async function ensureIndex(): Promise<{ index: LinkIndexEntry[]; fuse: Fuse<LinkIndexEntry> }> {
  if (!fuseCache || !indexCache) {
    indexCache = await getLinkIndex();
    fuseCache = new Fuse(indexCache, {
      keys: ['title', 'path'],
      threshold: 0.4,
      ignoreLocation: true,
      includeMatches: false,
    });
  }
  return { index: indexCache, fuse: fuseCache };
}

// Produces a relative href from `events/` to targetPath (repo-relative).
function relHref(targetPath: string): string {
  const parts = targetPath.split('/');
  const targetDir = parts.slice(0, -1).join('/');
  const file = parts[parts.length - 1];
  // Source dir is always "events" for the editor.
  if (targetDir === 'events') return file;
  if (!targetDir) return `../${file}`;
  return `../${targetPath}`;
}

// Match `[[query` at the end of text-before-cursor.
const TRIGGER_RE = /\[\[([^\][]*)$/;

function getPickState(ta: HTMLTextAreaElement): { query: string; triggerStart: number } | null {
  const text = ta.value.slice(0, ta.selectionStart);
  const m = TRIGGER_RE.exec(text);
  if (!m) return null;
  return { query: m[1], triggerStart: m.index };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;',
  );
}

/**
 * Attach a [[-triggered link autocomplete dropdown to a textarea.
 * Returns a cleanup function to remove all listeners and DOM nodes.
 */
export function attachLinkPicker(textarea: HTMLTextAreaElement): () => void {
  let dropdown: HTMLDivElement | null = null;
  let results: LinkIndexEntry[] = [];
  let selected = 0;
  let active = false;

  function renderItems() {
    if (!dropdown) return;
    const slice = results.slice(0, 10);
    if (slice.length === 0) {
      dropdown.innerHTML = `<div class="link-picker-empty">No matches</div>`;
      return;
    }
    dropdown.innerHTML = slice.map((item, i) => `
      <div class="link-picker-item${i === selected ? ' is-selected' : ''}" data-index="${i}">
        <span class="link-picker-title">${esc(item.title)}</span>
        <span class="link-picker-path">${esc(item.path)}</span>
      </div>
    `).join('');
  }

  function showDropdown(items: LinkIndexEntry[]) {
    results = items;
    selected = 0;

    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'link-picker-dropdown';
      dropdown.addEventListener('mousedown', (e) => {
        // mousedown instead of click so it fires before textarea blur
        const el = (e.target as HTMLElement).closest('[data-index]') as HTMLElement | null;
        if (!el) return;
        e.preventDefault();
        const idx = parseInt(el.dataset.index!, 10);
        if (results[idx]) pick(results[idx]);
      });
      document.body.appendChild(dropdown);
    }

    renderItems();

    const rect = textarea.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.minWidth = `${Math.min(rect.width, 400)}px`;
    dropdown.hidden = false;
  }

  function hideDropdown() {
    if (dropdown) dropdown.hidden = true;
    active = false;
  }

  function pick(item: LinkIndexEntry) {
    const state = getPickState(textarea);
    if (!state) { hideDropdown(); return; }

    const href = relHref(item.path);
    const insertion = `[${item.title}](${href})`;
    const before = textarea.value.slice(0, state.triggerStart);
    const after = textarea.value.slice(state.triggerStart + 2 + state.query.length);
    textarea.value = before + insertion + after;

    const pos = state.triggerStart + insertion.length;
    textarea.setSelectionRange(pos, pos);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    hideDropdown();
    textarea.focus();
  }

  async function onInput() {
    const state = getPickState(textarea);
    if (!state) {
      if (active) hideDropdown();
      return;
    }
    active = true;

    try {
      const { index, fuse } = await ensureIndex();
      const items = state.query.trim()
        ? fuse.search(state.query).map(r => r.item)
        : index;
      showDropdown(items.slice(0, 10));
    } catch {
      hideDropdown();
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!active || !dropdown || dropdown.hidden) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = Math.min(selected + 1, Math.min(results.length, 10) - 1);
      renderItems();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
      renderItems();
    } else if (e.key === 'Enter') {
      const item = results[selected];
      if (item) { e.preventDefault(); pick(item); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hideDropdown();
    }
  }

  function onBlur() {
    setTimeout(hideDropdown, 150);
  }

  textarea.addEventListener('input', onInput);
  textarea.addEventListener('keydown', onKeyDown);
  textarea.addEventListener('blur', onBlur);

  return () => {
    textarea.removeEventListener('input', onInput);
    textarea.removeEventListener('keydown', onKeyDown);
    textarea.removeEventListener('blur', onBlur);
    dropdown?.remove();
    dropdown = null;
    active = false;
  };
}
