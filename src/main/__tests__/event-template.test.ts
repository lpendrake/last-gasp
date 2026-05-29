import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ensureEventTemplate, readTemplate, DEFAULT_EVENT_TEMPLATE } from '../event-template.js';

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-template-test-'));
  tmpDirs.push(dir);
  return dir;
}

describe('ensureEventTemplate', () => {
  it('creates templates/event.md with DEFAULT_EVENT_TEMPLATE when absent', () => {
    const dir = makeTmpDir();
    ensureEventTemplate(dir);
    const filePath = path.join(dir, 'templates', 'event.md');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(DEFAULT_EVENT_TEMPLATE);
  });

  it('does not overwrite an existing event.md', () => {
    const dir = makeTmpDir();
    const templatesDir = path.join(dir, 'templates');
    fs.mkdirSync(templatesDir, { recursive: true });
    const filePath = path.join(templatesDir, 'event.md');
    const customContent = '# My custom template\n';
    fs.writeFileSync(filePath, customContent, 'utf-8');

    ensureEventTemplate(dir);

    expect(fs.readFileSync(filePath, 'utf-8')).toBe(customContent);
  });
});

describe('readTemplate', () => {
  it('returns the file contents when present', () => {
    const dir = makeTmpDir();
    ensureEventTemplate(dir);
    const result = readTemplate(dir, 'event');
    expect(result).toBe(DEFAULT_EVENT_TEMPLATE);
  });

  it('returns null when the file is missing', () => {
    const dir = makeTmpDir();
    const result = readTemplate(dir, 'event');
    expect(result).toBeNull();
  });
});
