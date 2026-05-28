import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createEventHandler } from '../timelineIpcHandlers.js';

const tmpDirs: string[] = [];

function campaign(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-create-event-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

const FRONTMATTER = { title: 'Battle of Sandpoint', date: '4707-10-01' };
const FILENAME = '4707-10-01-battle-of-sandpoint.md';
const BODY = 'A goblin raid.';

describe('createEventHandler', () => {
  it('returns { ok: true, event } with the correct filename on a fresh create', () => {
    const dir = campaign();
    const result = createEventHandler(dir, FILENAME, FRONTMATTER, BODY);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.event.event.filename).toBe(FILENAME);
    expect(result.event.event.title).toBe('Battle of Sandpoint');
    expect(result.event.event.date).toBe('4707-10-01');
    const writtenPath = path.join(dir, 'timeline', FILENAME);
    expect(fs.existsSync(writtenPath)).toBe(true);
  });

  it('returns { ok: false, reason: "duplicate" } and does NOT throw when the file already exists', () => {
    const dir = campaign();
    // Create the file once successfully
    const firstResult = createEventHandler(dir, FILENAME, FRONTMATTER, BODY);
    expect(firstResult.ok).toBe(true);

    // Second call with the same filename must not throw
    const secondResult = createEventHandler(dir, FILENAME, FRONTMATTER, BODY);
    expect(secondResult).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('throws for a genuinely unexpected filesystem error (unsafe filename)', () => {
    const dir = campaign();
    expect(() => {
      createEventHandler(dir, '../escape.md', FRONTMATTER, BODY);
    }).toThrow();
  });
});
