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

  it('falls back to # title heading when no template is provided', () => {
    const { body, cursorOffset } = buildNewEventContent("Battle of Helm's Deep");
    expect(body).toBe("# Battle of Helm's Deep\n\n");
    expect(cursorOffset).toBe(body.length);
  });

  it('substitutes <title> token in a template', () => {
    const template = '# <title>\n\nSome notes here.\n';
    const { body, cursorOffset } = buildNewEventContent('Dragon Attack', template);
    expect(body).toBe('# Dragon Attack\n\nSome notes here.\n');
    expect(cursorOffset).toBe(body.length);
  });

  it('replaces all occurrences of <title> when the token appears multiple times', () => {
    const template = '# <title>\n\n> <title> is significant.\n';
    const { body, cursorOffset } = buildNewEventContent('The Siege', template);
    expect(body).toBe('# The Siege\n\n> The Siege is significant.\n');
    expect(cursorOffset).toBe(body.length);
  });

  it('falls back to # title heading when template is an empty string', () => {
    const { body, cursorOffset } = buildNewEventContent('Quiet Day', '');
    expect(body).toBe('# Quiet Day\n\n');
    expect(cursorOffset).toBe(body.length);
  });

  it('falls back to # title heading when template is whitespace only', () => {
    const { body, cursorOffset } = buildNewEventContent('Quiet Day', '   \n\t  ');
    expect(body).toBe('# Quiet Day\n\n');
    expect(cursorOffset).toBe(body.length);
  });

  it('falls back to # title heading when template is null', () => {
    const { body, cursorOffset } = buildNewEventContent('Quiet Day', null);
    expect(body).toBe('# Quiet Day\n\n');
    expect(cursorOffset).toBe(body.length);
  });
});
