import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import http from 'http';
import { AddressInfo } from 'net';
import { createApi } from './api.ts';

let tempRepo: string;
let server: http.Server;
let baseUrl: string;

async function seedRepo(root: string) {
  await fs.mkdir(join(root, 'events'), { recursive: true });
  await fs.mkdir(join(root, 'npcs'), { recursive: true });
  await fs.mkdir(join(root, 'factions'), { recursive: true });

  await fs.writeFile(
    join(root, 'state.json'),
    JSON.stringify({
      in_game_now: '4726-05-04T18:30:00',
      current_session: null,
      campaign_start: '4726-03-01T00:00:00',
    }, null, 2)
  );

  await fs.writeFile(
    join(root, 'tags.json'),
    JSON.stringify({
      'plot:beast': { color: '#8b0000', description: 'Beast plot' },
    }, null, 2)
  );

  await fs.writeFile(
    join(root, 'sessions.json'),
    JSON.stringify([], null, 2)
  );

  await fs.writeFile(
    join(root, 'palette.json'),
    JSON.stringify({
      theme: { background: '#1a1a1a', text_primary: '#d8d0b8' },
      weekdays: {
        monday: '#8da8c4', tuesday: '#a07850', wednesday: '#d4a850',
        thursday: '#5a8090', friday: '#c06040', saturday: '#7560a0', sunday: '#e5b860',
      },
    }, null, 2)
  );

  await fs.writeFile(
    join(root, 'events', '4726-05-04-chess-puzzle.md'),
    `---
title: Chess puzzle encounter
date: 4726-05-04T09:30:00
tags: [plot:beast, location:fort, session:2026-02-01]
---

Players faced the Rook Knight in the abandoned hall.
`
  );

  await fs.writeFile(
    join(root, 'events', '4726-03-01-campaign-start.md'),
    `---
title: Campaign start
date: 4726-03-01
tags: [gm-notes]
---

First day of the campaign.
`
  );

  await fs.writeFile(
    join(root, 'npcs', 'fisty-mcpunchy.md'),
    `---
title: Fisty McPunchy
---

Enthusiastic amateur brawler.
`
  );

  await fs.writeFile(
    join(root, 'party.md'),
    `# Player Characters\n\nCato, Casseus, Vittoria, Belwar, Frollo.\n`
  );
}

beforeEach(async () => {
  tempRepo = await fs.mkdtemp(join(tmpdir(), 'last-gasp-api-'));
  await seedRepo(tempRepo);

  const handler = createApi({ repoRoot: tempRepo });
  server = http.createServer(async (req, res) => {
    await handler(req as any, res);
  });
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await fs.rm(tempRepo, { recursive: true, force: true });
});

// ============ Events ============

