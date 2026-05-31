import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildEntityIndex, indexSingleEntity } from '../entity-index.js';

function makeTmpCampaign(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tti-test-'));
}

function writeFile(campaignDir: string, relPath: string, content: string): void {
  const full = path.join(campaignDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}

const NOTE_CONTENT = '---\nid: abc1\ntitle: My Note\n---\n\nContent.\n';
const EVENT_CONTENT = '---\nid: ev01\ntitle: Battle of Dawn\n---\n\nDetails.\n';

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

function campaign(): string {
  const dir = makeTmpCampaign();
  tmpDirs.push(dir);
  return dir;
}

describe('buildEntityIndex – backward compatibility', () => {
  it('works without a callback and returns entries', () => {
    const dir = campaign();
    writeFile(dir, 'notes/hero.md', NOTE_CONTENT);
    const index = buildEntityIndex(dir);
    expect(index).toHaveLength(1);
    expect(index[0].title).toBe('My Note');
  });

  it('returns [] when campaign has no notes or timeline dirs', () => {
    const dir = campaign();
    expect(buildEntityIndex(dir)).toEqual([]);
  });
});

describe('buildEntityIndex – progress callback', () => {
  it('calls onProgress once per md file with incrementing completed and stable total', () => {
    const dir = campaign();
    writeFile(dir, 'notes/a.md', NOTE_CONTENT);
    writeFile(dir, 'notes/b.md', NOTE_CONTENT);
    writeFile(dir, 'timeline/e.md', EVENT_CONTENT);

    const calls: Array<[number, number]> = [];
    buildEntityIndex(dir, (completed, total) => calls.push([completed, total]));

    expect(calls).toHaveLength(3);
    // total stays constant at 3 across all calls
    expect(calls.every(([, t]) => t === 3)).toBe(true);
    // completed increments from 1 to 3
    expect(calls.map(([c]) => c)).toEqual([1, 2, 3]);
  });

  it('fires callback for asset files in notes/', () => {
    const dir = campaign();
    writeFile(dir, 'notes/map.png', '');
    writeFile(dir, 'notes/hero.md', NOTE_CONTENT);

    const calls: Array<[number, number]> = [];
    buildEntityIndex(dir, (completed, total) => calls.push([completed, total]));

    expect(calls).toHaveLength(2);
    expect(calls.every(([, t]) => t === 2)).toBe(true);
  });

  it('does not fire callback for asset files in timeline/', () => {
    const dir = campaign();
    writeFile(dir, 'timeline/map.png', '');
    writeFile(dir, 'timeline/battle.md', EVENT_CONTENT);

    const calls: Array<[number, number]> = [];
    buildEntityIndex(dir, (completed, total) => calls.push([completed, total]));

    // only the .md file is processed; asset in timeline/ is ignored
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([1, 1]);
  });

  it('reports total = 0 and never fires when both dirs are empty', () => {
    const dir = campaign();
    fs.mkdirSync(path.join(dir, 'notes'));
    fs.mkdirSync(path.join(dir, 'timeline'));

    const calls: Array<[number, number]> = [];
    buildEntityIndex(dir, (completed, total) => calls.push([completed, total]));

    expect(calls).toHaveLength(0);
  });

  it('does not count or fire callback for unsupported extensions in notes/ or timeline/', () => {
    const dir = campaign();
    writeFile(dir, 'notes/hero.md', NOTE_CONTENT);
    writeFile(dir, 'notes/notes.txt', 'plain text');
    writeFile(dir, 'timeline/battle.md', EVENT_CONTENT);
    writeFile(dir, 'timeline/log.txt', 'plain text');

    const calls: Array<[number, number]> = [];
    buildEntityIndex(dir, (completed, total) => calls.push([completed, total]));

    // .txt files are never counted or ticked
    expect(calls).toHaveLength(2);
    expect(calls.every(([, t]) => t === 2)).toBe(true);
  });

  it('traverses subdirectories and counts nested files', () => {
    const dir = campaign();
    writeFile(dir, 'notes/chapter1/note1.md', NOTE_CONTENT);
    writeFile(dir, 'notes/chapter1/note2.md', NOTE_CONTENT);
    writeFile(dir, 'notes/chapter2/note3.md', NOTE_CONTENT);

    const calls: Array<[number, number]> = [];
    buildEntityIndex(dir, (completed, total) => calls.push([completed, total]));

    expect(calls).toHaveLength(3);
    expect(calls.every(([, t]) => t === 3)).toBe(true);
    expect(calls[calls.length - 1][0]).toBe(3);
  });
});

describe('tags indexing', () => {
  it('populates entry.tags from frontmatter for a note with tags', () => {
    const dir = campaign();
    const content = '---\nid: n001\ntitle: Tagged Note\ntags:\n  - a\n  - b\n---\n\nContent.\n';
    writeFile(dir, 'notes/tagged.md', content);
    const index = buildEntityIndex(dir);
    expect(index).toHaveLength(1);
    expect(index[0].tags).toEqual(['a', 'b']);
  });

  it('leaves entry.tags undefined when no tags field is present', () => {
    const dir = campaign();
    writeFile(dir, 'notes/no-tags.md', NOTE_CONTENT);
    const index = buildEntityIndex(dir);
    expect(index).toHaveLength(1);
    expect(index[0].tags).toBeUndefined();
  });

  it('filters out non-string values from a mixed tags array', () => {
    const dir = campaign();
    // YAML: tags: [foo, 3, null] — yaml parses 3 as number and null as null
    const content =
      '---\nid: n002\ntitle: Mixed Tags\ntags:\n  - foo\n  - 3\n  - null\n---\n\nBody.\n';
    writeFile(dir, 'notes/mixed.md', content);
    const index = buildEntityIndex(dir);
    expect(index).toHaveLength(1);
    expect(index[0].tags).toEqual(['foo']);
  });

  it('populates entry.tags for a timeline event entry', () => {
    const dir = campaign();
    const content = '---\nid: ev02\ntitle: Dragon Plot\ntags:\n  - plot:dragon\n---\n\nDetails.\n';
    writeFile(dir, 'timeline/dragon.md', content);
    const index = buildEntityIndex(dir);
    expect(index).toHaveLength(1);
    expect(index[0].tags).toEqual(['plot:dragon']);
  });

  it('indexSingleEntity populates tags for a note', () => {
    const dir = campaign();
    const content = '---\nid: n003\ntitle: Single Note\ntags:\n  - x\n  - y\n---\n\nText.\n';
    writeFile(dir, 'notes/single.md', content);
    const fullPath = path.join(dir, 'notes/single.md');
    const entry = indexSingleEntity(fullPath, dir);
    expect(entry).not.toBeNull();
    expect(entry!.tags).toEqual(['x', 'y']);
  });
});
