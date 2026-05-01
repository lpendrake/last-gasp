import Fuse from 'fuse.js';
import { getLinkIndex } from '../data/http/links.http.ts';
import type { LinkIndexEntry } from '../data/types.ts';

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

function relHref(targetPath: string): string {
  const parts = targetPath.split('/');
  const targetDir = parts.slice(0, -1).join('/');
  const file = parts[parts.length - 1];
  if (targetDir === 'events') return file;
  if (!targetDir) return `../${file}`;
  return `../${targetPath}`;
}

// Fires when @ appears at start of text or after whitespace, followed by a non-space char or nothing.
// "met @ the inn" won't trigger (space after @); "@foo" and "text @foo" will.
const TRIGGER_RE = /(^|[ \t])@(\S[^\n]*|)$/;

function getPickState(ta: HTMLTextAreaElement): { query: string; triggerStart: number } | null {
  const text = ta.value.slice(0, ta.selectionStart);
  const m = TRIGGER_RE.exec(text);
  if (!m) return null;
  const atPos = m.index + m[1].length; // position of '@' itself
  return { query: m[2], triggerStart: atPos };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;',
  );
}

export function attachLinkPicker(textarea: HTMLTextAreaElement): {
  detach: () => void;
  openForSelection: (displayText: string, selStart: number, selEnd: number) => void;
} {
  let dropdown: HTMLDivElement | null = null;
  let results: LinkIndexEntry[] = [];
  let selected = 0;
  let active = false;
  let pendingSelection: { displayText: string; selStart: number; selEnd: number } | null = null;

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
    pendingSelection = null;
  }

  function pick(item: LinkIndexEntry) {
    const href = relHref(item.path);

    if (pendingSelection) {
      const { displayText, selStart, selEnd } = pendingSelection;
      pendingSelection = null;
      const insertion = `[${displayText}](${href})`;
      textarea.value = textarea.value.slice(0, selStart) + insertion + textarea.value.slice(selEnd);
      const pos = selStart + insertion.length;
      textarea.setSelectionRange(pos, pos);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      hideDropdown();
      textarea.focus();
      return;
    }

    const state = getPickState(textarea);
    if (!state) { hideDropdown(); return; }

    const insertion = `[${item.title}](${href})`;
    const before = textarea.value.slice(0, state.triggerStart);
    const after = textarea.value.slice(state.triggerStart + 1 + state.query.length); // 1 = '@'
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

  async function openForSelection(displayText: string, selStart: number, selEnd: number) {
    pendingSelection = { displayText, selStart, selEnd };
    active = true;

    try {
      const { index, fuse } = await ensureIndex();
      const items = displayText.trim()
        ? fuse.search(displayText).map(r => r.item)
        : index;
      showDropdown(items.slice(0, 10));
    } catch {
      pendingSelection = null;
      active = false;
    }
  }

  textarea.addEventListener('input', onInput);
  textarea.addEventListener('keydown', onKeyDown);
  textarea.addEventListener('blur', onBlur);

  return {
    detach: () => {
      textarea.removeEventListener('input', onInput);
      textarea.removeEventListener('keydown', onKeyDown);
      textarea.removeEventListener('blur', onBlur);
      dropdown?.remove();
      dropdown = null;
      active = false;
      pendingSelection = null;
    },
    openForSelection,
  };
}
