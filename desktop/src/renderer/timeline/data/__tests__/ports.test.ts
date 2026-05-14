import { describe, it, expect, vi, beforeEach } from 'vitest';
import { timelinePort, ConflictError } from '../ports';
import type {
  EventListItem,
  EventWithMtime,
  Session,
  State,
  TagsRegistry,
  Palette,
} from '../types';

const mockFsApi = {
  timelineListEvents: vi.fn(),
  timelineGetEvent: vi.fn(),
  timelineCreateEvent: vi.fn(),
  timelineUpdateEvent: vi.fn(),
  timelineDeleteEvent: vi.fn(),
  timelineGetSessions: vi.fn(),
  timelinePutSessions: vi.fn(),
  timelineGetState: vi.fn(),
  timelinePutState: vi.fn(),
  timelineGetTags: vi.fn(),
  timelineLoadPalette: vi.fn(),
};

vi.stubGlobal('window', { fsApi: mockFsApi });

const CAMPAIGN = '/fake/campaign';
const MTIME = '2026-01-01T00:00:00.000Z';

const ITEM: EventListItem = {
  filename: '4726-03-01-test.md',
  title: 'Test',
  date: '4726-03-01',
  mtime: MTIME,
};

const EVENT_WITH_MTIME: EventWithMtime = {
  event: { ...ITEM, body: 'hello' },
  lastModified: MTIME,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listEvents', () => {
  it('delegates to fsApi', async () => {
    mockFsApi.timelineListEvents.mockResolvedValue([ITEM]);
    const result = await timelinePort.listEvents(CAMPAIGN);
    expect(mockFsApi.timelineListEvents).toHaveBeenCalledWith(CAMPAIGN);
    expect(result).toEqual([ITEM]);
  });
});

describe('getEvent', () => {
  it('delegates to fsApi', async () => {
    mockFsApi.timelineGetEvent.mockResolvedValue(EVENT_WITH_MTIME);
    const result = await timelinePort.getEvent(CAMPAIGN, ITEM.filename);
    expect(mockFsApi.timelineGetEvent).toHaveBeenCalledWith(CAMPAIGN, ITEM.filename);
    expect(result).toEqual(EVENT_WITH_MTIME);
  });
});

describe('createEvent', () => {
  it('delegates to fsApi', async () => {
    mockFsApi.timelineCreateEvent.mockResolvedValue(EVENT_WITH_MTIME);
    const fm = { title: 'Test', date: '4726-03-01' };
    const result = await timelinePort.createEvent(CAMPAIGN, ITEM.filename, fm, 'hello');
    expect(mockFsApi.timelineCreateEvent).toHaveBeenCalledWith(
      CAMPAIGN,
      ITEM.filename,
      fm,
      'hello',
    );
    expect(result).toEqual(EVENT_WITH_MTIME);
  });
});

describe('updateEvent', () => {
  it('returns updated event on success', async () => {
    mockFsApi.timelineUpdateEvent.mockResolvedValue(EVENT_WITH_MTIME);
    const fm = { title: 'Test', date: '4726-03-01' };
    const result = await timelinePort.updateEvent(CAMPAIGN, ITEM.filename, fm, 'body', MTIME);
    expect(result).toEqual(EVENT_WITH_MTIME);
  });

  it('throws ConflictError when the file was concurrently modified', async () => {
    mockFsApi.timelineUpdateEvent.mockResolvedValue({ conflict: true });
    await expect(
      timelinePort.updateEvent(
        CAMPAIGN,
        ITEM.filename,
        { title: 'T', date: '4726-03-01' },
        '',
        MTIME,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('deleteEvent', () => {
  it('resolves on success', async () => {
    mockFsApi.timelineDeleteEvent.mockResolvedValue({ ok: true });
    await expect(timelinePort.deleteEvent(CAMPAIGN, ITEM.filename, MTIME)).resolves.toBeUndefined();
  });

  it('throws ConflictError when the file was concurrently modified', async () => {
    mockFsApi.timelineDeleteEvent.mockResolvedValue({ conflict: true });
    await expect(timelinePort.deleteEvent(CAMPAIGN, ITEM.filename, MTIME)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe('getSessions', () => {
  it('delegates to fsApi', async () => {
    const sessions: Session[] = [
      {
        id: 'abc',
        inGameStart: '4726-01-01T00:00:00',
        inGameEnd: '4726-01-02T00:00:00',
        realStart: '2026-01-01T12:00:00',
        realEnd: '2026-01-01T16:00:00',
        color: '#ff0000',
      },
    ];
    mockFsApi.timelineGetSessions.mockResolvedValue(sessions);
    const result = await timelinePort.getSessions(CAMPAIGN);
    expect(result).toEqual(sessions);
  });
});

describe('putSessions', () => {
  it('delegates to fsApi', async () => {
    mockFsApi.timelinePutSessions.mockResolvedValue({ ok: true });
    await timelinePort.putSessions(CAMPAIGN, []);
    expect(mockFsApi.timelinePutSessions).toHaveBeenCalledWith(CAMPAIGN, []);
  });
});

describe('getState', () => {
  it('delegates to fsApi', async () => {
    const state: State = {
      in_game_now: '4726-03-01T00:00:00',
      campaign_start: '4726-01-01',
    };
    mockFsApi.timelineGetState.mockResolvedValue(state);
    expect(await timelinePort.getState(CAMPAIGN)).toEqual(state);
  });
});

describe('putState', () => {
  it('delegates to fsApi', async () => {
    mockFsApi.timelinePutState.mockResolvedValue({ ok: true });
    const state: State = {
      in_game_now: '4726-03-01',
      campaign_start: '4726-01-01',
    };
    await timelinePort.putState(CAMPAIGN, state);
    expect(mockFsApi.timelinePutState).toHaveBeenCalledWith(CAMPAIGN, state);
  });
});

describe('getTags', () => {
  it('delegates to fsApi', async () => {
    const tags: TagsRegistry = { 'plot:beast': { color: '#8b0000', description: 'Beast arc' } };
    mockFsApi.timelineGetTags.mockResolvedValue(tags);
    expect(await timelinePort.getTags(CAMPAIGN)).toEqual(tags);
  });
});

describe('loadPalette', () => {
  it('delegates to fsApi', async () => {
    const palette: Palette = {
      theme: { background: '#1a1a1a' },
      weekdays: {
        monday: '#8da8c4',
        tuesday: '#a07850',
        wednesday: '#d4a850',
        thursday: '#5a8090',
        friday: '#c06040',
        saturday: '#7560a0',
        sunday: '#e5b860',
      },
    };
    mockFsApi.timelineLoadPalette.mockResolvedValue(palette);
    expect(await timelinePort.loadPalette(CAMPAIGN)).toEqual(palette);
  });
});

// ConflictError identity
describe('ConflictError', () => {
  it('is an instance of Error', () => {
    const e = new ConflictError();
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ConflictError');
  });
});
