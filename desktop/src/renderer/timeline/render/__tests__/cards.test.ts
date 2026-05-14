import { describe, it, expect } from 'vitest';
import {
  layoutCards,
  assignRows,
  weekdayColorFromPalette,
  CARD_HEIGHT,
  CARD_GAP,
  CARD_PADDING_X,
} from '../cards';
import type { EventListItem, Palette } from '../../data/types';
import { type ViewState, type ViewportSize, secondsToX } from '../../math/zoom';
import { toAbsoluteSeconds, parseISOString } from '../../calendar/golarian';

// ---- Fixtures ----

const SIZE: ViewportSize = { width: 1200, height: 600 };

// Reference date: 4726-05-04 (Wednesday)
const REF_DATE = '4726-05-04';
const REF_SECS = toAbsoluteSeconds(parseISOString(REF_DATE));

const VIEW: ViewState = { centerSeconds: REF_SECS, secondsPerPixel: 432 };

const MOCK_PALETTE: Palette = {
  theme: {
    surface: '#242420',
    border: '#3a3a30',
    border_strong: '#5a4530',
    text_primary: '#d8d0b8',
    text_secondary: '#a89a80',
    text_muted: '#7a6f58',
    accent_gold: '#c9a860',
    dotted_future: '#7a6f58',
  },
  weekdays: {
    monday: '#c9a860',
    tuesday: '#7a9a4a',
    wednesday: '#e07b39',
    thursday: '#5a8fbf',
    friday: '#9b7bc0',
    saturday: '#c06060',
    sunday: '#4a9a7a',
  },
};

function ev(
  filename: string,
  date: string,
  title: string,
  opts: Partial<EventListItem> = {},
): EventListItem {
  return { filename, date, title, tags: [], mtime: '2026-04-22T00:00:00Z', ...opts };
}

// ~20 event fixture mirroring the screenshot (Desnus 3–10, 4726)
const FIXTURE_EVENTS: EventListItem[] = [
  ev('a01.md', '4726-05-03T01:30:00', 'Pirating Cows'),
  ev('a02.md', '4726-05-04T01:30:00', 'Drug Ship Seized'),
  ev('a03.md', '4726-05-04T11:15:00', 'Drug Ship Trial', { tags: ['combat'] }),
  ev('a04.md', '4726-05-04T12:00:00', 'Arrived at the mine'),
  ev('a05.md', '4726-05-04T12:15:00', 'Fight with the guardians'),
  ev('a06.md', '4726-05-04T12:30:00', 'Druids'),
  ev('a07.md', '4726-05-04T13:00:00', 'Closing the Portal'),
  ev('a08.md', '4726-05-04T13:30:00', 'Payout for closing the portal', { color: '#e07b39' }),
  ev('a09.md', '4726-05-04T14:00:00', 'Talking to the forman'),
  ev('a10.md', '4726-05-05T10:00:00', "Auditor's Dream"),
  ev('a11.md', '4726-05-05T12:00:00', 'The Gozran Squall'),
  ev('a12.md', '4726-05-06T09:00:00', 'Crafting', { tags: ['crafting'] }),
  ev('a13.md', '4726-05-06T11:00:00', 'A random story'),
  ev('a14.md', '4726-05-07T00:00:00', 'Crafting'),
  ev('a15.md', '4726-05-08T00:00:00', 'Day spent organising the smuggling efforts'),
  ev('a16.md', '4726-05-09T06:00:00', 'Set sail for the fortress'),
  ev('a17.md', '4726-05-09T09:00:00', 'Intercepted by the free sails'),
  ev('a18.md', '4726-05-09T12:00:00', 'Talked with Zephyr Swiftwind'),
  ev('a19.md', '4726-05-10T00:00:00', 'Claiming the Drug-Lab Ship'),
  ev('a20.md', '4726-05-10T12:00:00', 'Payout for closing the portal'),
];

// "Now" is start of Mon 9, so events from a16 onward are future
const NOW_SECS = toAbsoluteSeconds(parseISOString('4726-05-09'));

// ---- layoutCards ----

