import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock timelinePort before importing the module under test.
vi.mock('../../data/ports', () => ({
  timelinePort: {
    createEvent: vi.fn(),
  },
}));

import { createEventChecked } from '../create-event-checked';
import { timelinePort } from '../../data/ports';
import type { CreateEventResult, EventWithMtime } from '../../data/types';

const CAMPAIGN_PATH = '/campaign';
const FILENAME = 'battle-of-sandpoint.md';
const FRONTMATTER = { title: 'Battle of Sandpoint', date: '4707-10-01', tags: [] };
const BODY = 'A goblin raid on Sandpoint.';

const MOCK_EVENT: EventWithMtime = {
  event: {
    filename: FILENAME,
    title: 'Battle of Sandpoint',
    date: '4707-10-01',
    tags: [],
    body: BODY,
    mtime: '2026-01-01T00:00:00.000Z',
  },
  lastModified: '2026-01-01T00:00:00.000Z',
};

describe('createEventChecked', () => {
  beforeEach(() => {
    vi.mocked(timelinePort.createEvent).mockReset();
  });

  it('passes through { ok: true, event } from the port on success', async () => {
    const okResult: CreateEventResult = { ok: true, event: MOCK_EVENT };
    vi.mocked(timelinePort.createEvent).mockResolvedValue(okResult);

    const result = await createEventChecked(CAMPAIGN_PATH, FILENAME, FRONTMATTER, BODY);

    expect(result).toEqual(okResult);
    expect(timelinePort.createEvent).toHaveBeenCalledWith(
      CAMPAIGN_PATH,
      FILENAME,
      FRONTMATTER,
      BODY,
    );
  });

  it('passes through { ok: false, reason: "duplicate" } from the port', async () => {
    const dupResult: CreateEventResult = { ok: false, reason: 'duplicate' };
    vi.mocked(timelinePort.createEvent).mockResolvedValue(dupResult);

    const result = await createEventChecked(CAMPAIGN_PATH, FILENAME, FRONTMATTER, BODY);

    expect(result).toEqual(dupResult);
  });

  it('propagates an unexpected rejection from the port', async () => {
    const diskError = new Error('disk full');
    vi.mocked(timelinePort.createEvent).mockRejectedValue(diskError);

    await expect(createEventChecked(CAMPAIGN_PATH, FILENAME, FRONTMATTER, BODY)).rejects.toThrow(
      'disk full',
    );
  });
});
