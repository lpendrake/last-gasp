export interface ParsedMd {
  title: string;
  body: string;
  baseDir: string;
}

export function parseMd(repoPath: string, raw: string): ParsedMd {
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