describe('GET /api/events', () => {
  it('returns list of events with frontmatter', async () => {
    const res = await fetch(`${baseUrl}/api/events`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    const titles = body.map((e: any) => e.title).sort();
    expect(titles).toEqual(['Campaign start', 'Chess puzzle encounter']);
  });

  it('preserves date strings verbatim (no JS Date coercion)', async () => {
    const res = await fetch(`${baseUrl}/api/events`);
    const body = await res.json();
    const chess = body.find((e: any) => e.title === 'Chess puzzle encounter');
    expect(chess.date).toBe('4726-05-04T09:30:00');
    const start = body.find((e: any) => e.title === 'Campaign start');
    expect(start.date).toBe('4726-03-01');
  });

  it('returns empty list when events dir is empty', async () => {
    // Remove the seeded events
    for (const f of await fs.readdir(join(tempRepo, 'events'))) {
      const fp = join(tempRepo, 'events', f);
      const stat = await fs.stat(fp);
      if (stat.isFile()) await fs.unlink(fp);
    }
    const res = await fetch(`${baseUrl}/api/events`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('GET /api/events/:filename', () => {
  it('returns a single event with Last-Modified header', async () => {
    const res = await fetch(`${baseUrl}/api/events/4726-05-04-chess-puzzle.md`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Last-Modified')).toBeTruthy();
    const body = await res.json();
    expect(body.title).toBe('Chess puzzle encounter');
    expect(body.date).toBe('4726-05-04T09:30:00');
    expect(body.body.trim()).toContain('Rook Knight');
  });

  it('returns 404 for unknown filename', async () => {
    const res = await fetch(`${baseUrl}/api/events/no-such-event.md`);
    expect(res.status).toBe(404);
  });

  it('rejects filenames with path separators', async () => {
    const res = await fetch(`${baseUrl}/api/events/${encodeURIComponent('../secret.md')}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/events', () => {
  it('creates a new event', async () => {
    const res = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: '4726-05-05-new-day.md',
        frontmatter: { title: 'New day', date: '4726-05-05', tags: ['gm-notes'] },
        body: 'A fresh day.',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('New day');

    // File actually exists on disk with proper YAML frontmatter
    const content = await fs.readFile(join(tempRepo, 'events', '4726-05-05-new-day.md'), 'utf-8');
    expect(content).toContain('title: New day');
    expect(content).toContain('date: 4726-05-05');
    expect(content).toContain('A fresh day.');
  });

  it('refuses to overwrite an existing event', async () => {
    const res = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: '4726-05-04-chess-puzzle.md',
        frontmatter: { title: 'Conflict', date: '4726-05-04' },
        body: '',
      }),
    });
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/events/:filename', () => {
  it('updates when If-Unmodified-Since matches', async () => {
    const getRes = await fetch(`${baseUrl}/api/events/4726-05-04-chess-puzzle.md`);
    const lastMod = getRes.headers.get('Last-Modified')!;

    const putRes = await fetch(`${baseUrl}/api/events/4726-05-04-chess-puzzle.md`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'If-Unmodified-Since': lastMod,
      },
      body: JSON.stringify({
        frontmatter: { title: 'Chess puzzle encounter (revised)', date: '4726-05-04T09:30:00', tags: ['plot:beast'] },
        body: 'The revised version of the encounter.',
      }),
    });
    expect(putRes.status).toBe(200);
    const body = await putRes.json();
    expect(body.title).toBe('Chess puzzle encounter (revised)');
  });

  it('returns 409 when If-Unmodified-Since is stale', async () => {
    const staleDate = new Date(Date.now() - 60_000).toUTCString();
    const res = await fetch(`${baseUrl}/api/events/4726-05-04-chess-puzzle.md`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'If-Unmodified-Since': staleDate,
      },
      body: JSON.stringify({
        frontmatter: { title: 'Whatever', date: '4726-05-04' },
        body: '',
      }),
    });
    expect(res.status).toBe(409);
  });

  it('allows update without If-Unmodified-Since (no check)', async () => {
    const res = await fetch(`${baseUrl}/api/events/4726-05-04-chess-puzzle.md`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frontmatter: { title: 'Force-updated', date: '4726-05-04' },
        body: '',
      }),
    });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/events/:filename', () => {
  it('soft-deletes to .trash/', async () => {
    const res = await fetch(`${baseUrl}/api/events/4726-05-04-chess-puzzle.md`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trashedAs).toMatch(/4726-05-04-chess-puzzle\.md$/);

    // Original file is gone
    await expect(fs.access(join(tempRepo, 'events', '4726-05-04-chess-puzzle.md'))).rejects.toThrow();
    // Trash contains it
    await expect(fs.access(join(tempRepo, 'events', '.trash', body.trashedAs))).resolves.toBeUndefined();
  });

  it('returns 409 on stale If-Unmodified-Since', async () => {
    const staleDate = new Date(Date.now() - 60_000).toUTCString();
    const res = await fetch(`${baseUrl}/api/events/4726-05-04-chess-puzzle.md`, {
      method: 'DELETE',
      headers: { 'If-Unmodified-Since': staleDate },
    });
    expect(res.status).toBe(409);
  });
});

// ============ Config files ============

describe('GET/PUT state, tags, palette', () => {
  it('GET /api/state returns seeded state', async () => {
    const res = await fetch(`${baseUrl}/api/state`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.in_game_now).toBe('4726-05-04T18:30:00');
  });

  it('PUT /api/state writes atomically', async () => {
    const res = await fetch(`${baseUrl}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        in_game_now: '4726-05-05T12:00:00',
        current_session: '2026-04-22',
        campaign_start: '4726-03-01T00:00:00',
      }),
    });
    expect(res.status).toBe(200);

    const content = await fs.readFile(join(tempRepo, 'state.json'), 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.in_game_now).toBe('4726-05-05T12:00:00');
    expect(parsed.current_session).toBe('2026-04-22');
  });

  it('GET /api/tags returns tags', async () => {
    const res = await fetch(`${baseUrl}/api/tags`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['plot:beast']).toBeDefined();
  });

  it('GET /api/palette returns palette', async () => {
    const res = await fetch(`${baseUrl}/api/palette`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weekdays.wednesday).toBe('#d4a850');
  });
});

describe('Sessions', () => {
  it('POST /api/sessions appends', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        real_date: '2026-04-22',
        in_game_start: '4726-05-04T18:30:00',
        notes: 'Test session',
      }),
    });
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list).toHaveLength(1);
    expect(list[0].real_date).toBe('2026-04-22');
  });
});

