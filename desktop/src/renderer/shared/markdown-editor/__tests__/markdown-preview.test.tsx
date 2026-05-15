// @vitest-environment happy-dom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MarkdownPreview } from '../markdown-preview';

let container: HTMLDivElement;
let root: Root;

function setup() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
}

function teardown() {
  act(() => root.unmount());
  container.remove();
}

describe('MarkdownPreview', () => {
  it('renders without crashing and without onChange', () => {
    setup();
    act(() => root.render(<MarkdownPreview content="Hello **world**" />));
    expect(container.querySelector('.markdown-editor-container')).not.toBeNull();
    teardown();
  });

  it('applies className to the wrapper div', () => {
    setup();
    act(() => root.render(<MarkdownPreview content="text" className="exp-body" />));
    const wrapper = container.firstElementChild;
    expect(wrapper?.classList.contains('exp-body')).toBe(true);
    teardown();
  });

  it('mounts a read-only CodeMirror editor', () => {
    setup();
    act(() =>
      root.render(
        <MarkdownPreview
          content="read only"
          images={{
            resolveSrc: (src) => `notes-asset://current/events/${encodeURIComponent(src)}`,
          }}
        />,
      ),
    );
    // contentEditable=false indicates the editor is non-editable
    const cmContent = container.querySelector('[contenteditable]');
    expect(cmContent?.getAttribute('contenteditable')).toBe('false');
    teardown();
  });
});
