import type { LinkIndexEntry } from '../../../data/types.ts';

/** HTML-escape a string (just `& < > "`). */
export function escHtml(s: string): string {
  return s.replace(/[&<>"]/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  );
}

/** Classify a link's CSS kind by resolving its href against the link
 * index. Returns the destination top folder (e.g. 'npcs') for known
 * links, or 'broken' for unresolved cross-folder links. */
export function kindFromPath(
  href: string, currentFolder: string, linkIndex: LinkIndexEntry[],
): string {
  if (!href) return 'broken';
  let folder = currentFolder;
  const m = /^\.\.\/([^/]+)\//.exec(href);
  if (m) { folder = m[1]; }
  // Resolve href to a repo-relative path for index lookup
  const target = href.startsWith('../') ? href.slice(3) : `${currentFolder}/${href}`;
  const found = linkIndex.some(e => e.path === target);
  if (!found && href.includes('/')) return 'broken';
  return folder;
}

export interface InlineCtx {
  active: boolean;
  currentFolder: string;
  linkIndex: LinkIndexEntry[];
}

/** Render a single line of inline markdown (image, link, bold, italic,
 * code) into HTML spans. The `is-hideable` markers around syntax
 * tokens are hidden by CSS for non-active lines. */
export function renderInline(text: string, opts: InlineCtx): string {
  const { active, currentFolder, linkIndex } = opts;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);

    // Image: ![alt](url)
    const img = rest.match(/^!\[([^\]\n]*)\]\(([^)\n]+)\)/);
    if (img) {
      const src = img[2];
      const displaySrc = src.startsWith('assets/')
        ? `/api/notes/${encodeURIComponent(currentFolder)}/${src}`
        : src;
      out += `<span class="ml-marker is-hideable">${escHtml(img[0])}</span>`
        + `<img class="ml-image" src="${escHtml(displaySrc)}" alt="${escHtml(img[1])}" loading="lazy" />`;
      i += img[0].length;
      continue;
    }

    // Link: [text](url)
    let m: RegExpMatchArray | null = rest.match(/^\[([^\]\n]+)\]\(([^)\n]+)\)/);
    if (m) {
      const label = m[1];
      const href = m[2];
      const kind = kindFromPath(href, currentFolder, linkIndex);
      const hrefEsc = escHtml(href);
      if (active) {
        out += `<span class="ml-marker is-hideable">[</span>`
          + `<span class="ml-link kind-${escHtml(kind)}" data-href="${hrefEsc}">${escHtml(label)}</span>`
          + `<span class="ml-marker is-hideable">](${hrefEsc})</span>`;
      } else {
        out += `<span class="ml-marker is-hideable">[</span>`
          + `<span class="ml-link kind-${escHtml(kind)}" data-href="${hrefEsc}">${escHtml(label)}</span>`
          + `<span class="ml-marker is-hideable">](${hrefEsc})</span>`;
      }
      i += m[0].length;
      continue;
    }

    // Bold: **text**
    m = rest.match(/^\*\*([^*\n]+)\*\*/);
    if (m) {
      out += `<span class="ml-marker is-hideable">**</span>`
        + `<span class="ml-bold">${escHtml(m[1])}</span>`
        + `<span class="ml-marker is-hideable">**</span>`;
      i += m[0].length;
      continue;
    }

    // Italic: *text*
    m = rest.match(/^\*([^*\n]+)\*/);
    if (m && rest[0] === '*' && rest[1] !== '*') {
      out += `<span class="ml-marker is-hideable">*</span>`
        + `<span class="ml-italic">${escHtml(m[1])}</span>`
        + `<span class="ml-marker is-hideable">*</span>`;
      i += m[0].length;
      continue;
    }

    // Inline code: `text`
    m = rest.match(/^`([^`\n]+)`/);
    if (m) {
      out += `<span class="ml-marker is-hideable">\`</span>`
        + `<span class="ml-code">${escHtml(m[1])}</span>`
        + `<span class="ml-marker is-hideable">\`</span>`;
      i += m[0].length;
      continue;
    }

    const next = rest.search(/[\[*`]/);
    const chunk = next === -1 ? rest : rest.slice(0, next || 1);
    out += escHtml(chunk);
    i += chunk.length;
  }
  return out;
}
