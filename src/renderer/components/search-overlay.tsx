import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { timelinePort } from '../timeline/data/ports';
import type { EventListItem } from '../timeline/data/types';
import { parseISOString } from '../timeline/calendar/golarian';
import { formatCompact } from '../timeline/calendar/format';
import type { EntityIndexEntry } from '../../types/global';
import { splitFrontmatter } from '../../shared/frontmatter';
import './search-overlay.css';

interface SearchableEvent extends EventListItem {
  body?: string;
}

interface SearchableNote {
  path: string;
  title: string;
  body?: string;
  tags?: string[];
}

type SearchResult =
  | { kind: 'event'; item: EventListItem; snippet: string }
  | { kind: 'note'; item: SearchableNote; snippet: string; matchOffset?: number };

interface SearchOverlayProps {
  isOpen: boolean;
  campaignPath: string;
  onClose: () => void;
  onJumpToEvent: (ev: EventListItem) => void;
  onOpenNote: (campaignRelativePath: string, matchOffset?: number) => void;
}

export function matches(text: string | undefined, query: string): boolean {
  return !!text && text.toLowerCase().includes(query.toLowerCase());
}

export function matchesTags(
  tags: string[] | undefined,
  query: string,
  labelMap?: Map<string, string>,
): boolean {
  if (!tags || tags.length === 0) return false;
  const q = query.toLowerCase();
  return tags.some((t) => {
    if (t.toLowerCase().includes(q)) return true;
    if (labelMap && t.startsWith('id:')) {
      const label = labelMap.get(t.slice(3));
      if (label && label.toLowerCase().includes(q)) return true;
    }
    return false;
  });
}

export function extractSnippet(text: string, query: string): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 80).replace(/\s+/g, ' ').trim();
  const from = Math.max(0, idx - 30);
  const to = Math.min(text.length, idx + query.length + 60);
  let snippet = text.slice(from, to).replace(/\s+/g, ' ').trim();
  if (from > 0) snippet = '…' + snippet;
  if (to < text.length) snippet = snippet + '…';
  return snippet;
}

function noteSubfolder(campaignRelativePath: string): string | null {
  const withoutPrefix = campaignRelativePath.startsWith('notes/')
    ? campaignRelativePath.slice('notes/'.length)
    : campaignRelativePath;
  const slashIdx = withoutPrefix.indexOf('/');
  return slashIdx === -1 ? null : withoutPrefix.slice(0, slashIdx);
}

