# The Last Gasp of Civilisation — Campaign Timeline App

**Status:** planning complete, ready to implement
**Last updated:** 2026-04-20
**Author:** Laurie (GM) + Claude (pairing)

This document is the single source of truth for building and evolving the timeline webapp that sits alongside the campaign bible. It's written to be self-contained: an LLM or developer picking this up fresh should be able to read it and understand context, decisions, and what to build, without needing prior conversation history.

---

## 1. Context

### 1.1 What this is

A locally-run webapp for visualising and editing a Pathfinder 2e campaign timeline. The GM (Laurie) runs a long-running campaign called *The Last Gasp of Civilisation* with multiple interleaved plot threads (the beast in the volcano, the ancients, the Twin Thorns investigation, the Abadar vs. Asmodeus vs. Pharasma political tangle, the fort, the boat, a scheming dragon, and so on). Keeping track of what happened when — across in-game Golarian dates and real-world session dates — has become unmanageable in a single Google Doc.

The app renders a horizontal timeline with filterable events, each event being a markdown file with frontmatter. It lives in the same Git repo as the GM's notes, player guide, faction reference, and NPC catalogue, all as markdown.

### 1.2 Campaign basics worth knowing

- **System:** Pathfinder 2e Remaster (prefer Remaster content; Team+ content is permitted).
- **Optional rules in use:** Proficiency Without Level, Free Archetype (no restrictions), Automatic Bonus Progression.
- **Setting:** Island of Emberheart, city of Stormhaven. Trapped by a multi-dimensional barrier preventing escape. Fractured theocracy split between Abadar (order/trade), Asmodeus (contracts/law), Pharasma (death/cycle), the Free Sails (naval), and the Smokers (industrial). Ancients awakening from stasis. Portals opening to other planes.
- **In-game calendar:** Golarian calendar (see §5 Calendar Specification).
- **Campaign start:** 1st of Pharast (roughly spring equivalent). Current in-game date at time of planning: **4726-05-04** (Wealday, 4th of Desnus, 4726 AR).
- **Primary source of truth for lore:** the Google Doc `The Last Gasp of Civilisation` (id `1bU6jgwIQEjMUmmZJ4wG0PUEk1VGPOurUkHaW-z2pdbo`). Content will be migrated incrementally into this repo.

### 1.3 Rejected alternatives (don't revisit)

- **Obsidian.** Tried, UI felt messy, plugin ecosystem didn't match aesthetic, no good Golarian calendar support. `.obsidian` folder was deleted from the repo.
- **Obsidian-style `[[wikilinks]]`.** Using standard relative markdown links (`../npcs/bob.md`) instead so files remain readable as rendered markdown in any viewer.
- **Separate YAML data files.** The source of truth for events is the markdown files themselves; config uses JSON.
- **Off-the-shelf Obsidian timeline plugins.** None support non-standard calendars or the aesthetic desired.
- **GitHub Pages read-only public hosting.** Deferred indefinitely as spoiler risk and not needed.

---

## 2. Goals and non-goals

### 2.1 Goals

- Fast text and date search while GMing live.
- Single horizontal timeline with tag-based filtering.
- Everything is git-friendly markdown/JSON so it's commitable, diffable, branchable.
- GM can write events during a session using the app or a plain editor, and both paths produce identical files.
- Calendar support accurate to Foundry VTT's Golarian calendar so in-game dates match what players see.
- Link between events, NPCs, factions, locations with relative markdown links.
- Runs locally via a single command in IntelliJ CE.

### 2.2 Non-goals (for v1)

