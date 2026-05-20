import { describe, it, expect } from 'vitest';
import { computeExpansionLayout, CARD_HEIGHT, CARD_GAP } from '../cards';

const SIZE = { width: 1200, height: 600 };
const AXIS_Y = Math.floor(SIZE.height * 0.8); // 480

function normalTop(row: number): number {
  return AXIS_Y - CARD_HEIGHT - CARD_GAP - row * (CARD_HEIGHT + CARD_GAP);
}

describe('computeExpansionLayout', () => {
  describe('expandsDown flag', () => {
    it('opens upward when there is room above the card', () => {
      // row-0 card top is ~392; a 200px expansion fits above (392-200=192 > 0)
      const top = normalTop(0); // 392
      const { expandsDown } = computeExpansionLayout(top, 200, 120, 640);
      expect(expandsDown).toBe(false);
    });

    it('opens downward when the expansion would go above the viewport top', () => {
      // row-0 top is ~392; a 400px expansion would land at -8, so flip down
      const top = normalTop(0); // 392
      const { expandsDown } = computeExpansionLayout(top, 400, 120, 640);
      expect(expandsDown).toBe(true);
    });

    it('an expansion that exactly fits the available space above opens upward', () => {
      const top = normalTop(0); // 392
      // expandedHeight exactly equals normalTop → 392-392 = 0, which is NOT < 0
      const { expandsDown } = computeExpansionLayout(top, top, 120, 640);
      expect(expandsDown).toBe(false);
    });

    it('one pixel over the boundary triggers downward expansion', () => {
      const top = normalTop(0); // 392
      const { expandsDown } = computeExpansionLayout(top, top + 1, 120, 640);
      expect(expandsDown).toBe(true);
    });
  });

  describe('cardTop', () => {
    it('is normalTop - expandedHeight when opening upward', () => {
      const top = normalTop(0); // 392
      const { cardTop, expandsDown } = computeExpansionLayout(top, 100, 120, 640);
      expect(expandsDown).toBe(false);
      expect(cardTop).toBe(top - 100);
    });

    it('is normalTop when opening downward', () => {
      const top = normalTop(0); // 392
      const { cardTop, expandsDown } = computeExpansionLayout(top, 400, 120, 640);
      expect(expandsDown).toBe(true);
      expect(cardTop).toBe(top);
    });
  });

  describe('cardWidth', () => {
    it('uses previewWidth when wider than normalWidth', () => {
      const { cardWidth } = computeExpansionLayout(300, 200, 120, 640);
      expect(cardWidth).toBe(640);
    });

    it('uses normalWidth when wider than previewWidth', () => {
      const { cardWidth } = computeExpansionLayout(300, 200, 700, 640);
      expect(cardWidth).toBe(700);
    });

    it('uses normalWidth when equal to previewWidth', () => {
      const { cardWidth } = computeExpansionLayout(300, 200, 640, 640);
      expect(cardWidth).toBe(640);
    });
  });

  describe('higher-row cards', () => {
    it('row-2 card still expands down when height exceeds available space', () => {
      const top = normalTop(2); // ~216
      // A 250px expansion on row-2 (top=216) would need 216-250=-34 → down
      const { expandsDown } = computeExpansionLayout(top, 250, 120, 640);
      expect(expandsDown).toBe(true);
    });

    it('row-2 card expands up when there is enough room', () => {
      const top = normalTop(2); // ~216
      const { expandsDown } = computeExpansionLayout(top, 100, 120, 640);
      expect(expandsDown).toBe(false);
    });
  });
});