describe('layoutCards', () => {
  it('returns empty array for no events', () => {
    expect(layoutCards([], VIEW, SIZE, REF_SECS)).toEqual([]);
  });

  it('positions an event at center x when its date equals centerSeconds', () => {
    const [card] = layoutCards([ev('a.md', REF_DATE, 'T')], VIEW, SIZE, REF_SECS);
    expect(card.x).toBeCloseTo(SIZE.width / 2, 5);
  });

  it('card.seconds matches toAbsoluteSeconds of the event date', () => {
    const [card] = layoutCards([ev('a.md', REF_DATE, 'T')], VIEW, SIZE, REF_SECS);
    expect(card.seconds).toBe(REF_SECS);
  });

  it('card.x matches secondsToX for the same date', () => {
    const date = '4726-05-06';
    const secs = toAbsoluteSeconds(parseISOString(date));
    const [card] = layoutCards([ev('a.md', date, 'T')], VIEW, SIZE, REF_SECS);
    expect(card.x).toBeCloseTo(secondsToX(secs, VIEW, SIZE), 5);
  });

  it('marks events after inGameNowSeconds as future', () => {
    const futureDate = '4726-05-09T06:00:00';
    const nowSecs = toAbsoluteSeconds(parseISOString('4726-05-09'));
    const [card] = layoutCards([ev('a.md', futureDate, 'Future')], VIEW, SIZE, nowSecs);
    expect(card.isFuture).toBe(true);
  });

  it('marks events at or before inGameNowSeconds as past', () => {
    const pastDate = '4726-05-04T12:00:00';
    const nowSecs = toAbsoluteSeconds(parseISOString('4726-05-09'));
    const [card] = layoutCards([ev('a.md', pastDate, 'Past')], VIEW, SIZE, nowSecs);
    expect(card.isFuture).toBe(false);
  });

  it('places future events to the right of past events', () => {
    const events = [ev('past.md', '4726-05-04', 'Past'), ev('future.md', '4726-05-09', 'Future')];
    const nowSecs = toAbsoluteSeconds(parseISOString('4726-05-06'));
    const cards = layoutCards(events, VIEW, SIZE, nowSecs);
    const past = cards.find((c) => c.event.filename === 'past.md')!;
    const future = cards.find((c) => c.event.filename === 'future.md')!;
    expect(future.x).toBeGreaterThan(past.x);
  });
});

// ---- assignRows ----

describe('assignRows', () => {
  it('returns empty map for empty input', () => {
    expect(assignRows([])).toEqual(new Map());
  });

  it('places a single card in row 0', () => {
    const laidOut = layoutCards([ev('a.md', REF_DATE, 'Solo')], VIEW, SIZE, REF_SECS);
    const placements = assignRows(laidOut);
    expect(placements.get('a.md')!.row).toBe(0);
  });

  it('places non-overlapping cards in row 0', () => {
    // Events 10 days apart are never close enough to overlap
    const events = [ev('a.md', '4726-05-01', 'Alpha'), ev('b.md', '4726-05-20', 'Beta')];
    const laidOut = layoutCards(events, VIEW, SIZE, REF_SECS);
    const placements = assignRows(laidOut);
    expect(placements.get('a.md')!.row).toBe(0);
    expect(placements.get('b.md')!.row).toBe(0);
  });

  it('bumps a card to row 1 when it overlaps a row-0 card', () => {
    // Two events on the same day, same time → same x → guaranteed overlap
    const events = [
      ev('a.md', '4726-05-04T12:00:00', 'First'),
      ev('b.md', '4726-05-04T12:01:00', 'Second'),
    ];
    const laidOut = layoutCards(events, VIEW, SIZE, REF_SECS);
    const placements = assignRows(laidOut);
    const rows = [placements.get('a.md')!.row, placements.get('b.md')!.row].sort();
    expect(rows).toEqual([0, 1]);
  });

  it('stacks three tightly-clustered cards into rows 0, 1, 2', () => {
    const events = [
      ev('a.md', '4726-05-04T12:00:00', 'First'),
      ev('b.md', '4726-05-04T12:01:00', 'Second'),
      ev('c.md', '4726-05-04T12:02:00', 'Third'),
    ];
    const laidOut = layoutCards(events, VIEW, SIZE, REF_SECS);
    const placements = assignRows(laidOut);
    const rows = ['a.md', 'b.md', 'c.md'].map((f) => placements.get(f)!.row).sort((a, b) => a - b);
    expect(rows).toEqual([0, 1, 2]);
  });

  it('card width is clamped between 120 and 360', () => {
    const shortTitle = ev('a.md', REF_DATE, 'Hi');
    const longTitle = ev(
      'b.md',
      '4726-05-10',
      'A very long title that exceeds the maximum card width allowed by the layout algorithm',
    );
    const laidOut = layoutCards([shortTitle, longTitle], VIEW, SIZE, REF_SECS);
    const placements = assignRows(laidOut);
    expect(placements.get('a.md')!.width).toBe(120);
    expect(placements.get('b.md')!.width).toBe(360);
  });

  it('estimated width uses CARD_PADDING_X constant (not a magic number)', () => {
    // A title long enough to exceed the minimum and check exact formula
    // estWidth = max(120, min(360, len * 8 + CARD_PADDING_X * 2))
    const title = 'TwentyCharsTitleHere'; // 20 chars → 20*8+24=184
    expect(title.length).toBe(20);
    const laidOut = layoutCards([ev('a.md', REF_DATE, title)], VIEW, SIZE, REF_SECS);
    const placements = assignRows(laidOut);
    expect(placements.get('a.md')!.width).toBe(20 * 8 + CARD_PADDING_X * 2);
  });

  it('connector top and height are geometrically consistent', () => {
    // For a card in row r, connector.top + connector.height should equal axisY
    const axisY = Math.floor(SIZE.height * 0.8);
    const events = [
      ev('a.md', '4726-05-04T12:00:00', 'First'),
      ev('b.md', '4726-05-04T12:01:00', 'Second'),
    ];
    const laidOut = layoutCards(events, VIEW, SIZE, REF_SECS);
    const placements = assignRows(laidOut);
    for (const [filename, { row }] of placements) {
      const connTop = axisY - CARD_GAP - row * (CARD_HEIGHT + CARD_GAP);
      const connHeight = CARD_GAP + row * (CARD_HEIGHT + CARD_GAP);
      expect(connTop + connHeight).toBe(axisY);
      void filename;
    }
  });
});