export function SearchOverlay({
  isOpen,
  campaignPath,
  onClose,
  onJumpToEvent,
  onOpenNote,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [includeEvents, setIncludeEvents] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeTags, setIncludeTags] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [events, setEvents] = useState<SearchableEvent[]>([]);
  const [notes, setNotes] = useState<SearchableNote[]>([]);
  const [bodiesLoading, setBodiesLoading] = useState(false);
  const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map());

  const inputRef = useRef<HTMLInputElement>(null);

  // Load data and lazy-load bodies when overlay opens
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedIdx(0);
    setEvents([]);
    setNotes([]);
    setBodiesLoading(false);

    let cancelled = false;

    async function load() {
      // Load event and note lists in parallel
      const [eventList, entityIndex] = await Promise.all([
        timelinePort.listEvents(campaignPath),
        window.fsApi.buildIndex(campaignPath),
      ]);
      if (cancelled) return;

      const initialEvents: SearchableEvent[] = eventList;
      const typedIndex = entityIndex as EntityIndexEntry[];
      const initialNotes: SearchableNote[] = typedIndex
        .filter((e) => e.type === 'note')
        .map((e) => ({ path: e.path, title: e.title, tags: e.tags }));

      const map = new Map<string, string>();
      for (const entry of typedIndex) {
        if (entry.id) map.set(entry.id, entry.tagLabelOverride ?? entry.title);
      }
      setLabelMap(map);

      setEvents(initialEvents);
      setNotes(initialNotes);
      setBodiesLoading(true);

      // Lazy-load bodies in the background
      const eventsWithBodies = initialEvents.map((e) => ({ ...e }));
      const notesWithBodies = initialNotes.map((n) => ({ ...n }));

      const loadBodies = async () => {
        for (let i = 0; i < eventsWithBodies.length; i++) {
          if (cancelled) return;
          try {
            const { event } = await timelinePort.getEvent(
              campaignPath,
              eventsWithBodies[i].filename,
            );
            eventsWithBodies[i] = { ...eventsWithBodies[i], body: event.body };
          } catch {
            eventsWithBodies[i] = { ...eventsWithBodies[i], body: '' };
          }
          setEvents([...eventsWithBodies]);
        }
        for (let i = 0; i < notesWithBodies.length; i++) {
          if (cancelled) return;
          try {
            const raw = await window.fsApi.read(`${campaignPath}/${notesWithBodies[i].path}`);
            const { body } = splitFrontmatter(raw ?? '');
            notesWithBodies[i] = { ...notesWithBodies[i], body };
          } catch {
            notesWithBodies[i] = { ...notesWithBodies[i], body: '' };
          }
          setNotes([...notesWithBodies]);
        }
        if (!cancelled) setBodiesLoading(false);
      };

      loadBodies();
    }

    load().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [isOpen, campaignPath]);

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const results: SearchResult[] = useMemo(() => {
    if (!query.trim()) return [];
    const out: SearchResult[] = [];
    const seenEvents = new Set<string>();
    const seenNotes = new Set<string>();

    if (includeEvents) {
      for (const ev of events) {
        if (out.length >= 30) break;
        if (matches(ev.title, query) || matches(ev.body, query)) {
          seenEvents.add(ev.filename);
          out.push({
            kind: 'event',
            item: ev,
            snippet: ev.body ? extractSnippet(ev.body, query) : '',
          });
        }
      }
    }

    if (includeNotes) {
      for (const note of notes) {
        if (out.length >= 30) break;
        const bodyIdx = note.body ? note.body.toLowerCase().indexOf(query.toLowerCase()) : -1;
        if (matches(note.title, query) || bodyIdx !== -1) {
          seenNotes.add(note.path);
          const snippet = note.body && bodyIdx !== -1 ? extractSnippet(note.body, query) : '';
          out.push({
            kind: 'note',
            item: note,
            snippet,
            matchOffset: bodyIdx !== -1 ? bodyIdx : undefined,
          });
        }
      }
    }

    if (includeTags) {
      for (const ev of events) {
        if (out.length >= 30) break;
        if (!seenEvents.has(ev.filename) && matchesTags(ev.tags, query, labelMap)) {
          seenEvents.add(ev.filename);
          out.push({
            kind: 'event',
            item: ev,
            snippet: ev.body ? extractSnippet(ev.body, query) : '',
          });
        }
      }
      for (const note of notes) {
        if (out.length >= 30) break;
        if (!seenNotes.has(note.path) && matchesTags(note.tags, query, labelMap)) {
          seenNotes.add(note.path);
          out.push({ kind: 'note', item: note, snippet: '', matchOffset: undefined });
        }
      }
    }

    return out;
  }, [query, events, notes, includeEvents, includeNotes, includeTags, labelMap]);

  // Reset selectedIdx when results change
  useEffect(() => {
    setSelectedIdx(0);
  }, [results.length]);

  const activateResult = useCallback(
    (result: SearchResult) => {
      if (result.kind === 'event') {
        onJumpToEvent(result.item);
      } else {
        onOpenNote(result.item.path, result.matchOffset);
      }
      onClose();
    },
    [onJumpToEvent, onOpenNote, onClose],
  );

  // Stable refs so the keyboard handler always reads the latest values
  // without needing to re-register on every results/activateResult change.
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const activateResultRef = useRef(activateResult);
  activateResultRef.current = activateResult;
  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, resultsRef.current.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const result = resultsRef.current[selectedIdxRef.current];
        if (result) activateResultRef.current(result);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function noteFolderLabel(note: SearchableNote): string {
    return noteSubfolder(note.path) ?? note.title;
  }

  return (
    <div
      className="search-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-panel">
        <div className="search-filters">
          <span>Include:</span>
          <label className="search-filter-label">
            <input
              type="checkbox"
              checked={includeEvents}
              onChange={(e) => setIncludeEvents(e.target.checked)}
            />
            Events
          </label>
          <label className="search-filter-label">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
            />
            Notes
          </label>
          <label className="search-filter-label">
            <input
              type="checkbox"
              checked={includeTags}
              onChange={(e) => setIncludeTags(e.target.checked)}
            />
            Tags
          </label>
        </div>

        <div className="search-input-row">
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            placeholder="Search events and notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {bodiesLoading && <div className="search-indexing">Indexing bodies…</div>}

        <ul className="search-results">
          {query.trim() && results.length === 0 && (
            <li className="search-empty">No results for &ldquo;{query}&rdquo;</li>
          )}
          {results.map((result, i) => {
            const isActive = i === selectedIdx;
            if (result.kind === 'event') {
              const ev = result.item;
              let dateStr = '';
              try {
                dateStr = formatCompact(parseISOString(ev.date));
              } catch {
                dateStr = ev.date;
              }
              return (
                <li
                  key={`event-${ev.filename}`}
                  className={`search-result${isActive ? ' is-active' : ''}`}
                  onMouseDown={() => activateResult(result)}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span className="search-result-badge search-result-badge--event">EVENT</span>
                  <span className="search-result-title">{ev.title}</span>
                  <span className="search-result-meta">{dateStr}</span>
                  {result.snippet && (
                    <span className="search-result-snippet">{result.snippet}</span>
                  )}
                </li>
              );
            } else {
              const note = result.item;
              return (
                <li
                  key={`note-${note.path}`}
                  className={`search-result${isActive ? ' is-active' : ''}`}
                  onMouseDown={() => activateResult(result)}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span className="search-result-badge search-result-badge--note">NOTE</span>
                  <span className="search-result-title">{note.title}</span>
                  <span className="search-result-meta">{noteFolderLabel(note)}</span>
                  {result.snippet && (
                    <span className="search-result-snippet">{result.snippet}</span>
                  )}
                </li>
              );
            }
          })}
        </ul>

        <div className="search-hint">↑↓ navigate · Enter to open · Esc to close</div>
      </div>
    </div>
  );
}
