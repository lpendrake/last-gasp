import { describe, it, expect } from 'vitest';
import { findImagesInText } from '../image-decorations';

describe('findImagesInText', () => {
  it('finds a single notes-asset image', () => {
    const text = '![pasted-123](notes-asset://current/notes/factions/assets/pasted-123.png)';
    const imgs = findImagesInText(text);
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toMatchObject({
      from: 0,
      to: text.length,
      altFrom: 2,
      altTo: 2 + 'pasted-123'.length,
      alt: 'pasted-123',
      src: 'notes-asset://current/notes/factions/assets/pasted-123.png',
    });
  });

  it('ignores non-notes-asset images', () => {
    const text = '![alt](https://example.com/img.png)';
    expect(findImagesInText(text)).toHaveLength(0);
  });

  it('handles multiple images in order', () => {
    const text = '![a](notes-asset://current/a.png) text ![b](notes-asset://current/b.png)';
    const imgs = findImagesInText(text);
    expect(imgs).toHaveLength(2);
    expect(imgs[0].alt).toBe('a');
    expect(imgs[0].src).toBe('notes-asset://current/a.png');
    expect(imgs[1].alt).toBe('b');
    expect(imgs[1].src).toBe('notes-asset://current/b.png');
  });

  it('applies offset to all positions', () => {
    const text = '![x](notes-asset://current/x.png)';
    const imgs = findImagesInText(text, 20);
    expect(imgs[0].from).toBe(20);
    expect(imgs[0].altFrom).toBe(22); // 20 + 2 (skip `![`)
    expect(imgs[0].altTo).toBe(23); // 22 + 1 (length of 'x')
    expect(imgs[0].to).toBe(20 + text.length);
  });

  it('handles empty alt text — altFrom equals altTo', () => {
    const text = '![](notes-asset://current/unnamed.png)';
    const imgs = findImagesInText(text);
    expect(imgs).toHaveLength(1);
    expect(imgs[0].alt).toBe('');
    expect(imgs[0].altFrom).toBe(imgs[0].altTo);
  });

  it('returns empty array when no images present', () => {
    expect(findImagesInText('just some plain text')).toHaveLength(0);
    expect(findImagesInText('')).toHaveLength(0);
  });

  it('mixes with surrounding text correctly', () => {
    const text = 'Before\n![hero](notes-asset://current/hero.jpg)\nAfter';
    const imgs = findImagesInText(text);
    expect(imgs).toHaveLength(1);
    expect(imgs[0].from).toBe('Before\n'.length);
    expect(imgs[0].alt).toBe('hero');
  });
});
