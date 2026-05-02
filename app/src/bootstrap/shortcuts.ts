export interface ShortcutsDeps {
  /** Open the search overlay. */
  openSearch(): void;
  /** Whether the search overlay is currently open. */
  isSearchOpen(): boolean;
  /** Zoom the timeline by a multiplicative factor (about viewport centre). */
  zoomBy(factor: number): void;
  /** Pan the timeline by N pixels (positive = pan right, viewing earlier). */
  panBy(pixels: number): void;
  /** Centre the timeline on the in-game-now marker. */
  jumpToNow(): void;
  /** Collapse any expanded card; returns true if something was collapsed. */
  collapseExpansion(): boolean;
}

/** Wire global keyboard shortcuts to the timeline. Suppresses while a
 * modal overlay is open or while the user is typing in an input. */
export function attachGlobalShortcuts(deps: ShortcutsDeps): void {
  window.addEventListener('keydown', (e) => {
    // Ctrl+F / Cmd+F: open search. Works even if another overlay is up.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      deps.openSearch();
      return;
    }

    // Don't intercept other keys when a modal has focus handling
    if (document.querySelector('.modal-overlay') || deps.isSearchOpen()) return;

    // Don't intercept keys when user is typing in an input
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
      return;
    }

    if (e.key === '+' || e.key === '=') {
      deps.zoomBy(1 / 1.2);
    } else if (e.key === '-') {
      deps.zoomBy(1.2);
    } else if (e.key === 'Home') {
      deps.jumpToNow();
    } else if (e.key === 'ArrowLeft') {
      deps.panBy(50);
    } else if (e.key === 'ArrowRight') {
      deps.panBy(-50);
    } else if (e.key === 'Escape') {
      deps.collapseExpansion();
    }
  });
}
