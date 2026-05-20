// Scan leftward from pos through any adjacent format markers; return position of target if found.
const OPEN_MARKERS  = ['**', '~~', '_', '<u>'];
const CLOSE_MARKERS = ['**', '~~', '_', '</u>'];

function findWrappedBefore(val: string, pos: number, target: string): number | null {
  let p = pos;
  while (true) {
    let moved = false;
    for (const m of OPEN_MARKERS) {
      if (p >= m.length && val.slice(p - m.length, p) === m) {
        if (m === target) return p - m.length;
        p -= m.length;
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }
}

function findWrappedAfter(val: string, pos: number, target: string): number | null {
  let p = pos;
  while (true) {
    let moved = false;
    for (const m of CLOSE_MARKERS) {
      if (p + m.length <= val.length && val.slice(p, p + m.length) === m) {
        if (m === target) return p;
        p += m.length;
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }
}

function toggleWrap(textarea: HTMLTextAreaElement, before: string, after: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  const beforePos = findWrappedBefore(val, start, before);
  const afterPos  = findWrappedAfter(val, end, after);

  if (beforePos !== null && afterPos !== null) {
    textarea.value =
      val.slice(0, beforePos) +
      val.slice(beforePos + before.length, afterPos) +
      val.slice(afterPos + after.length);
    textarea.setSelectionRange(start - before.length, end - before.length);
  } else {
    const selected = val.slice(start, end);
    textarea.value = val.slice(0, start) + before + selected + after + val.slice(end);
    if (selected) {
      textarea.setSelectionRange(start + before.length, end + before.length);
    } else {
      const pos = start + before.length;
      textarea.setSelectionRange(pos, pos);
    }
  }

  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

function getSelectionFirstLineRect(textarea: HTMLTextAreaElement): DOMRect | null {
  if (textarea.selectionStart === textarea.selectionEnd) return null;

  const mirror = document.createElement('div');
  const computed = getComputedStyle(textarea);

  for (const prop of [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
    'lineHeight', 'letterSpacing', 'wordSpacing',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'boxSizing', 'whiteSpace', 'wordBreak', 'overflowWrap', 'tabSize',
  ] as const) {
    (mirror.style as any)[prop] = computed[prop];
  }

  const taRect = textarea.getBoundingClientRect();
  Object.assign(mirror.style, {
    position: 'fixed',
    top: `${taRect.top}px`,
    left: `${taRect.left}px`,
    width: `${taRect.width}px`,
    height: `${taRect.height}px`,
    overflow: 'hidden',
    visibility: 'hidden',
    pointerEvents: 'none',
    zIndex: '-1',
    color: 'transparent',
    background: 'transparent',
  });

  mirror.appendChild(document.createTextNode(textarea.value.slice(0, textarea.selectionStart)));
  const selSpan = document.createElement('span');
  selSpan.textContent = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) || '​';
  mirror.appendChild(selSpan);
  mirror.appendChild(document.createTextNode(textarea.value.slice(textarea.selectionEnd)));

  document.body.appendChild(mirror);
  mirror.scrollTop = textarea.scrollTop;
  mirror.scrollLeft = textarea.scrollLeft;

  const rects = selSpan.getClientRects();
  mirror.remove();

  if (!rects.length) return null;

  const first = rects[0];
  if (first.top >= taRect.bottom || first.bottom <= taRect.top) return null;

  return first;
}

export function attachFormatToolbar(
  textarea: HTMLTextAreaElement,
  openLinkForSelection: (displayText: string, selStart: number, selEnd: number) => void,
): () => void {
  const toolbar = document.createElement('div');
  toolbar.className = 'fmt-toolbar';
  toolbar.hidden = true;
  document.body.appendChild(toolbar);

  type BtnDef = { label: string; title: string; action: (selStart: number, selEnd: number) => void };
  const BUTTONS: BtnDef[] = [
    { label: 'B', title: 'Bold (Ctrl+B)',      action: () => toggleWrap(textarea, '**', '**') },
    { label: 'I', title: 'Italic (Ctrl+I)',    action: () => toggleWrap(textarea, '_', '_') },
    { label: 'U', title: 'Underline (Ctrl+U)', action: () => toggleWrap(textarea, '<u>', '</u>') },
    { label: 'S', title: 'Strikethrough',      action: () => toggleWrap(textarea, '~~', '~~') },
    {
      label: 'L', title: 'Link (Ctrl+K)',
      action: (selStart, selEnd) => openLinkForSelection(textarea.value.slice(selStart, selEnd), selStart, selEnd),
    },
  ];

  for (const btn of BUTTONS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'fmt-toolbar-btn';
    el.dataset.fmt = btn.label;
    el.textContent = btn.label;
    el.title = btn.title;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault(); // keep textarea focus
      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;
      btn.action(selStart, selEnd);
    });
    toolbar.appendChild(el);
  }

  function positionAndShow() {
    const firstRect = getSelectionFirstLineRect(textarea);
    if (!firstRect) { toolbar.hidden = true; return; }

    toolbar.style.left = '-9999px';
    toolbar.style.top = '-9999px';
    toolbar.hidden = false;

    const tbRect = toolbar.getBoundingClientRect();
    const GAP = 6;

    let x = firstRect.left;
    let y = firstRect.top - tbRect.height - GAP;

    const vw = window.innerWidth;
    if (x + tbRect.width > vw - 4) x = vw - 4 - tbRect.width;
    if (x < 4) x = 4;
    if (y < 4) y = firstRect.bottom + GAP;

    toolbar.style.left = `${x}px`;
    toolbar.style.top = `${y}px`;
  }

  function hideToolbar() { toolbar.hidden = true; }

  function checkSelectionNow() {
    if (textarea.selectionStart !== textarea.selectionEnd) {
      positionAndShow();
    } else {
      hideToolbar();
    }
  }

  // selectionchange: catches keyboard-driven selection changes
  function onSelectionChange() {
    if (document.activeElement !== textarea) return;
    checkSelectionNow();
  }

  // document mouseup: catches click-to-deselect inside the textarea.
  // setTimeout(0) lets the browser commit the new selectionStart/End before we read it.
  function onDocMouseUp(e: MouseEvent) {
    const target = e.target as Node;
    if (target === textarea) {
      setTimeout(checkSelectionNow, 0);
    } else if (!toolbar.contains(target)) {
      hideToolbar();
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    switch (e.key.toLowerCase()) {
      case 'b': e.preventDefault(); toggleWrap(textarea, '**', '**'); break;
      case 'i': e.preventDefault(); toggleWrap(textarea, '_', '_'); break;
      case 'u': e.preventDefault(); toggleWrap(textarea, '<u>', '</u>'); break;
      case 'k': {
        e.preventDefault();
        const selStart = textarea.selectionStart;
        const selEnd = textarea.selectionEnd;
        openLinkForSelection(textarea.value.slice(selStart, selEnd), selStart, selEnd);
        break;
      }
    }
  }

  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('mouseup', onDocMouseUp);
  textarea.addEventListener('blur', hideToolbar);
  textarea.addEventListener('keydown', onKeyDown);

  return () => {
    document.removeEventListener('selectionchange', onSelectionChange);
    document.removeEventListener('mouseup', onDocMouseUp);
    textarea.removeEventListener('blur', hideToolbar);
    textarea.removeEventListener('keydown', onKeyDown);
    toolbar.remove();
  };
}
