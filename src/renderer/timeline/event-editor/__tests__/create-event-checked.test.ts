import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock timelinePort before importing the module under test.
vi.mock('../../data/ports', () => ({
  timelinePort: {
    createEvent: vi.fn(),
  },
}));

import { createEventChecked } from '../create-event-checked';
import { timelinePort } from '../../data/ports';
import type { EventWithMtime } from '../../data/types';

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

  it('returns ok with the created event on success', async () => {
    vi.mocked(timelinePort.createEvent).mockResolvedValue(MOCK_EVENT);

    const result = await createEventChecked(CAMPAIGN_PATH, FILENAME, FRONTMATTER, BODY);

    expect(result).toEqual({ ok: true, event: MOCK_EVENT });
    expect(timelinePort.createEvent).toHaveBeenCalledWith(
      CAMPAIGN_PATH,
      FILENAME,
      FRONTMATTER,
      BODY,
    );
  });

  it('returns a duplicate result when the file already exists (error with code EEXIST)', async () => {
    const eexistError = Object.assign(new Error('ENOENT'), { code: 'EEXIST' });
    vi.mocked(timelinePort.createEvent).mockRejectedValue(eexistError);

    const result = await createEventChecked(CAMPAIGN_PATH, FILENAME, FRONTMATTER, BODY);

    expect(result).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('returns a duplicate result when the file already exists (plain Error with EEXIST in message)', async () => {
    const eexistError = new Error('Error invoking remote method: EEXIST file already exists');
    vi.mocked(timelinePort.createEvent).mockRejectedValue(eexistError);

    const result = await createEventChecked(CAMPAIGN_PATH, FILENAME, FRONTMATTER, BODY);

    expect(result).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('rethrows any non-collision error', async () => {
    const diskError = new Error('disk full');
    vi.mocked(timelinePort.createEvent).mockRejectedValue(diskError);

    await expect(createEventChecked(CAMPAIGN_PATH, FILENAME, FRONTMATTER, BODY)).rejects.toThrow(
      'disk full',
    );
  });
});
