import { ipcMain, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';

import type {
  Event,
  EventFrontmatter,
  EventListItem,
  EventWithMtime,
  Session,
  State,
  TagsRegistry,
  Palette,
  ConflictResult,
} from '../renderer/timeline/data/types.js';

const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+\.md$/;

function assertSafeFilename(dir: string, filename: string): void {
  if (!SAFE_FILENAME_RE.test(filename)) {
    throw new Error(`Unsafe event filename: ${filename}`);
  }
  // Belt-and-suspenders: ensure the resolved path stays inside dir
  const resolved = path.resolve(path.join(dir, filename));
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error(`Path traversal detected for filename: ${filename}`);
  }
}

function eventsDir(campaignPath: string) {
  return path.join(campaignPath, 'events');
}

function fileMtime(filePath: string): string {
  // NOTE: mtime precision varies by filesystem (ext4: ms, FAT: 2s, APFS: ns).
  // Two saves within the same tick may produce the same mtime string, allowing a
  // silent clobber. For a single-user desktop app this is acceptable; a future
  // strengthening is to use a content hash (sha1) as the ETag instead.
  return fs.statSync(filePath).mtime.toISOString();
}

function parseEventFile(
  filePath: string,
  filename: string,
): { event: Event; lastModified: string } {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content: body } = matter(raw);
  const lastModified = fileMtime(filePath);
  const event: Event = {
    filename,
    title: String(data.title ?? ''),
    date: String(data.date ?? ''),
    tags: Array.isArray(data.tags) ? data.tags : [],
    ...(data.color !== undefined ? { color: String(data.color) } : {}),
    ...(data.status !== undefined ? { status: data.status as Event['status'] } : {}),
    body: body.trimStart(),
    mtime: lastModified,
  };
  return { event, lastModified };
}

export function registerTimelineIpcHandlers() {
  ipcMain.handle('timeline:listEvents', (_event, campaignPath: string): EventListItem[] => {
    const dir = eventsDir(campaignPath);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => SAFE_FILENAME_RE.test(f))
      .map((filename) => {
        const filePath = path.join(dir, filename);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const { data } = matter(raw);
        return {
          filename,
          title: String(data.title ?? ''),
          date: String(data.date ?? ''),
          tags: Array.isArray(data.tags) ? data.tags : [],
          ...(data.color !== undefined ? { color: String(data.color) } : {}),
          ...(data.status !== undefined ? { status: data.status as EventListItem['status'] } : {}),
          mtime: fileMtime(filePath),
        } satisfies EventListItem;
      });
  });

  ipcMain.handle(
    'timeline:getEvent',
    (_event, campaignPath: string, filename: string): EventWithMtime => {
      const dir = eventsDir(campaignPath);
      assertSafeFilename(dir, filename);
      return parseEventFile(path.join(dir, filename), filename);
    },
  );

  ipcMain.handle(
    'timeline:updateEvent',
    (
      _event,
      campaignPath: string,
      filename: string,
      frontmatter: EventFrontmatter,
      body: string,
      ifUnmodifiedSince: string,
    ): EventWithMtime | ConflictResult => {
      const dir = eventsDir(campaignPath);
      assertSafeFilename(dir, filename);
      const filePath = path.join(dir, filename);
      const currentMtime = fileMtime(filePath);
      if (currentMtime !== ifUnmodifiedSince) return { conflict: true };
      const content = matter.stringify(body, frontmatter as unknown as Record<string, unknown>);
      fs.writeFileSync(filePath, content, 'utf-8');
      return parseEventFile(filePath, filename);
    },
  );

  ipcMain.handle(
    'timeline:createEvent',
    (
      _event,
      campaignPath: string,
      filename: string,
      frontmatter: EventFrontmatter,
      body: string,
    ): EventWithMtime => {
      const dir = eventsDir(campaignPath);
      assertSafeFilename(dir, filename);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, filename);
      const content = matter.stringify(body, frontmatter as unknown as Record<string, unknown>);
      // 'wx' flag: fail if the file already exists, preventing silent clobbers.
      fs.writeFileSync(filePath, content, { encoding: 'utf-8', flag: 'wx' });
      return parseEventFile(filePath, filename);
    },
  );

  ipcMain.handle(
    'timeline:deleteEvent',
    async (
      _event,
      campaignPath: string,
      filename: string,
      ifUnmodifiedSince: string,
    ): Promise<{ ok: true } | ConflictResult> => {
      const dir = eventsDir(campaignPath);
      assertSafeFilename(dir, filename);
      const filePath = path.join(dir, filename);
      const currentMtime = fileMtime(filePath);
      if (currentMtime !== ifUnmodifiedSince) return { conflict: true };
      await shell.trashItem(path.resolve(filePath));
      return { ok: true };
    },
  );

  // getSessions/getTags/loadPalette return empty-ish defaults when the file
  // doesn't exist yet (the file is optional / auto-created on first write).
  // getState likewise. getEvent, by contrast, throws on missing file — it is
  // an addressable resource and a miss is a caller error.
  ipcMain.handle('timeline:getSessions', (_event, campaignPath: string): Session[] => {
    const filePath = path.join(campaignPath, 'sessions.json');
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Session[];
  });

  ipcMain.handle(
    'timeline:putSessions',
    (_event, campaignPath: string, sessions: Session[]): { ok: true } => {
      const filePath = path.join(campaignPath, 'sessions.json');
      fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2), 'utf-8');
      return { ok: true };
    },
  );

  ipcMain.handle('timeline:getState', (_event, campaignPath: string): State => {
    const filePath = path.join(campaignPath, 'state.json');
    if (!fs.existsSync(filePath)) {
      return { in_game_now: '', current_session: null, campaign_start: '' };
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as State;
  });

  ipcMain.handle(
    'timeline:putState',
    (_event, campaignPath: string, state: State): { ok: true } => {
      const filePath = path.join(campaignPath, 'state.json');
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
      return { ok: true };
    },
  );

  ipcMain.handle('timeline:getTags', (_event, campaignPath: string): TagsRegistry => {
    const filePath = path.join(campaignPath, 'tags.json');
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TagsRegistry;
  });

  ipcMain.handle('timeline:loadPalette', (_event, campaignPath: string): Palette => {
    const filePath = path.join(campaignPath, 'palette.json');
    if (!fs.existsSync(filePath)) {
      return {
        theme: {},
        weekdays: {
          monday: '',
          tuesday: '',
          wednesday: '',
          thursday: '',
          friday: '',
          saturday: '',
          sunday: '',
        },
      };
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Palette;
  });
}
