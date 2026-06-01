import { describe, it, expect } from 'vitest';
import { findAdjacentEvent } from '../event-navigation';
import { EventListItem } from '../../data/types';
import { toAbsoluteSeconds, parseISOString } from '../../calendar/golarian';

function makeEvent(filename: string, date: string): EventListItem {
  return { filename, date, title: filename, mtime: '2024-01-01T00:00:00Z' };
}

// Fixture: three events in ascending chronological order
const EVENT_A = makeEvent('event-a.md', '4726-01-01');
const EVENT_B = makeEvent('event-b.md', '4726-03-15');
const EVENT_C = makeEvent('event-c.md', '4726-06-01');

const FIXTURE = [EVENT_C, EVENT_A, EVENT_B]; // deliberately unsorted

const secondsOf = (date: string) => toAbsoluteSeconds(parseISOString(date));

describe('findAdjacentEvent', () => {
  it('next from a focused event returns the following event', () => {
    const result = findAdjacentEvent(FIXTURE, 0, 'event-b.md', 'next');
    expect(result).toEqual({ filename: 'event-c.md', seconds: secondsOf('4726-06-01') });
  });

  it('prev from a focused event returns the preceding event', () => {
    const result = findAdjacentEvent(FIXTURE, 0, 'event-b.md', 'prev');
    expect(result).toEqual({ filename: 'event-a.md', seconds: secondsOf('4726-01-01') });
  });

  it('next from a bare reference time returns the first event after it', () => {
    const ref = secondsOf('4726-02-01');
    const result = findAdjacentEvent(FIXTURE, ref, null, 'next');
    expect(result).toEqual({ filename: 'event-b.md', seconds: secondsOf('4726-03-15') });
  });

  it('next at the last event returns null (no wrap)', () => {
    const result = findAdjacentEvent(FIXTURE, 0, 'event-c.md', 'next');
    expect(result).toBeNull();
  });

  it('empty event list returns null', () => {
    const result = findAdjacentEvent([], 0, null, 'next');
    expect(result).toBeNull();
  });
});
