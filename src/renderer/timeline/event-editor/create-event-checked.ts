import { timelinePort } from '../data/ports';
import type { EventFrontmatter } from '../data/types';
export type { CreateEventResult } from '../data/types';

export async function createEventChecked(
  campaignPath: string,
  filename: string,
  frontmatter: EventFrontmatter,
  body: string,
) {
  return timelinePort.createEvent(campaignPath, filename, frontmatter, body);
}
