import { describe, it, expect } from 'vitest';
import { buildNewEventContent } from '../domain/new-event-content';

describe('buildNewEventContent', () => {
  it('renders the title as an H1 with a blank line under it', () => {
    const { body } = buildNewEventContent('Goblin Ambush');
    expect(body).toBe('# Goblin Ambush\n\n');
  });

  it('places the cursor offset at the end of the body', () => {
    const { body, cursorOffset } = buildNewEventContent('Goblin Ambush');
    expect(cursorOffset).toBe(body.length);
  });
});
