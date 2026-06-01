import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  getWorkspaceDefaultTheme,
  setWorkspaceDefaultTheme,
  getCampaignTheme,
  setCampaignTheme,
  getCampaignOverrides,
} from '../theme-settings.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-theme-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

// Test 1
describe('getWorkspaceDefaultTheme', () => {
  it('returns null when no settings.json exists', () => {
    const dir = makeTmpDir();
    expect(getWorkspaceDefaultTheme(dir)).toBeNull();
  });

  // Test 2
  it('returns the value after setWorkspaceDefaultTheme and creates the file', () => {
    const dir = makeTmpDir();
    setWorkspaceDefaultTheme(dir, 'dark-pathfinder');
    expect(getWorkspaceDefaultTheme(dir)).toBe('dark-pathfinder');
    expect(fs.existsSync(path.join(dir, 'settings.json'))).toBe(true);
  });

  // Test 3
  it('preserves unrelated keys when writing', () => {
    const dir = makeTmpDir();
    const settingsFile = path.join(dir, 'settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify({ someOtherKey: 'preserve-me' }, null, 2));
    setWorkspaceDefaultTheme(dir, 'lightfinder');
    const obj = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    expect(obj.defaultTheme).toBe('lightfinder');
    expect(obj.someOtherKey).toBe('preserve-me');
  });

  // Test 4
  it('returns null when settings.json is malformed JSON', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'settings.json'), 'not valid json {{{');
    expect(getWorkspaceDefaultTheme(dir)).toBeNull();
  });
});

// Test 5
describe('getCampaignTheme', () => {
  it('returns null when no file exists', () => {
    const dir = makeTmpDir();
    expect(getCampaignTheme(dir)).toBeNull();
  });

  it('returns null when file exists but lacks the theme key', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ otherKey: 'value' }));
    expect(getCampaignTheme(dir)).toBeNull();
  });

  // Test 6
  it('returns the value after setCampaignTheme roundtrip', () => {
    const dir = makeTmpDir();
    setCampaignTheme(dir, 'dark-pathfinder');
    expect(getCampaignTheme(dir)).toBe('dark-pathfinder');
  });

  // Test 7
  it('setCampaignTheme(null) removes the theme key while preserving other keys', () => {
    const dir = makeTmpDir();
    const settingsFile = path.join(dir, 'settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify({ theme: 'dark-pathfinder', otherKey: 'keep' }));
    setCampaignTheme(dir, null);
    expect(getCampaignTheme(dir)).toBeNull();
    const obj = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    expect(obj.otherKey).toBe('keep');
    expect('theme' in obj).toBe(false);
  });

  // Test 8
  it('setCampaignTheme(null) does not throw and does not create the file when no file exists', () => {
    const dir = makeTmpDir();
    expect(() => setCampaignTheme(dir, null)).not.toThrow();
    expect(fs.existsSync(path.join(dir, 'settings.json'))).toBe(false);
  });
});

// Test 9
describe('getCampaignOverrides', () => {
  it('returns only paths that have a theme set', () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    const dirC = makeTmpDir();

    setCampaignTheme(dirA, 'dark-pathfinder');
    setCampaignTheme(dirB, 'lightfinder');
    // dirC has no settings file

    const result = getCampaignOverrides([dirA, dirB, dirC]);
    expect(result[dirA]).toBe('dark-pathfinder');
    expect(result[dirB]).toBe('lightfinder');
    expect(dirC in result).toBe(false);
    expect(Object.keys(result)).toHaveLength(2);
  });
});
