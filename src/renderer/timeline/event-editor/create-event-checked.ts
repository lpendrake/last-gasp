import { timelinePort } from '../data/ports';
import type { EventFrontmatter, EventWithMtime } from '../data/types';

export type CreateEventResult =
  | { ok: true; event: EventWithMtime }
  | { ok: false; reason: 'duplicate' };

export async function createEventChecked(
  campaignPath: string,
  filename: string,
  frontmatter: EventFrontmatter,
  body: string,
): Promise<CreateEventResult> {
  try {
    const event = await timelinePort.createEvent(campaignPath, filename, frontmatter, body);
    return { ok: true, event };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string } | null;
    const isEexist = e?.code === 'EEXIST' || String(e?.message ?? e).includes('EEXIST');
    if (isEexist) {
      return { ok: false, reason: 'duplicate' };
    }
    throw err;
  }
}
