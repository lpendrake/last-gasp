import Fuse from 'fuse.js';
import type { EventListItem, TagsRegistry } from '../data/types.ts';
import type {
  DateField, TagFilter, DateFilter, Filter, FilterState,
} from './filters/types.ts';
import {
  makeInitialFilterState, applyFilters, matchesFilter, filterSummary,
  newFilterId, collectAllTags, nowForField,
} from './filters/logic.ts';

export type { DateField, TagFilter, DateFilter, Filter, FilterState };
export {
  makeInitialFilterState, applyFilters, matchesFilter, filterSummary,
  newFilterId, collectAllTags, nowForField,
};

export { loadPinnedFilters, savePinnedFilters } from './filters/persistence.ts';

// ---- Sidebar rendering ----

export interface SidebarDeps {
  events: () => EventListItem[];
  tags: () => TagsRegistry;
  state: () => FilterState;
  onChange: () => void;
  /** In-game "now" as an ISO-ish Golarian date (with or without time). */
  inGameNow: string;
  /** Real-world "now" — used when a date filter is session- or creation-scoped. */
  realWorldNow: string;
}

/** Tracks which filter IDs are currently in edit mode across re-renders. */
const editing = new Set<string>();

export function renderFilterSidebar(container: HTMLElement, deps: SidebarDeps): void {
  const state = deps.state();

  container.innerHTML = '';
  container.classList.add('filter-bar');

  // --- + Add filter (leftmost) ---
  const addWrap = document.createElement('div');
  addWrap.className = 'filter-add-wrap';
  addWrap.innerHTML = `
    <button type="button" class="filter-add-btn" title="Add a filter">+ Add filter</button>
    <menu class="filter-add-menu" hidden>
      <li><button type="button" data-type="tag">Tag filter</button></li>
      <li><button type="button" data-type="date">Date range</button></li>
    </menu>
  `;
  const addBtn = addWrap.querySelector('.filter-add-btn') as HTMLButtonElement;
  const menu = addWrap.querySelector('.filter-add-menu') as HTMLElement;
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', () => { menu.hidden = true; }, { once: true });
  for (const b of menu.querySelectorAll('button')) {
    b.addEventListener('click', () => {
      const t = (b as HTMLButtonElement).dataset.type as 'tag' | 'date';
      let created: Filter;
      if (t === 'tag') {
        created = { id: newFilterId(), type: 'tag', enabled: true, pinned: false, tags: [] };
      } else {
        const now = nowForField('in-game', deps.inGameNow, deps.realWorldNow);
        created = {
          id: newFilterId(), type: 'date', enabled: true, pinned: false,
          field: 'in-game', from: null, to: now,
        };
      }
      state.filters.push(created);
      // Close any other open editors and open this one.
      editing.clear();
      editing.add(created.id);
      deps.onChange();
    });
  }
  container.appendChild(addWrap);

  // --- Filter chips ---
  for (const f of state.filters) {
    container.appendChild(renderFilterChip(f, deps));
  }
}

function renderFilterChip(filter: Filter, deps: SidebarDeps): HTMLElement {
  const chip = document.createElement('div');
  chip.className = 'filter-chip-row' + (filter.enabled ? '' : ' is-disabled');
  chip.dataset.id = filter.id;

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = filter.enabled;
  cb.title = filter.enabled ? 'Disable' : 'Enable';
  cb.addEventListener('change', () => {
    filter.enabled = cb.checked;
    deps.onChange();
  });

  const label = document.createElement('button');
  label.type = 'button';
  label.className = 'filter-chip-summary';
  label.textContent = filterSummary(filter);
  label.title = 'Edit';
  label.addEventListener('click', () => {
    if (editing.has(filter.id)) editing.delete(filter.id);
    else {
      editing.clear();
      editing.add(filter.id);
    }
    deps.onChange();
  });

  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'filter-chip-icon filter-chip-pin' + (filter.pinned ? ' is-active' : '');
  pin.title = filter.pinned ? 'Unpin' : 'Pin (persist across sessions)';
  pin.textContent = filter.pinned ? '★' : '☆';
  pin.addEventListener('click', () => {
    filter.pinned = !filter.pinned;
    deps.onChange();
  });

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'filter-chip-icon';
  del.title = 'Remove';
  del.textContent = '×';
  del.addEventListener('click', () => {
    const state = deps.state();
    state.filters = state.filters.filter(f => f.id !== filter.id);
    editing.delete(filter.id);
    deps.onChange();
  });

  chip.appendChild(cb);
  chip.appendChild(label);
  chip.appendChild(pin);
  chip.appendChild(del);

  if (editing.has(filter.id)) {
    const popover = filter.type === 'tag'
      ? renderTagEditor(filter, deps)
      : renderDateEditor(filter, deps);
    popover.classList.add('filter-editor-popover');
    chip.appendChild(popover);
  }

  return chip;
}

