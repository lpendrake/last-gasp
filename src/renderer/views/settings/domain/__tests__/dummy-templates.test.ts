import { describe, it, expect } from 'vitest';
import { DUMMY_TEMPLATES } from '../dummy-templates';

describe('DUMMY_TEMPLATES', () => {
  it('contains at least 3 templates', () => {
    expect(DUMMY_TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it('every template has a non-empty id, name, and content', () => {
    for (const tpl of DUMMY_TEMPLATES) {
      expect(tpl.id.trim()).not.toBe('');
      expect(tpl.name.trim()).not.toBe('');
      expect(tpl.content.trim()).not.toBe('');
    }
  });

  it('all template ids are unique', () => {
    const ids = DUMMY_TEMPLATES.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