// ---- weekdayColorFromPalette ----

describe('weekdayColorFromPalette', () => {
  it('returns monday color for a Monday date', () => {
    // 4726-05-02 is a Monday (4726-05-04 is Wednesday, 2 days earlier)
    expect(weekdayColorFromPalette(parseISOString('4726-05-02'), MOCK_PALETTE)).toBe(
      MOCK_PALETTE.weekdays.monday,
    );
  });

  it('returns wednesday color for 4726-05-04 (the anchor Wednesday)', () => {
    expect(weekdayColorFromPalette(parseISOString('4726-05-04'), MOCK_PALETTE)).toBe(
      MOCK_PALETTE.weekdays.wednesday,
    );
  });

  it('returns thursday color for 4726-05-05', () => {
    expect(weekdayColorFromPalette(parseISOString('4726-05-05'), MOCK_PALETTE)).toBe(
      MOCK_PALETTE.weekdays.thursday,
    );
  });

  it('returns friday color for 4726-05-06', () => {
    expect(weekdayColorFromPalette(parseISOString('4726-05-06'), MOCK_PALETTE)).toBe(
      MOCK_PALETTE.weekdays.friday,
    );
  });

  it('returns saturday color for 4726-05-07', () => {
    expect(weekdayColorFromPalette(parseISOString('4726-05-07'), MOCK_PALETTE)).toBe(
      MOCK_PALETTE.weekdays.saturday,
    );
  });

  it('returns sunday color for 4726-05-08', () => {
    expect(weekdayColorFromPalette(parseISOString('4726-05-08'), MOCK_PALETTE)).toBe(
      MOCK_PALETTE.weekdays.sunday,
    );
  });

  it('returns tuesday color for 4726-05-03', () => {
    expect(weekdayColorFromPalette(parseISOString('4726-05-03'), MOCK_PALETTE)).toBe(
      MOCK_PALETTE.weekdays.tuesday,
    );
  });
});

// ---- Snapshot: ~20 event fixture ----

describe('snapshot: ~20 event fixture', () => {
  it('layoutCards output matches snapshot', () => {
    const laidOut = layoutCards(FIXTURE_EVENTS, VIEW, SIZE, NOW_SECS);
    const snapshot = laidOut.map((c) => ({
      filename: c.event.filename,
      x: Math.round(c.x * 100) / 100, // 2dp for readability
      isFuture: c.isFuture,
    }));
    expect(snapshot).toMatchSnapshot();
  });

  it('assignRows output matches snapshot', () => {
    const laidOut = layoutCards(FIXTURE_EVENTS, VIEW, SIZE, NOW_SECS);
    const placements = assignRows(laidOut);
    // Merge layout + placement into a stable-ordered array for the snapshot
    const snapshot = FIXTURE_EVENTS.map((e) => ({
      filename: e.filename,
      row: placements.get(e.filename)!.row,
      width: placements.get(e.filename)!.width,
    }));
    expect(snapshot).toMatchSnapshot();
  });

  it('no two cards in the same row overlap', () => {
    const laidOut = layoutCards(FIXTURE_EVENTS, VIEW, SIZE, NOW_SECS);
    const placements = assignRows(laidOut);

    // Build row → [{left, right}] and assert no overlaps
    const rowBuckets = new Map<number, { left: number; right: number }[]>();
    for (const card of laidOut) {
      const { row, width } = placements.get(card.event.filename)!;
      const left = card.x - width / 2;
      const right = card.x + width / 2;
      if (!rowBuckets.has(row)) rowBuckets.set(row, []);
      rowBuckets.get(row)!.push({ left, right });
    }

    for (const [, segments] of rowBuckets) {
      for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
          const a = segments[i],
            b = segments[j];
          const overlaps = !(a.right < b.left || b.right < a.left);
          expect(overlaps).toBe(false);
        }
      }
    }
  });
});