- Public hosting of any kind.
- Multi-user editing or conflict resolution.
- Realtime collaboration.
- Spoiler hiding modes.
- Mobile-first UI (desktop-first, mobile is nice-to-have).
- Foundry VTT integration (may come later; just match Foundry's calendar rules).
- Swim lanes (explicitly rejected — tags filter, don't partition).

---

## 3. Key decisions with rationale

| Decision | Choice | Why |
|---|---|---|
| Data format for events | Markdown with YAML frontmatter | Conventional, IntelliJ highlights natively, minimal noise for 3–5 keys |
| Data format for config/state | JSON (`state.json`, `tags.json`, `sessions.json`) | Machine-edited, table-shaped, better for the webapp's persistence logic |
| Timelines | Tags on events; filters show/hide | Same event can belong to multiple threads without duplication |
| Axis | Single horizontal timeline, no swim lanes | Simplicity; vertical is used only for stacking overlapping events |
| Calendar | Golarian with Gregorian month lengths and leap rule | Matches Foundry VTT calendar in use |
| Weekday anchor | 4726-05-04 = Wealday | Verified against three other dates Laurie confirmed |
| Links | Relative markdown (`../npcs/bob.md`) | Renders in any markdown viewer, works without custom tooling |
| Tech stack | Vite + vanilla TypeScript, no framework | Small app, fast startup, IntelliJ has first-class Vite support |
| Sessions | Represented as a tag `session:YYYY-MM-DD` (real-world date) | Forces discipline; one system for everything |

---

## 4. Data model

### 4.1 Event file

One markdown file per event. Located under `events/`. Filename convention:

```
events/<in-game-date>-<slug>.md
```

Where `<in-game-date>` is the ISO-style date `YYYY-MM-DD` (month as number 01–12). Example:

```
events/4726-05-04-chess-puzzle.md
```

File contents:

```markdown
---
title: Chess puzzle encounter
date: 4726-05-04T09:30:00
tags: [plot:beast, location:fort, session:2025-11-08, gm-notes]
color: "#c43"         # optional — overrides tag-inherited color
status: happened      # optional — one of: happened | planned (default: inferred from date vs in_game_now)
---

Players faced the Rook Knight in the abandoned hall. [Fisty McPunchy](../npcs/fisty-mcpunchy.md) chose to fight rather than solve the puzzle, smashing three pawns before…
```

**Frontmatter fields:**

- `title` *(required)* — human-readable card header.
- `date` *(required)* — ISO-style with Golarian month numbers. Either `YYYY-MM-DD` (all-day) or `YYYY-MM-DDTHH[:MM[:SS]]`.
- `tags` *(optional, but effectively required)* — array of strings. Namespaced tags use `ns:value` form (`plot:beast`, `faction:asmodeus`, `npc:fisty`, `session:2025-11-08`). Bare tags are allowed (`gm-notes`, `foreshadowing`).
- `color` *(optional)* — hex color overriding the default tag-inherited color.
- `status` *(optional)* — only set manually when overriding the inferred status; otherwise derived from `date` vs `in_game_now`.

**Body:** any markdown. Relative links to other files in the repo are encouraged.

### 4.2 `state.json` — current campaign state

Located at repo root. Small, machine-edited, human-readable.

```json
{
  "in_game_now": "4726-05-04T18:30:00",
  "current_session": "2025-11-08",
  "campaign_start": "4726-03-01T00:00:00"
}
```

- `in_game_now`: controls which events render as "future" (dotted border) vs. "past". Updated via the app's "Advance time" UI.
- `current_session`: the session tag auto-applied to newly-created events. Set by "Start session" UI.
- `campaign_start`: used as the default left-edge of the timeline on first load.

### 4.3 `tags.json` — tag registry

Located at repo root.

```json
{
  "plot:beast": { "color": "#8b0000", "description": "Main antagonist arc" },
  "faction:asmodeus": { "color": "#6a0dad", "description": "" },
  "faction:abadar": { "color": "#d4af37", "description": "" },
  "faction:pharasma": { "color": "#5a5a8a", "description": "" },
  "session:2025-11-08": { "color": "#f5e6c8", "description": "" },
  "gm-notes": { "color": "#777777", "description": "Default GM-facing notes" },
  "foreshadowing": { "color": "#b87333", "description": "" }
}
```

When a new tag appears on an event, the app auto-creates an entry with a default palette color, which the GM can then edit.

### 4.4 `sessions.json` — session ledger

Append-only record of sessions, including real-world dates and in-game start times.

```json
[
  {
    "real_date": "2025-11-08",
    "in_game_start": "4726-05-04T09:00:00",
    "notes": "First session of the campaign. Chess puzzle encounter."
  },
  {
    "real_date": "2025-11-15",
    "in_game_start": "4726-05-04T18:30:00",
    "notes": ""
  }
]
```

### 4.5 Persistence and durability

The markdown-files-as-source-of-truth design only holds up if saves are genuinely durable. A webapp's default instincts (in-memory state, fire-and-forget writes) will lose content on crash. This section is the contract: never lose a save once the UI reports success; never lose more than a few seconds of in-progress typing even on hard crash.

#### 4.5.1 Atomic file writes (server)

Every write endpoint — events, `state.json`, `tags.json`, `sessions.json` — goes through a single helper:

```
writeFileAtomic(path, content):
  tempPath = path + '.tmp'
  write content to tempPath
  fsync(tempPath)                    // force data flush to disk
  rename(tempPath, path)             // atomic on POSIX and NTFS
  fsync(parent directory)            // persist the rename itself (POSIX; no-op on Windows)
```

Node's `fs.writeFile` does *not* fsync by default — must open with `fs.open`, write, then `fs.fsync` the handle explicitly. After this pattern, a crash at any instant leaves the file in either the old-complete or new-complete state. Never partial, never corrupt.

#### 4.5.2 Draft auto-save

While an editor modal is open, the frontend persists the current buffer to `events/.drafts/<filename>.md` every ~2 seconds of idle (debounced, not per-keystroke). Drafts:

- Live in a hidden `.drafts/` subfolder, gitignored.
- Are distinct files from the real event file — they never overwrite the real content.
- Are deleted on successful save or explicit discard.
- Survive crashes.

On modal open, the server checks for a draft matching the target filename with mtime newer than the real file. If present, UI shows a "Restore unsaved draft from HH:MM?" prompt with Restore / Discard draft / View both options.

#### 4.5.3 Save-state UI

The editor modal is always in exactly one of these states, visible to the user:

| State | Indicator | Save button | Behaviour |
|---|---|---|---|
| clean | no dot | disabled | nothing to save |
| dirty | dot next to title | enabled | unsaved changes exist |
| saving | spinner | disabled | request in flight |
| error | red banner with message + Retry | enabled | save failed; buffer preserved, modal stays open |
| saved | green check briefly | disabled | transient after success |

A failed save **never** closes the modal and **never** discards the buffer. A successful save transitions saving → saved → clean and then closes the modal on user confirmation (or after a brief auto-close).

`beforeunload` handler warns on tab close / navigation when in dirty or error state.

#### 4.5.4 Conflict detection (mtime-based)

- `GET /api/events/:filename` response includes `Last-Modified` header from the file's mtime.
- `PUT` and `DELETE` requests include `If-Unmodified-Since` with the mtime received on GET.
- Server compares against current mtime. Mismatch → 409 Conflict.
- Frontend on 409 shows a conflict modal: "This file changed while you were editing it." Options: **View current** (opens a read-only panel with current on-disk content), **Overwrite** (discards conflict, saves your version), **Cancel** (returns to editor with buffer intact).

Covers: two-tabs-open, IntelliJ-edit-while-modal-open, file-watcher-refresh-after-edit.

#### 4.5.5 Soft delete (trash)

- `DELETE /api/events/:filename` moves the file to `events/.trash/<timestamp>-<filename>.md` rather than `fs.unlink`.
- `.trash/` is gitignored.
- Toolbar Settings → "Trash" opens a small UI listing trashed events with Restore / Permanently delete per-entry and Empty all.
- Any accidental delete is recoverable without git archaeology.

#### 4.5.6 Manual git commit integration

- Toolbar button "Commit changes" opens a modal that:
  - Shows `git status --short` output (files about to commit).
  - Pre-fills a commit message like `timeline edits 2026-04-20` (editable).
  - On confirm: runs `git add -A && git commit -m "<message>"` via a `/api/git/commit` endpoint.
- Not auto-run. Recommended habit: hit it at end of each session, or any time you've done meaningful editing.

#### 4.5.7 Autosnapshot branch (opt-in paranoia layer)

- Disabled by default. Enable via a flag in `state.json`:
  ```json
  { "autosnapshot": { "enabled": true, "interval_minutes": 60 } }
  ```
- When enabled: every N minutes, if any files under tracked paths have changed, the server commits them to a dedicated `autosnapshots` branch with a timestamped message. Never touches `main` / working branch.
- Recovery: `git log autosnapshots` to browse; `git checkout autosnapshots -- events/foo.md` to restore a single file; or full reset with a merge or cherry-pick.
- Opt-in because it has footguns (branch churn, merge conflicts if mishandled). But cheap to add and cheap to ignore if not wanted.

#### 4.5.8 Recovery matrix

| Scenario | Outcome |
|---|---|
| Hit Save, got success response, crash 5 seconds later | File on disk, safe. Atomic write + fsync guarantees. |
| Hit Save, crash mid-write | File is either the old complete version or the new complete version. No corruption. |
| Typed for a minute without saving, crash | Most recent draft in `events/.drafts/` survives. Up to ~2s of typing may be lost. Prompt on next open. |
| Typed for hours, saved a few times, crash | All saved content safe. Only the post-last-save typing is vulnerable, and up to ~2s of that survives as draft. |
| Accidentally deleted an event | In `events/.trash/`, restorable from Settings → Trash. |
| Committed to git yesterday, disaster-edits today, want to roll back | `git reset --hard HEAD`. Standard git. |
| Hours of uncommitted work, want a snapshot without touching main | Autosnapshot branch (if enabled) or manual Commit changes button. |
| Edited same file in two tabs simultaneously | Second-to-save gets 409 conflict, sees current state, chooses merge strategy. No silent overwrite. |
| Edited in IntelliJ while modal open in browser | Same as above: 409 on save attempt. |

### 4.6 `palette.json` — theme and weekday colours

Centralises all colour choices in a single file at repo root. Swap the file, swap the aesthetic, no code change required.

```json
{
  "theme": {
    "background":       "#1a1a1a",
    "surface":          "#242420",
    "panel":            "#2d3d2a",
    "panel_accent":     "#3a4d35",
    "text_primary":     "#d8d0b8",
    "text_secondary":   "#a89a80",
    "text_muted":       "#7a6f58",
    "accent_gold":      "#c9a860",
    "accent_warm":      "#b87840",
    "link":             "#4fb8d0",
    "border":           "#3a3a30",
    "border_strong":    "#5a4530",
    "item_banner_from": "#5a2820",
    "item_banner_to":   "#7a4028",
    "session_band_a":   "#1d1d18",
    "session_band_b":   "#22221d",
    "dotted_future":    "#7a6f58"
  },
  "weekdays": {
    "moonday":  "#8da8c4",
    "toilday":  "#a07850",
    "wealday":  "#d4a850",
    "oathday":  "#5a8090",
    "fireday":  "#c06040",
    "starday":  "#7560a0",
    "sunday":   "#e5b860"
  }
}
```

**Aesthetic north star:** Archives of Nethys dark theme — near-black background, dark olive-green panels, warm earthy item banners (brown-red gradient), cream body text, gold accent text, sky-blue links. Familiar to anyone who's ever looked up a PF2e rule. Not coincidentally, this is the colour vocabulary the GM is already reading every session.

**Weekday colours:** inspired by each day's name semantics and tuned to pop against the dark background without being gaudy. Moonday = pale cold moon-blue (intentional contrast with the warm theme), Toilday = earth brown, Wealday = gold, Oathday = deep contract teal-blue, Fireday = fire red, Starday = deep night violet, Sunday = bright sun amber.

**Rules for colour use:**

- Event card header strip colour = `weekdays[weekday(date)]` unless `color:` in frontmatter overrides it.
- Event card body, borders, surface = theme colours.
- Session band alternates `session_band_a` / `session_band_b`.
- Future events (`date > in_game_now`) render their border as dotted in `theme.dotted_future` instead of solid weekday colour on the border (header strip keeps its weekday colour).
- Tag chips in the filter sidebar use tag colours from `tags.json` (unchanged from §4.3).

**Editing:** hand-edit `palette.json` in IntelliJ and the app reloads (file watcher). Or use the future Settings → Palette UI (deferred to polish pass).

---

## 5. Calendar specification

### 5.1 Months (Golarian)

| # | Name     | Days         | Earth equivalent |
|---|----------|--------------|------------------|
| 1 | Abadius  | 31           | January          |
| 2 | Calistril| 28 / 29 leap | February         |
| 3 | Pharast  | 31           | March            |
| 4 | Gozran   | 30           | April            |
| 5 | Desnus   | 31           | May              |
| 6 | Sarenith | 30           | June             |
| 7 | Erastus  | 31           | July             |
| 8 | Arodus   | 31           | August           |
| 9 | Rova     | 30           | September        |
| 10 | Lamashan| 31           | October          |
| 11 | Neth    | 30           | November         |
| 12 | Kuthona | 31           | December         |

### 5.2 Leap year rule

Same as Gregorian: year is leap if divisible by 4, except centuries not divisible by 400. So 4728 is leap (divisible by 4, not a century), 4700 is leap (divisible by 400), 4800 is leap, 4900 is *not* leap (divisible by 100, not 400).

### 5.3 Weekdays

Seven-day week: **Moonday, Toilday, Wealday, Oathday, Fireday, Starday, Sunday**.

### 5.4 Anchor

**4726-05-04 is Wealday.** All other weekday calculations derive from this by `(days_between_target_and_anchor mod 7)`.

### 5.5 Internal representation

Dates are stored in event frontmatter as human-readable ISO strings (`YYYY-MM-DDTHH:MM:SS`). Internally (in memory), convert to an absolute integer:

```
absolute_seconds = days_since_epoch * 86400 + (hours * 3600) + (minutes * 60) + seconds
days_since_epoch = (sum of complete years' days up to year start) + (sum of complete months up to month start) + (day - 1)
```

Epoch = year 0 AR, day 1 of Abadius, 00:00:00. Whether "year 0 AR" is valid in Paizo lore doesn't matter; it's just our zero.

### 5.6 Display formats

Per-card (expanded): **"Wealday, 4th of Desnus, 4726 AR — 18:30"**
Per-card (collapsed date chip): **"Wed 4 Desnus 4726"**
Axis major tick (day resolution): **"4 Desnus"**
Axis minor tick (zoomed in, hour resolution): **"09:00"**
Floating header (day): **"Desnus 3rd, Wealday, 4726 AR"**
Floating header (month): **"Desnus 4726 AR"**

### 5.7 Precision handling

- Date-only (`2026-05-04`): renders as an "all-day" bar spanning the full day.
- Date + hour: point event at that hour mark.
- Date + minute / second: point event at exact moment.
- Month-only (`2026-05`): renders as a bar spanning the full month. (Low priority; enable only if useful during migration.)

### 5.8 Unit test cases (MUST pass)

| Input date | Expected weekday | Days from anchor | mod 7 |
|---|---|---|---|
| 4726-05-04 | Wealday (Wed) | 0 | 0 |
| 4726-10-28 | Starday... wait no, **Friday** | 177 | 2 |
| 4727-04-16 | Sunday | 347 | 4 |
| 4728-02-29 | Oathday (Thursday) | 666 | 1 |

(Weekday index: Moonday=0, Toilday=1, Wealday=2, Oathday=3, Fireday=4, Starday=5, Sunday=6. Wealday is day 2; add mod-7 offset to get target.)

Additional edge cases to test:
- Date exactly at year boundary (`4726-12-31` → `4727-01-01`)
- Date on Feb 29 of non-leap year should fail validation
- `4700-02-29` should succeed (divisible by 400)
- `4800-02-29` should succeed
- `4900-02-29` should fail (divisible by 100, not 400)

---

## 6. UI specification

### 6.1 Overall layout

```
+--------------------------------------------------------------------+
| Toolbar:  [Now] [Advance Time] [Start Session] [Search] [+ Event]  |
+--------+-----------------------------------------------------------+
|        |                                                           |
| Tag    |   Session: 2025-11-08  (full-height shaded background)    |
| Filter |                                                           |
| Panel  |      [Card]                                               |
|        |                          [Card]                           |
|        |                                    [Card]                 |
|        |                                                           |
|        |   ────●───────────●──────────●──────────●──────────       |
|        |   4 Desnus   5 Desnus    6 Desnus   7 Desnus              |
|        |                                                           |
|        |                                                           |
+--------+-----------------------------------------------------------+
```

### 6.2 Timeline axis

- Single horizontal line ~60% down the viewport.
- Date ticks below the line.
- **Floating headers** on the left edge: when the current month/day is off-screen, stick its label to the left edge. Two levels (month + day) gives orientation at any zoom.
- **"Now" marker**: vertical line at `state.in_game_now`, labelled. Clicking "Now" in toolbar re-centres the view on it.
- Zoom: scroll wheel zooms about the cursor. `+`/`-` keys zoom about current centre. One day can be as wide as needed (1000px, 10000px, doesn't matter).
- Pan: click-drag on empty axis area; arrow keys for fine pan.
- Home key or "Now" button: jump to `in_game_now`.

### 6.3 Event cards

**Collapsed state:**
- Single line with title + date chip + up to 3 tag chips (overflow: "+N").
- **Header strip** (top edge of card) is coloured per `palette.weekdays[weekday(date)]` (§4.6). Override via `color:` in event frontmatter.
- Card body/surface uses `theme.surface`; title uses `theme.text_primary`.
- Connector line drops from card bottom to the card's datetime on the axis, coloured `theme.border_strong`.
- Width auto-fits the title (headers are always one line, never truncated).

**Expanded state (modal overlay, not inline):**
- Larger panel with title, full tag list, date + weekday, rendered markdown body.
- Header strip colour matches the collapsed state (weekday-derived).
- Action buttons: Edit, Delete, Close (Esc key closes).
- Delete requires confirmation.

**Future events** (`date > in_game_now`): card border rendered dotted in `theme.dotted_future`. Header strip still shows the weekday colour (so you can see week rhythm at a glance even for planned events).
**Past events**: solid border in `theme.border`.
**Status=planned** override: always dotted regardless of date.

**Weekday colour cycle rationale:** because every event has a date and every date has a weekday, card header colours cycle through the seven palette entries in a predictable rhythm as you pan. Zoomed-out views show repeating colour patterns that make week boundaries visible even when day labels become illegible. Pattern recognition builds over sessions: "the gold ones are Wealdays" becomes ambient knowledge.

### 6.4 Stacking rule for overlapping events

When two cards would occupy the same x-range (either same datetime or visually adjacent at current zoom):

- Stack vertically above the axis, newest-created on top.
- Subtle vertical "tie" bracket on the left of the stack showing they share a moment.
- Only one expanded at a time.

### 6.5 Density collapse (v2 iteration, not v1)

When many cards cluster at a zoom level such that their headers would visually collide, replace the cluster with a single "N events" summary card. Click to either (a) zoom in automatically to that cluster or (b) expand inline to a list picker. Thresholds determined iteratively once there's real data.

### 6.6 Session shading

- Full-height background colour covering the x-range from the session's earliest-tagged event to its latest.
- Alternating two colours between adjacent sessions.
- Session label in top-left of its region: "Session: 2025-11-08".
- Click the label or the shaded area → filter to just that session.

### 6.7 Tag filter panel

Left sidebar. Groups tags by namespace:

```
▼ Plots
  ☑ plot:beast                (colour swatch)
  ☑ plot:twin-thorns          (colour swatch)
▼ Factions
  ☑ faction:abadar
  ☑ faction:asmodeus
▼ Sessions
  ☑ session:2025-11-08
  ☑ session:2025-11-15
▼ Other
  ☑ gm-notes
  ☑ foreshadowing

[Clear filters] [Select none]
```

- Checkbox toggles inclusion.
- Click tag name to edit tag metadata (colour, description).
- Search box at top filters the tag list itself for when the list grows large.

**Date range filter** (above the tag groups):

```
▾ Date range
  From: [4726-03-01]  (in-game)
  To:   [4726-05-04]  (in-game)
  Preset: [All time ▾]
```

- Filters events whose `date` falls within the range (inclusive).
- Presets: "All time", "Campaign-start to now", "This in-game month", "This in-game week", "Last 30 in-game days", "Since last session start". Custom keeps whatever you typed.
- Date is a frontmatter **property**, not a tag, which is why range filtering works naturally. Filtering by a single date is just a range of one day.
- Date range filter combines with tag filters via logical AND (both must match for an event to show).
- Clears when "Clear filters" is pressed.

### 6.8 Search and jump

- Toolbar search button or `Ctrl+F` opens a search overlay.
- Searches across event titles, bodies, and tags. Also accepts date strings (`4726-05-04` or partial like `desnus`).
- Results list with snippets.
- Click a result: scroll + centre timeline on that event, highlight it briefly. Do NOT change current filters. Do NOT change tag panel state.

### 6.9 Add / edit event modal

- Title field.
- Date picker: date + time inputs with Golarian month selector.
- Tag input: type to autocomplete against existing tags, `Enter` adds, `Backspace` removes last.
- Color field: optional hex input with swatch preview.
- Body: markdown textarea with live preview alongside.
- Save button: writes file to `events/` with conventional filename using atomic write (§4.5.1). Shows save-state UI per §4.5.3.
- Discard button: confirm modal ("You have unsaved changes — discard?"). Esc key behaves the same. On confirmed discard, any draft for this file is deleted (§4.5.2).
- **Draft auto-save**: while modal is open, buffer is persisted to `.drafts/` every ~2s of idle typing (§4.5.2).
- **Draft restore prompt**: on modal open, if a newer draft exists for the target file, shows a "Restore unsaved draft from HH:MM?" prompt with Restore / Discard draft / View both options.
- **Conflict handling**: save receiving 409 opens a conflict modal (§4.5.4) with View current / Overwrite / Cancel.
- **beforeunload guard**: tab close / navigation warns if buffer is dirty.

### 6.10 Smart link autocomplete (in body editor)

- Typing `[[` triggers a fuzzy-search dropdown over all `.md` files in the repo (events, NPCs, factions, locations, plots, sessions).
- Each result row: icon by type, title (from frontmatter or first `#` heading), relative path (dimmed).
- Enter/Tab inserts a **standard markdown link** `[Title](relative/path.md)` computed from the current file's intended location.
- Esc dismisses the dropdown.
- Fuzzy matching via `fuse.js` or similar.

### 6.11 "Advance Time" toolbar action

- Opens a small popover.
- Options: +1 hour, +6 hours, +1 day, +1 week; or direct date/time input.
- Updates `state.in_game_now` on save.

### 6.12 "Start Session" toolbar action

- Prompts for real-world date (defaults to today, editable).
- Optional: in-game start date (defaults to `state.in_game_now`).
- Appends a row to `sessions.json`.
- Sets `state.current_session` to the real-world date.
- All subsequent "+ Event" creations auto-include `session:<that-date>` tag.

### 6.13 "Commit changes" toolbar action

- Button with a small badge showing number of uncommitted changes (from `/api/git/status`).
- Click opens modal with `git status --short` output, pre-filled message `timeline edits YYYY-MM-DD`, Commit / Cancel buttons.
- On confirm: calls `/api/git/commit`. On success: badge clears, brief confirmation toast.
- See §4.5.6.

### 6.14 Settings → Trash

- Settings panel (gear icon) has a Trash section listing entries in `events/.trash/`.
- Each row: original filename, timestamp trashed, Restore / Permanently delete buttons.
- Empty all button at the bottom with confirmation.
- See §4.5.5.

---

## 7. Tech stack

- **Runtime:** Node 20+.
- **Build:** Vite.
- **Language:** TypeScript (strict mode).
- **UI framework:** none — vanilla TS + DOM APIs.
- **Markdown parsing:** `markdown-it` (frontmatter via `markdown-it-front-matter` or `gray-matter` pre-pass).
- **Fuzzy search:** `fuse.js`.
- **File IO:** Vite dev server middleware exposes `/api/*` endpoints that read/write the repo filesystem directly.
- **State:** in-memory on the frontend; all persistence is files on disk via the durability contract in §4.5.
- **Testing:** `vitest` for unit tests (especially calendar math).
- **No DB, no auth, no backend process other than Vite's dev server.**

### 7.1 Vite API middleware endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/events` | List all events with parsed frontmatter |
| GET | `/api/events/:filename` | Get one event's full content |
| POST | `/api/events` | Create event (body: frontmatter + markdown) |
| PUT | `/api/events/:filename` | Update event |
| DELETE | `/api/events/:filename` | Delete event |
| GET | `/api/state` | Read `state.json` |
| PUT | `/api/state` | Write `state.json` |
| GET | `/api/tags` | Read `tags.json` |
| PUT | `/api/tags` | Write `tags.json` |
| GET | `/api/palette` | Read `palette.json` |
| PUT | `/api/palette` | Write `palette.json` |
| GET | `/api/sessions` | Read `sessions.json` |
| POST | `/api/sessions` | Append a new session to `sessions.json` |
| GET | `/api/link-index` | Return index of all `.md` files for link autocomplete: `{ path, title, type }[]` |
| GET | `/api/drafts/:filename` | Fetch draft if one exists (for editor modal restore prompt) |
| PUT | `/api/drafts/:filename` | Write/update a draft (called on idle debounce from editor) |
| DELETE | `/api/drafts/:filename` | Clear a draft (on save success or confirmed discard) |
| GET | `/api/trash` | List trashed events |
| POST | `/api/trash/:filename/restore` | Restore a trashed event |
| DELETE | `/api/trash/:filename` | Permanently delete a trashed event |
| DELETE | `/api/trash` | Empty trash |
| GET | `/api/git/status` | Return `git status --short` output for the commit modal |
| POST | `/api/git/commit` | Run `git add -A && git commit -m <message>` |

All write endpoints use the `writeFileAtomic` helper (§4.5.1). All event GET responses include `Last-Modified` header; PUT/DELETE require `If-Unmodified-Since` for mtime conflict detection (§4.5.4).

### 7.2 File watching (optional v2)

Use `chokidar` to watch `events/` and `*.json`. Emit via server-sent events so the frontend auto-refreshes when files change outside the app (e.g., GM edits in IntelliJ).

---

## 8. Project structure

```
last-gasp/
├── README.md                    # human entry point, links to this plan
├── PLAN.md                      # THIS FILE
├── state.json                   # { in_game_now, current_session, campaign_start }
├── tags.json                    # tag registry with colours
├── sessions.json                # session ledger
├── palette.json                 # theme + weekday colour palette (Nethys-inspired dark default)
│
├── .gitignore                   # ignores events/.drafts/, events/.trash/, app/node_modules, etc.
│
├── events/                      # one file per event
│   ├── 4726-03-01-campaign-start.md
│   ├── 4726-05-04-chess-puzzle.md
│   ├── ...
│   ├── .drafts/                 # (gitignored) in-progress editor buffers, auto-saved every ~2s
│   └── .trash/                  # (gitignored) soft-deleted events, recoverable via Settings → Trash
│
├── sessions/                    # long-form session recaps (optional, separate from `sessions.json`)
│   └── 2025-11-08-recap.md
│
├── factions/
│   ├── README.md                # faction matrix / index
│   ├── abadar.md
│   ├── asmodeus.md
│   ├── pharasma.md
│   ├── free-sails.md
│   ├── smokers.md
│   └── ancients.md
│
├── npcs/
│   ├── README.md                # NPC index with tags
│   ├── hargrim-stonehelm.md
│   ├── thrax-lightwish.md
│   └── ...
│
├── locations/
│   ├── stormhaven.md
│   ├── emberheart-island.md
│   ├── the-fort.md
│   ├── the-boat.md
│   ├── the-quarry.md
│   └── low-security-prison.md
│
├── plots/
│   ├── beast-and-ancients.md
│   ├── twin-thorns-investigation.md
│   ├── quarry-portal.md
│   ├── abadar-conflict.md
│   ├── pharasma-sponsorship.md
│   ├── fort.md
│   └── boat.md
│
├── rules/
│   ├── house-rules.md
│   ├── hexcrawl.md
│   └── optional-rules.md
│
├── player-facing/
│   ├── player-guide.md
│   └── calendar.md
│
├── misc/
│   └── ideas.md
│
└── app/                         # the webapp itself
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts           # includes API middleware
    ├── index.html
    ├── src/
    │   ├── main.ts              # entry point
    │   ├── calendar/
    │   │   ├── golarian.ts      # month lengths, leap logic, weekday calc
    │   │   ├── format.ts        # display formatters
    │   │   └── calendar.test.ts # unit tests (incl. the 3 anchor dates)
    │   ├── data/
    │   │   ├── api.ts           # fetch wrappers
    │   │   ├── types.ts         # Event, Tag, State, Session types
    │   │   └── parse.ts         # frontmatter parsing
    │   ├── timeline/
    │   │   ├── axis.ts          # horizontal axis rendering + floating headers
    │   │   ├── card.ts          # card rendering (collapsed/expanded)
    │   │   ├── session-band.ts  # session shading
    │   │   ├── zoom.ts          # zoom/pan math
    │   │   └── layout.ts        # stacking + density collapse (v2)
    │   ├── panels/
    │   │   ├── filters.ts       # tag filter sidebar
    │   │   ├── search.ts        # search overlay
    │   │   └── toolbar.ts       # Now / Advance / Session / Add
    │   ├── editor/
    │   │   ├── modal.ts         # event add/edit modal with save-state UI
    │   │   ├── drafts.ts        # client-side draft auto-save (debounced)
    │   │   ├── conflict.ts      # 409 conflict modal
    │   │   └── link-picker.ts   # [[ autocomplete
    │   └── styles/
    │       └── app.css
    └── server/
        ├── api.ts               # Vite middleware implementation
        ├── fs-atomic.ts         # writeFileAtomic helper (write-temp → fsync → rename → fsync-dir)
        ├── mtime.ts             # Last-Modified / If-Unmodified-Since handling
        ├── trash.ts             # soft-delete endpoints
        ├── drafts.ts            # draft storage endpoints
        └── git.ts               # git status + commit endpoints (and optional autosnapshot loop)
```

**Root-level IntelliJ run config:** `npm run dev` from `app/` directory. This is what the play button triggers.

---

## 9. Implementation phases

Each phase has a definition of done. Phases can be paused mid-flight; nothing below depends on fully polished state in a prior phase.

### Phase 1 — Repo skeleton

**Goal:** directory structure exists, empty placeholder files present, Git-committable.

**Deliverables:**
- Create all folders listed in §8.
- Create `README.md` with a one-paragraph overview and links to this plan.
- Create empty `state.json` with placeholder values using the known starting state:
  ```json
  { "in_game_now": "4726-05-04T18:30:00", "current_session": null, "campaign_start": "4726-03-01T00:00:00" }
  ```
- Create empty `tags.json` with the handful of namespace examples.
- Create empty `sessions.json` as `[]`.
- Create `palette.json` seeded with the Nethys-inspired theme + weekday palette from §4.6.
- Create three example event files in `events/` covering different shapes (date-only, datetime, multi-tag).
- Create stub READMEs in each subfolder.
- Create `.gitignore` at repo root with at minimum:
  ```
  # editor scratch — contents ignored; server creates folders on demand
  events/.drafts/
  events/.trash/
  # node
  app/node_modules/
  app/dist/
  # IDE
  .idea/
  .vscode/
  ```
- Server's startup code (Phase 4) is responsible for `mkdir -p events/.drafts events/.trash` if they don't exist. No need to track the empty directories in git.

**Done when:** `git status` looks clean, skeleton renders correctly in IntelliJ's file browser.

### Phase 2 — Vite + TypeScript scaffold

**Goal:** dev server starts, renders a "Hello Timeline" page, IntelliJ play button works.

**Deliverables:**
- `cd app && npm init`
- Install: `vite`, `typescript`, `vitest`, `markdown-it`, `gray-matter`, `fuse.js`, `chokidar`, `@types/node`.
- `vite.config.ts` with a `configureServer` hook registering API routes (empty for now, add endpoints as phases need them).
- `index.html` + `src/main.ts` rendering a blank page with a placeholder heading.
- `tsconfig.json` with strict mode and `"moduleResolution": "bundler"`.
- Add `npm run dev`, `npm run build`, `npm test` scripts.
- Set up an IntelliJ CE **npm Run Configuration** named "Timeline Dev" that runs `dev` in `app/`.

**Done when:** Play button opens browser to `http://localhost:5173` with the placeholder page.

### Phase 3 — Calendar module + tests

**Goal:** rock-solid Golarian calendar math before any UI depends on it.

**Deliverables:**
- `src/calendar/golarian.ts` with:
  - `MONTHS` array (name, days-normal, days-leap).
  - `WEEKDAYS` array.
  - `isLeap(year: number): boolean`.
  - `daysInMonth(year, month): number`.
  - `daysInYear(year): number`.
  - `toAbsoluteDays(date): number` (days since epoch 0-01-01).
  - `fromAbsoluteDays(days): GolarianDate`.
  - `weekday(date): Weekday` (using 4726-05-04 = Wealday anchor).
  - `parseISOString(s): GolarianDate` (handles `YYYY-MM-DD` through `YYYY-MM-DDTHH:MM:SS`).
  - `toISOString(date): string`.
- `src/calendar/format.ts` with display formatters (§5.6).
- `src/calendar/calendar.test.ts` with:
  - The three anchor weekday tests from §5.8.
  - Year boundary tests.
  - Leap year edge cases (4700, 4728, 4800, 4900).
  - Round-trip parse/format tests.

**Done when:** `npm test` passes all calendar tests.

### Phase 4 — Data layer + API middleware

**Goal:** backend can list, read, create, update, delete events; frontend can fetch them; writes are durable.

**Deliverables:**
- `server/api.ts` implementing all §7.1 endpoints for events, state, tags, sessions, link-index, palette.
- `server/fs-atomic.ts` with `writeFileAtomic(path, content)` helper per §4.5.1. All write endpoints route through it.
- All event GET responses include `Last-Modified` header; PUT/DELETE honour `If-Unmodified-Since` and return 409 on mismatch (§4.5.4).
- `src/data/types.ts` with TypeScript interfaces.
- `src/data/parse.ts` wrapping `gray-matter` for frontmatter handling.
- `src/data/api.ts` with fetch-wrapper helpers; save calls include `If-Unmodified-Since` and handle 409.
- Vitest integration tests for the durability contract:
  - `writeFileAtomic` round-trip
  - Write then simulated crash (kill after `writeFile` before `rename`) leaves old file intact
  - 409 returned when mtime does not match
- Manual smoke-test via browser console: `fetch('/api/events').then(r => r.json()).then(console.log)` returns the three seeded events with `Last-Modified` headers.

**Done when:** CRUD works from browser console; atomic-write tests pass; conflict detection returns 409 on mtime mismatch.

### Phase 5 — Minimal timeline rendering

**Goal:** see the three seeded events on a horizontal axis with zoom + pan.

**Deliverables:**
- `src/timeline/axis.ts` rendering a horizontal line with date tick marks.
- Floating header showing current month/day at left edge when scrolled.
- `src/timeline/zoom.ts` with pan + zoom (scroll wheel, click-drag).
- `src/timeline/card.ts` rendering collapsed cards anchored to their datetime with a connector line.
- `src/theme.ts` loading `palette.json` on startup and exposing theme + weekday helpers (`weekdayColor(date)`, `themeColor(key)`). CSS custom properties set from palette so styling is data-driven.
- Card header strip uses `weekdayColor(date)` from §4.6. Theme colours wired for background, text, borders, surfaces.
- No filtering, no editing, no sessions yet — just view.

**Done when:** seeded events render correctly with Nethys dark theme, weekday-coloured header strips, panning/zooming feels natural, floating headers work.

### Phase 6 — Expand / collapse + session shading

**Deliverables:**
- Click a card → open expanded modal with rendered markdown body.
- Esc or X closes modal.
- Dotted border for `date > in_game_now` events.
- `src/timeline/session-band.ts` renders full-height alternating-colour shading for each session based on its earliest/latest tagged event.
- Session label in top-left of each shaded region.

**Done when:** clicking a card opens rich view; sessions visually distinct.

### Phase 7 — Tag filter sidebar + search + jump

**Deliverables:**
- Left sidebar lists all tags, grouped by namespace.
- Checkbox filters hide non-matching events.
- `src/panels/search.ts` with Ctrl+F overlay, fuzzy search across title/body/tags/date.
- Click result → scroll and centre timeline on the event without altering filters.

**Done when:** filtering hides events live, search finds and jumps correctly.

### Phase 8 — Event editor modal + durability UI

**Deliverables:**
- "+ Event" toolbar button opens the modal in create mode.
- "Edit" button on an expanded card opens it in edit mode.
- "Delete" with confirm. Delete is a soft-delete — moves to `events/.trash/` (§4.5.5).
- Save writes via API using atomic write pattern, refreshes list.
- Discard with confirm.
- Tag input with autocomplete.
- Markdown textarea with live preview.
- **Durability features (§4.5.2–§4.5.5):**
  - Draft auto-save every ~2s of idle typing to `/api/drafts/:filename`.
  - Draft restore prompt on modal open when a newer draft exists.
  - Save-state UI (clean / dirty / saving / error / saved) per §4.5.3.
  - Error state preserves buffer and offers Retry; never silently discards content.
  - Conflict modal on 409: View current / Overwrite / Cancel (§4.5.4).
  - `beforeunload` handler warns on tab close while dirty.
  - `/api/drafts/:filename` and `/api/trash/*` endpoints from §7.1 are wired up here.

**Done when:** full CRUD achievable from the UI without touching files directly; killing the browser mid-edit and reopening prompts to restore the draft; deleting an event is recoverable via Settings → Trash.

### Phase 9 — Smart link autocomplete

**Deliverables:**
- `/api/link-index` endpoint scans `**/*.md`, extracts title from frontmatter or first `#`, returns typed list.
- `src/editor/link-picker.ts` hooks `[[` in the textarea, shows dropdown, fuzzy-matches as you type, inserts relative `[Title](path.md)` on Enter.

**Done when:** typing `[[fist` mid-session finds `fisty-mcpunchy.md` and inserts the right link.

### Phase 10 — Advance Time + Start Session controls

**Deliverables:**
- `Advance Time` popover with +1h / +6h / +1d / +1w quick buttons plus manual date/time input. Writes `state.json`.
- `Start Session` popover prompts for real-world date (default today) + in-game start time (default `in_game_now`). Appends to `sessions.json`, sets `state.current_session`.
- New events auto-tagged with `session:<current_session>`.

**Done when:** session workflow works end-to-end in a dry run.

### Phase 11 — Polish pass + git integration

**Deliverables:**
- Finalise colour palette, typography, spacing.
- Aesthetic polish (TBD — see Open Question 1 below).
- Accessibility pass (keyboard navigation, focus states).
- Small-viewport behaviour check.
- **Commit changes toolbar action (§4.5.6, §6.13):** badge showing uncommitted file count, modal with `git status --short` preview and editable commit message, `/api/git/commit` endpoint.
- **Settings → Trash UI (§4.5.5, §6.14):** list trashed events, Restore / Permanently delete / Empty all.
- **Optional: autosnapshot branch (§4.5.7)** — opt-in flag in `state.json`. If enabled, a background timer commits changes to a dedicated `autosnapshots` branch every N minutes. Not on by default.

**Done when:** looks good enough to spend hours staring at while GMing; committing session work takes one button press; trash recovery works; autosnapshot (if enabled) is producing commits without interfering with main branch work.

### Phase 12 — Migration: Running Notes

**Deliverables:**
- Incremental parse of the Google Doc's Running Notes tab into event files.
- Work session-by-session, GM reviews each batch, iterate on tagging conventions.
- Populate `factions/*.md`, `npcs/*.md`, `locations/*.md` with minimal stubs (just so links resolve) as references come up during migration.

**Done when:** all existing session content is represented as event files, all referenced NPCs/factions/locations have at least stub markdown files.

### Phase 13 — Density collapse (post-migration)

**Deliverables:**
- Implement "N events" cluster cards when card headers would visually collide.
- Iterate threshold against real data.
- Handle click behaviour (zoom vs. inline expand).

**Done when:** zoomed-out view of the full timeline is readable without hundreds of colliding cards.

---

## 10. Migration plan — Google Doc to repo

Source: `The Last Gasp of Civilisation` Google Doc (id `1bU6jgwIQEjMUmmZJ4wG0PUEk1VGPOurUkHaW-z2pdbo`). Profiled content:

- **Running Notes tab** — primary source for event files. Uses `# Session N → ## Day X - Date → ### Encounter Name` structure. Migrate session by session, earliest first (campaign started 1st of Pharast 4726).
- **Factions tab** — static reference. Split into one file per faction under `factions/`. Do this *before* Running Notes migration so events can link to faction files.
- **NPCs tab** — split into one file per NPC under `npcs/`. Same reason as factions.
- **Ideas, Chess Puzzle, Low Security Prison, Notes tabs** — move to `misc/` or appropriate sub-folder as appropriate. Low priority.
- **Player Guide tab** — single file at `player-facing/player-guide.md`.
- **Rituals and Events tab** — `player-facing/calendar.md` (festivals) + `rules/rituals.md` (mechanics) split.
- **Campaign Arc: Twin Thorns Investigation tab** — `plots/twin-thorns-investigation.md`.
- **Characters tab** — `player-facing/characters.md`.

**Migration mechanics:** the Google Drive MCP tool `read_file_content` returns ~150KB of text (no images). We pull sections via grep on cached content, hand-convert to markdown preserving structure, verify with Laurie, commit. Not a one-shot script — interactive review per batch.

**Tagging conventions during migration:**

- `session:<real-world-date>` on every event if known; else omit and backfill later.
- `plot:<plot-slug>` for every plot thread involved.
- `faction:<faction-slug>` for every faction meaningfully present.
- `location:<location-slug>` for the primary location.
- `npc:<name>` for the 1–3 most-relevant NPCs; not every walk-on.
- `gm-notes` on everything from running notes, unless it's clearly a player-facing recap.
- `foreshadowing` on any events seeded ahead of `in_game_now` for later payoff.

---

## 11. Testing strategy

- **Calendar math:** full `vitest` coverage of the formulas in §5, anchored by the three confirmed weekday test cases.
- **API endpoints:** light integration tests — create, read, update, delete an event, assert file content round-trips.
- **Durability contract (§4.5):**
  - `writeFileAtomic` round-trip integrity.
  - Simulated crash: kill process between temp-write and rename; verify old file intact.
  - Simulated crash: kill between rename and dir-fsync; verify new file is on disk.
  - 409 returned when `If-Unmodified-Since` doesn't match.
  - Draft write then simulated kill → draft persists and is readable.
  - Soft-delete → restore round-trip.
- **Frontmatter parsing:** unit tests for edge cases (missing fields, malformed tags, etc.).
- **UI:** no automated tests for v1; manual regression pass before polishing. One manual regression scenario to script: "open editor, type for a minute, kill the browser tab, reopen → draft restore prompt appears."
- **Migration:** each migrated session reviewed by GM before commit.

---

## 12. Open questions / decisions deferred

1. **Aesthetic north star.** Specific visual vibe (colour palette, typography, density) is unspecified. Proposal: defer to Phase 11 polish pass, do earlier phases with clean-utilitarian defaults (neutral greys, one accent colour, system font). GM to provide reference images or "this screenshot is the vibe" input before Phase 11.
2. **Default Golarian-date display format.** Long-form ("Wealday, 4th of Desnus, 4726 AR") is locked in for expanded cards and floating headers. Compact format for chips/axis ticks is drafted but may want tuning once it's on screen.
3. **File watcher (chokidar + SSE) for live-reload when editing in IntelliJ.** Nice-to-have for Phase 11.
4. **Density collapse thresholds.** Iterate in Phase 13 with real data.
5. **`sessions/*.md` long-form recaps.** Folder exists but their relationship to event files is flexible — a recap can link to its events; events don't need to know about recaps. Revisit after first session is migrated.
6. **Multi-event stacking UX.** Proposed: vertical stack with tie bracket. Validate with real overlapping data in Phase 12.
7. **Color-picker UI for tag colours.** Simple hex input in v1; visual picker in later polish.
8. **PF2e Team+ / Remaster content tags.** Separate from timeline concerns — may want a `#homebrew` or `#team+` marker in rules files. Out of scope for timeline app itself.

---

## 13. How to resume this work

Anyone (LLM or human) picking this up:

1. Read this file end to end.
2. Check `state.json` for current in-game date and session.
3. Check git log for the latest completed phase.
4. Pick up at the next phase's deliverables in §9.
5. Don't re-litigate decisions in §3 without explicit GM sign-off.
6. When in doubt about calendar math, consult §5 and run the tests in `app/src/calendar/calendar.test.ts`.
7. When in doubt about the save path, persistence, drafts, conflict handling, trash, or anything that touches "could the GM lose content", consult §4.5. The durability contract is load-bearing and any change to it needs deliberate sign-off, not incremental drift.
8. Any new write endpoint added later must go through `writeFileAtomic` (§4.5.1). No direct `fs.writeFile` on real data files.

Questions for the GM should surface in chat, not as file changes.

---

**End of plan.**
