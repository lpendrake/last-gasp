import { describe, it, expect } from 'vitest';
import { applySessionUpdate, applySessionSave, applySessionDelete } from '../session-transforms';
import type { Session } from '../../data/types';

function s(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    inGameStart: '4726-05-04T13:00',
    inGameEnd: '4726-05-04T17:00',
    realStart: '2024-01-15T13:00:00',
    realEnd: '2024-01-15T17:00:00',
    color: '#6b7c5a',
    notes: '',
    real_date: '2024-01-15',
    in_game_start: '4726-05-04T13:00',
    ...overrides,
  };
}

describe('applySessionUpdate', () => {
  it('replaces the matching session by id', () => {
    const updated = s('b', { color: '#ff0000' });
    const result = applySessionUpdate([s('a'), s('b'), s('c')], updated);
    expect(result[1].color).toBe('#ff0000');
    expect(result).toHaveLength(3);
  });

  it('preserves array order', () => {
    const result = applySessionUpdate([s('a'), s('b'), s('c')], s('b', { color: '#00ff00' }));
    expect(result.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns unchanged array when id not found', () => {
    const original = [s('a'), s('b')];
    const result = applySessionUpdate(original, s('z'));
    expect(result).toEqual(original);
  });

  it('does not mutate the original array', () => {
    const original = [s('a'), s('b')];
    applySessionUpdate(original, s('a', { color: '#ff0000' }));
    expect(original[0].color).toBe('#6b7c5a');
  });
});

describe('applySessionSave', () => {
  it('replaces existing session when id matches', () => {
    const saved = s('b', { color: '#ff0000' });
    const result = applySessionSave([s('a'), s('b'), s('c')], saved);
    expect(result[1].color).toBe('#ff0000');
    expect(result).toHaveLength(3);
  });

  it('appends when id does not exist', () => {
    const result = applySessionSave([s('a'), s('b')], s('new'));
    expect(result).toHaveLength(3);
    expect(result[2].id).toBe('new');
  });

  it('preserves order when replacing', () => {
    const result = applySessionSave([s('a'), s('b'), s('c')], s('b', { color: '#00ff00' }));
    expect(result.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the original array', () => {
    const original = [s('a')];
    applySessionSave(original, s('new'));
    expect(original).toHaveLength(1);
  });

  it('works on an empty array (append)', () => {
    const result = applySessionSave([], s('first'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('first');
  });
});

describe('applySessionDelete', () => {
  it('removes the session with the given id', () => {
    const result = applySessionDelete([s('a'), s('b'), s('c')], 'b');
    expect(result.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('returns unchanged array when id not found', () => {
    const original = [s('a'), s('b')];
    const result = applySessionDelete(original, 'z');
    expect(result).toEqual(original);
  });

  it('returns empty array when last session is deleted', () => {
    expect(applySessionDelete([s('only')], 'only')).toHaveLength(0);
  });

  it('does not mutate the original array', () => {
    const original = [s('a'), s('b')];
    applySessionDelete(original, 'a');
    expect(original).toHaveLength(2);
  });
});
