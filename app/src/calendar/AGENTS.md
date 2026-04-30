# `src/calendar/` — Golarian Calendar Utilities

Leaf utility. Converts between Golarian (in-game) and UTC timestamps,
formats dates and times for display.

## Files

- `golarian.ts` — `parseISOString`, `toAbsoluteSeconds`,
  `fromAbsoluteSeconds`, `toISOString`. Constants for seconds/day, etc.
- `format.ts` — `formatNowMarker`, `formatAxisDay`, `formatAxisHour`.
- `calendar.test.ts` — round-trip and boundary tests.

## Allowed imports

Nothing from `app/src` except other files in this folder. This is a leaf.

## Forbidden imports

- `data/*`, `domain/*`, any view slice. If you need data here, you're
  in the wrong folder.
- React, DOM. Pure functions only.

## Conventions

- All functions are pure.
- Time values are `number` seconds-since-Golarian-epoch.
- Add a test for any new conversion. `calendar.test.ts` covers boundary
  conditions (leap years, day rollover) — extend the same pattern.

## Don't

- Don't add date formatting that depends on locale settings or `Intl`.
  The campaign uses fixed strings; consistency matters.
- Don't add caches. The functions are cheap.
