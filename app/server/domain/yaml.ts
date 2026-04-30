import { promises as fs } from 'fs';
import { basename } from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import type { Event, EventListItem, EventFrontmatter } from '../../src/data/types.ts';

// Custom YAML engine for gray-matter that does NOT parse ISO-style strings as Date objects.
// Golarian years like 4726 aren't meaningful as JS Dates, and we want date strings preserved.
const yamlEngine = {
  parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
  stringify: (obj: object) => yaml.dump(obj, { schema: yaml.JSON_SCHEMA, lineWidth: -1 }),
};
const MATTER_OPTIONS = { engines: { yaml: yamlEngine } };

export function serialiseEvent(fm: EventFrontmatter, body: string): string {
  return matter.stringify(body, fm as any, MATTER_OPTIONS);
}

export function parseEventFile(content: string): { fm: EventFrontmatter; body: string } {
  const parsed = matter(content, MATTER_OPTIONS);
  const fm = parsed.data as EventFrontmatter;
  return { fm, body: parsed.content };
}

export function eventFromParsed(filename: string, content: string, mtime: Date): Event {
  const { fm, body } = parseEventFile(content);
  return { ...fm, filename, body, mtime: mtime.toUTCString() };
}

export function eventListItemFromParsed(filename: string, content: string, mtime: Date): EventListItem {
  const { fm } = parseEventFile(content);
  return { ...fm, filename, mtime: mtime.toUTCString() };
}

/**
 * Read a markdown file and return a display title: frontmatter `title`,
 * else the first `# ` heading in the body, else the filename minus `.md`.
 */
export async function extractTitle(filepath: string): Promise<string> {
  const content = await fs.readFile(filepath, 'utf-8');
  try {
    const parsed = matter(content, MATTER_OPTIONS);
    if (parsed.data && typeof (parsed.data as any).title === 'string') {
      return (parsed.data as any).title;
    }
    const m = parsed.content.match(/^#\s+(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    const m = content.match(/^#\s+(.+)$/m);
    if (m) return m[1].trim();
  }
  return basename(filepath, '.md');
}
