import MarkdownIt from 'markdown-it';
import { getFile, ApiError } from '../data/api.ts';

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

let zCounter = 400;
function nextZ() { return ++zCounter; }

export interface PeekWindowOptions {
  repoPath: string;
  anchorEl: HTMLElement;
  stackDepth?: number;
  onPin?: (win: PeekWindow) => void;
  onClose?: (win: PeekWindow) => void;
}

export class PeekWindow {
  readonly el: HTMLDivElement;
  readonly repoPath: string;
  isPinned = false;
  private readonly anchorEl: HTMLElement;
  private abort = new AbortController();
  private onPin?: (w: PeekWindow) => void;
  private onClose?: (w: PeekWindow) => void;

  constructor(opts: PeekWindowOptions) {
    this.repoPath = opts.repoPath;
    this.anchorEl = opts.anchorEl;
    this.onPin = opts.onPin;
    this.onClose = opts.onClose;

    const el = document.createElement('div');
    el.className = 'peek-window';
    el.dataset.repoPath = opts.repoPath;
    el.innerHTML = `
      <div class="peek-header">
        <span class="peek-path">${esc(opts.repoPath)}</span>
        <button class="peek-close" aria-label="Close">×</button>
      </div>
      <div class="peek-body markdown-body"><span class="peek-loading">Loading…</span></div>
    `;
    this.el = el;
    el.style.zIndex = String(nextZ());
    document.body.appendChild(el);
    this.placeNear(opts.anchorEl, opts.stackDepth ?? 0);

    el.querySelector('.peek-close')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
    el.addEventListener('click', (e) => {
      if (this.isPinned) return;
      if ((e.target as Element).closest('.peek-close')) return;
      this.pin();
    });

    void this.load();
  }

  private async load() {
    const bodyEl = this.el.querySelector('.peek-body') as HTMLDivElement;
    try {
      const raw = await getFile(this.repoPath, this.abort.signal);
      if (this.abort.signal.aborted) return;

      const { title, body, baseDir } = parseMd(this.repoPath, raw);

      const headerEl = this.el.querySelector('.peek-header')!;
      headerEl.innerHTML = `
        <span class="peek-title">${esc(title)}</span>
        <span class="peek-path-small">${esc(this.repoPath)}</span>
        <button class="peek-close" aria-label="Close">×</button>
      `;
      headerEl.querySelector('.peek-close')!.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });

      bodyEl.setAttribute('data-base-dir', baseDir);
      bodyEl.innerHTML = md.render(body);
      for (const img of bodyEl.querySelectorAll<HTMLImageElement>('img[src]')) {
        const src = img.getAttribute('src') ?? '';
        if (!src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
          img.setAttribute('src', `/api/file/${baseDir}/${src}`);
        }
      }
    } catch (err) {
      if (this.abort.signal.aborted) return;
      if (err instanceof ApiError && err.status === 404) {
        this.anchorEl.title = 'File not found';
        this.close();
        return;
      }
      bodyEl.innerHTML = `<span class="peek-error">Error: ${esc(String(err))}</span>`;
    }
  }

  placeNear(anchor: HTMLElement, _depth: number) {
    const rect = anchor.getBoundingClientRect();
    const W = 480;
    const G = 12;

    let left = rect.left;
    let top = rect.bottom + G;

    if (left + W > window.innerWidth - G) left = window.innerWidth - W - G;
    if (left < G) left = G;

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;

    requestAnimationFrame(() => {
      const r = this.el.getBoundingClientRect();
      if (r.bottom > window.innerHeight - G) {
        const cur = parseInt(this.el.style.top, 10);
        this.el.style.top = `${Math.max(G, cur - (r.bottom - window.innerHeight + G))}px`;
      }
    });
  }

  private enableDrag() {
    const header = this.el.querySelector('.peek-header') as HTMLElement;
    let ox = 0, oy = 0, sx = 0, sy = 0;
    const onMove = (e: MouseEvent) => {
      this.el.style.left = `${ox + e.clientX - sx}px`;
      this.el.style.top = `${oy + e.clientY - sy}px`;
    };
    const onUp = () => document.removeEventListener('mousemove', onMove);
    header.addEventListener('mousedown', (e) => {
      if ((e.target as Element).closest('.peek-close')) return;
      e.preventDefault();
      sx = e.clientX; sy = e.clientY;
      ox = parseInt(this.el.style.left, 10);
      oy = parseInt(this.el.style.top, 10);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp, { once: true });
    });
  }

  pin() {
    this.isPinned = true;
    this.el.classList.add('is-pinned');
    this.el.style.zIndex = String(nextZ());
    this.enableDrag();
    this.onPin?.(this);
  }

  close() {
    this.abort.abort();
    this.el.remove();
    this.onClose?.(this);
  }
}

function parseMd(repoPath: string, raw: string): { title: string; body: string; baseDir: string } {
  const baseDir = repoPath.split('/').slice(0, -1).join('/') || '.';
  let body = raw;
  let title = repoPath.split('/').pop()!.replace(/\.md$/, '');

  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end !== -1) {
      const fm = raw.slice(3, end);
      const m = fm.match(/^title:\s*(.+)$/m);
      if (m) {
        let t = m[1].trim();
        if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
          t = t.slice(1, -1);
        }
        title = t;
      }
      body = raw.slice(end + 4).trimStart();
    }
  } else {
    const m = raw.match(/^#\s+(.+)$/m);
    if (m) title = m[1].trim();
  }

  return { title, body, baseDir };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;',
  );
}
