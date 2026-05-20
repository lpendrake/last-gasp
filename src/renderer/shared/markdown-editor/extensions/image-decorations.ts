import { RangeSetBuilder, StateField, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { isCursorNear } from './decorations';

export interface ParsedImage {
  from: number; // position of `!`
  to: number; // position after `)`
  altFrom: number; // position of first alt char (after `![`)
  altTo: number; // position after last alt char (before `]`)
  alt: string;
  src: string; // raw src from the markdown (before any transformation)
}

export interface ImageDecorationsOptions {
  /** Map a raw image src to a displayable URL, or return null to skip the widget. */
  resolveSrc?: (rawSrc: string) => string | null;
}

// Matches any ![alt](url) — url may be any non-whitespace, non-paren sequence.
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

/** Default: only render notes-asset:// images (backward-compatible behaviour). */
const defaultResolveSrc = (src: string): string | null =>
  src.startsWith('notes-asset://') ? src : null;

/** Finds all `![alt](url)` images in `text`, positions offset by `offset`. */
export function findImagesInText(text: string, offset = 0): ParsedImage[] {
  const results: ParsedImage[] = [];
  const re = new RegExp(IMAGE_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const from = offset + match.index;
    const altFrom = from + 2; // skip `![`
    const altTo = altFrom + match[1].length;
    results.push({
      from,
      to: from + match[0].length,
      altFrom,
      altTo,
      alt: match[1],
      src: match[2],
    });
  }
  return results;
}

class ImageWidget extends WidgetType {
  constructor(
    private readonly src: string,
    private readonly alt: string,
  ) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return this.src === other.src && this.alt === other.alt;
  }

  override toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-image-widget-wrap';
    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.className = 'cm-image-widget';
    wrap.appendChild(img);
    return wrap;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

function buildImageDecorations(
  state: EditorState,
  resolveSrc: (rawSrc: string) => string | null,
): DecorationSet {
  const cursorHead = state.selection.main.head;
  const builder = new RangeSetBuilder<Decoration>();
  const images = findImagesInText(state.doc.toString());

  for (const img of images) {
    const resolvedSrc = resolveSrc(img.src);
    if (resolvedSrc === null) continue;

    // Always render the image — block widget appears above the label line.
    // side: -1 places it before the character at img.from.
    builder.add(
      img.from,
      img.from,
      Decoration.widget({
        widget: new ImageWidget(resolvedSrc, img.alt),
        side: -1,
      }),
    );

    if (isCursorNear(cursorHead, img.from, img.to)) {
      // Cursor inside: show full raw markdown, muted
      builder.add(img.from, img.to, Decoration.mark({ class: 'cm-image-raw' }));
    } else {
      // Cursor elsewhere: collapse to just the alt name, like a link label
      builder.add(img.from, img.altFrom, Decoration.replace({})); // hide `![`
      builder.add(img.altFrom, img.altTo, Decoration.mark({ class: 'cm-image-label' })); // show alt
      builder.add(img.altTo, img.to, Decoration.replace({})); // hide `](url)`
    }
  }

  return builder.finish();
}

export function imageDecorations(opts?: ImageDecorationsOptions): Extension {
  const resolveSrc = opts?.resolveSrc ?? defaultResolveSrc;
  return StateField.define<DecorationSet>({
    create(state) {
      return buildImageDecorations(state, resolveSrc);
    },
    update(value, transaction) {
      if (transaction.docChanged || transaction.selection) {
        return buildImageDecorations(transaction.state, resolveSrc);
      }
      return value.map(transaction.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}