function renderTagEditor(filter: TagFilter, deps: SidebarDeps): HTMLElement {
  const box = document.createElement('div');
  box.className = 'filter-editor filter-editor-tag';

  // Chips for currently-selected tags
  const chips = document.createElement('div');
  chips.className = 'filter-tag-chips';
  function renderChips() {
    chips.innerHTML = '';
    for (const tag of filter.tags) {
      const chip = document.createElement('span');
      chip.className = 'filter-chip';
      chip.textContent = tag;
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'filter-chip-remove';
      x.textContent = '×';
      x.addEventListener('click', () => {
        filter.tags = filter.tags.filter(t => t !== tag);
        deps.onChange();
      });
      chip.appendChild(x);
      chips.appendChild(chip);
    }
  }
  renderChips();
  box.appendChild(chips);

  // Search input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'filter-tag-input';
  input.placeholder = 'Search tags…';
  input.autofocus = true;
  box.appendChild(input);

  const results = document.createElement('ul');
  results.className = 'filter-tag-results';
  box.appendChild(results);

  const allTags = collectAllTags(deps.events());
  const fuse = new Fuse(allTags, { threshold: 0.4, ignoreLocation: true });

  function renderResults() {
    results.innerHTML = '';
    const q = input.value.trim();
    const hits = q
      ? fuse.search(q, { limit: 8 }).map(h => h.item)
      : allTags.slice(0, 8);
    for (const tag of hits) {
      if (filter.tags.includes(tag)) continue;
      const li = document.createElement('li');
      li.className = 'filter-tag-result';
      li.textContent = tag;
      li.addEventListener('click', () => {
        filter.tags = [...filter.tags, tag];
        input.value = '';
        deps.onChange();
      });
      results.appendChild(li);
    }
  }
  renderResults();
  input.addEventListener('input', renderResults);

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'filter-editor-done';
  done.textContent = 'Done';
  done.addEventListener('click', () => {
    editing.delete(filter.id);
    deps.onChange();
  });
  box.appendChild(done);

  return box;
}

function renderDateEditor(filter: DateFilter, deps: SidebarDeps): HTMLElement {
  const box = document.createElement('div');
  box.className = 'filter-editor filter-editor-date';
  box.innerHTML = `
    <div class="filter-date-field-row">
      <label><input type="radio" name="field-${filter.id}" value="in-game" ${filter.field === 'in-game' ? 'checked' : ''}> In-game</label>
      <label><input type="radio" name="field-${filter.id}" value="session"  ${filter.field === 'session'  ? 'checked' : ''}> Session</label>
      <label><input type="radio" name="field-${filter.id}" value="creation" ${filter.field === 'creation' ? 'checked' : ''}> Created</label>
    </div>
    <label class="filter-date-label">From
      <input type="text" class="filter-date-input" data-field="from" placeholder="YYYY-MM-DD" value="${filter.from ?? ''}">
    </label>
    <label class="filter-date-label">To
      <input type="text" class="filter-date-input" data-field="to"   placeholder="YYYY-MM-DD" value="${filter.to ?? ''}">
    </label>
    <button type="button" class="filter-editor-done">Done</button>
  `;

  for (const r of box.querySelectorAll('input[type="radio"]')) {
    r.addEventListener('change', () => {
      if ((r as HTMLInputElement).checked) {
        filter.field = (r as HTMLInputElement).value as DateField;
        // Calendar changed — old bounds are in the wrong calendar. Reset to "now".
        filter.from = null;
        filter.to = nowForField(filter.field, deps.inGameNow, deps.realWorldNow);
        deps.onChange();
      }
    });
  }
  const fromI = box.querySelector('[data-field="from"]') as HTMLInputElement;
  const toI   = box.querySelector('[data-field="to"]')   as HTMLInputElement;
  fromI.addEventListener('change', () => { filter.from = fromI.value.trim() || null; deps.onChange(); });
  toI.addEventListener('change',   () => { filter.to   = toI.value.trim()   || null; deps.onChange(); });

  const done = box.querySelector('.filter-editor-done') as HTMLButtonElement;
  done.addEventListener('click', () => {
    editing.delete(filter.id);
    deps.onChange();
  });

  return box;
}
