import type {
  CreateEventResult,
  EventFrontmatter,
  EventListItem,
  EventWithMtime,
  Session,
  State,
  TagsRegistry,
  ConflictResult,
} from './types';

export class ConflictError extends Error {
  constructor() {
    super('Conflict: file was modified since last read');
    this.name = 'ConflictError';
  }
}

function assertNotConflict<T>(result: T | ConflictResult): asserts result is T {
  if (result !== null && typeof result === 'object' && 'conflict' in result) {
    throw new ConflictError();
  }
}

export const timelinePort = {
  async listEvents(campaignPath: string): Promise<EventListItem[]> {
    return window.fsApi.timelineListEvents(campaignPath);
  },

  async getEvent(campaignPath: string, filename: string): Promise<EventWithMtime> {
    return window.fsApi.timelineGetEvent(campaignPath, filename);
  },

  async createEvent(
    campaignPath: string,
    filename: string,
    frontmatter: EventFrontmatter,
    body: string,
  ): Promise<CreateEventResult> {
    return window.fsApi.timelineCreateEvent(campaignPath, filename, frontmatter, body);
  },

  async updateEvent(
    campaignPath: string,
    filename: string,
    frontmatter: EventFrontmatter,
    body: string,
    ifUnmodifiedSince: string,
  ): Promise<EventWithMtime> {
    const result = await window.fsApi.timelineUpdateEvent(
      campaignPath,
      filename,
      frontmatter,
      body,
      ifUnmodifiedSince,
    );
    assertNotConflict(result);
    return result;
  },

  async deleteEvent(
    campaignPath: string,
    filename: string,
    ifUnmodifiedSince: string,
  ): Promise<void> {
    const result = await window.fsApi.timelineDeleteEvent(
      campaignPath,
      filename,
      ifUnmodifiedSince,
    );
    assertNotConflict(result);
  },

  async getSessions(campaignPath: string): Promise<Session[]> {
    return window.fsApi.timelineGetSessions(campaignPath);
  },

  async putSessions(campaignPath: string, sessions: Session[]): Promise<void> {
    await window.fsApi.timelinePutSessions(campaignPath, sessions);
  },

  async getState(campaignPath: string): Promise<State> {
    return window.fsApi.timelineGetState(campaignPath);
  },

  async putState(campaignPath: string, state: State): Promise<void> {
    await window.fsApi.timelinePutState(campaignPath, state);
  },

  async getTags(campaignPath: string): Promise<TagsRegistry> {
    return window.fsApi.timelineGetTags(campaignPath);
  },
};