// ============ Link index ============

describe('GET /api/link-index', () => {
  it('lists all .md files with title + type', async () => {
    const res = await fetch(`${baseUrl}/api/link-index`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const titles = body.map((e: any) => e.title).sort();
    expect(titles).toContain('Chess puzzle encounter');
    expect(titles).toContain('Campaign start');
    expect(titles).toContain('Fisty McPunchy');
    expect(titles).toContain('Player Characters');

    const fisty = body.find((e: any) => e.title === 'Fisty McPunchy');
    expect(fisty.type).toBe('npc');
    expect(fisty.path).toBe('npcs/fisty-mcpunchy.md');
  });
});

// ============ File reader (hover-peek) ============

describe('GET /api/file/:path', () => {
  it('returns raw markdown content', async () => {
    const res = await fetch(`${baseUrl}/api/file/npcs/fisty-mcpunchy.md`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/markdown');
    expect(res.headers.get('Last-Modified')).toBeTruthy();
    const body = await res.text();
    expect(body).toContain('Enthusiastic amateur brawler');
  });

  it('rejects paths containing ..', async () => {
    const res = await fetch(`${baseUrl}/api/file/${encodeURIComponent('../outside.md')}`);
    expect(res.status).toBe(403);
  });

  it('rejects non-.md paths', async () => {
    const res = await fetch(`${baseUrl}/api/file/${encodeURIComponent('state.json')}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for missing file', async () => {
    const res = await fetch(`${baseUrl}/api/file/npcs/no-such-npc.md`);
    expect(res.status).toBe(404);
  });
});

// ============ Trash ============

describe('Trash workflow', () => {
  it('delete → list → restore round trip', async () => {
    const delRes = await fetch(`${baseUrl}/api/events/4726-05-04-chess-puzzle.md`, { method: 'DELETE' });
    const { trashedAs } = await delRes.json();

    const listRes = await fetch(`${baseUrl}/api/trash`);
    const list = await listRes.json();
    expect(list.some((e: any) => e.filename === trashedAs)).toBe(true);

    const restoreRes = await fetch(`${baseUrl}/api/trash/${encodeURIComponent(trashedAs)}/restore`, {
      method: 'POST',
    });
    expect(restoreRes.status).toBe(200);
    const restored = await restoreRes.json();
    expect(restored.restored).toBe('4726-05-04-chess-puzzle.md');

    await expect(fs.access(join(tempRepo, 'events', '4726-05-04-chess-puzzle.md'))).resolves.toBeUndefined();
  });

  it('DELETE /api/trash empties all', async () => {
    await fetch(`${baseUrl}/api/events/4726-05-04-chess-puzzle.md`, { method: 'DELETE' });
    await fetch(`${baseUrl}/api/events/4726-03-01-campaign-start.md`, { method: 'DELETE' });

    const res = await fetch(`${baseUrl}/api/trash`, { method: 'DELETE' });
    expect(res.status).toBe(200);

    const listRes = await fetch(`${baseUrl}/api/trash`);
    const list = await listRes.json();
    expect(list).toEqual([]);
  });
});

// ============ Unknown routes ============

describe('unknown routes', () => {
  it('returns 404 for unknown API path', async () => {
    const res = await fetch(`${baseUrl}/api/nope`);
    expect(res.status).toBe(404);
  });
});
