/** Build the app's outer DOM scaffold. Called once at startup, before
 * any view (timeline / notes) initialises. The two top-level shells
 * (#timeline-shell, #notes-shell) are toggled by the view switcher;
 * everything inside is owned by the relevant slice. */
export function mountAppShell(appEl: HTMLElement): void {
  appEl.innerHTML = `
    <div id="timeline-shell" style="display:contents">
      <div class="timeline-container" id="timeline">
        <div class="timeline-session-layer" id="session-layer"></div>
        <div class="timeline-axis-layer" id="axis-layer"></div>
        <div class="timeline-cards-layer" id="cards-layer"></div>
      </div>
      <div class="filter-panel" id="filter-panel">
        <div class="filter-bar" id="filter-bar"></div>
      </div>
      <footer class="toolbar">
        <div class="toolbar-left">
          <button id="btn-filters">Filters</button>
          <span class="filter-count" id="filter-count"></span>
        </div>
        <div class="toolbar-main">
          <div class="toolbar-main-left">
            <button id="btn-search" title="Search (Ctrl+F)">Search</button>
            <button id="btn-session">Session</button>
          </div>
          <button id="btn-new-event" class="is-primary" title="New event (N)">+ Event</button>
          <div class="toolbar-main-right">
            <button id="btn-now">Now</button>
            <button id="btn-advance-time">Advance Time</button>
          </div>
        </div>
        <div class="toolbar-right" style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
          <div class="view-switcher">
            <button class="is-active" id="btn-view-timeline">Timeline</button>
            <button id="btn-view-notes">Notes</button>
          </div>
        </div>
      </footer>
    </div>
    <div id="notes-shell" style="display:none;flex:1 1 auto;flex-direction:column;min-height:0"></div>
  `;
}
