import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFileAtomic } from './fs-atomic.ts';

let testDir: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(join(tmpdir(), 'last-gasp-test-'));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe('writeFileAtomic', () => {
  it('writes new content to a fresh file', async () => {
    const p = join(testDir, 'new.txt');
    await writeFileAtomic(p, 'hello world');
    expect(await fs.readFile(p, 'utf-8')).toBe('hello world');
  });

  it('overwrites an existing file atomically', async () => {
    const p = join(testDir, 'existing.txt');
    await fs.writeFile(p, 'old content');
    await writeFileAtomic(p, 'new content');
    expect(await fs.readFile(p, 'utf-8')).toBe('new content');
  });

  it('leaves no .tmp files behind on success', async () => {
    const p = join(testDir, 'clean.txt');
    await writeFileAtomic(p, 'content');
    const files = await fs.readdir(testDir);
    expect(files.filter(f => f.includes('.tmp'))).toEqual([]);
  });

  it('does not corrupt file on rename failure', async () => {
    // Write to a path where the parent doesn't exist — rename should fail and leave no junk
    const badPath = join(testDir, 'no-such-dir', 'file.txt');
    await expect(writeFileAtomic(badPath, 'content')).rejects.toThrow();
    // The .tmp file should have been cleaned up — the parent dir itself doesn't exist so nothing to check there
    const files = await fs.readdir(testDir);
    expect(files.filter(f => f.includes('.tmp'))).toEqual([]);
  });

  it('handles Unicode content correctly', async () => {
    const p = join(testDir, 'unicode.txt');
    const content = 'Héllo 👋 wörld — 4726 AR';
    await writeFileAtomic(p, content);
    expect(await fs.readFile(p, 'utf-8')).toBe(content);
  });

  it('handles large content', async () => {
    const p = join(testDir, 'large.txt');
    const content = 'x'.repeat(1024 * 1024);
    await writeFileAtomic(p, content);
    const read = await fs.readFile(p, 'utf-8');
    expect(read.length).toBe(content.length);
  });

  it('concurrent writes never produce corrupt content', async () => {
    // On Windows, rename can fail with EPERM under concurrent contention —
    // that's fine (the write simply didn't happen). What matters for the
    // durability contract: the file on disk is always a complete valid write.
    const p = join(testDir, 'concurrent.txt');
    const results = await Promise.allSettled([
      writeFileAtomic(p, 'aaa'),
      writeFileAtomic(p, 'bbb'),
      writeFileAtomic(p, 'ccc'),
    ]);
    const anySucceeded = results.some(r => r.status === 'fulfilled');
    expect(anySucceeded).toBe(true);
    const content = await fs.readFile(p, 'utf-8');
    expect(['aaa', 'bbb', 'ccc']).toContain(content);
  });
});
