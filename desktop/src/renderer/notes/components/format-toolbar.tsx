import { type EditorView } from '@codemirror/view';
import {
  boldCommand,
  italicCommand,
  codeCommand,
  strikeCommand,
  headingCommand,
  bulletListCommand,
  orderedListCommand,
  blockquoteCommand,
  insertLinkCommand,
  insertTableCommand,
  insertCodeBlockCommand,
} from '../editor/commands';

interface FormatToolbarProps {
  viewRef: React.MutableRefObject<EditorView | null>;
  /** Only render formatting buttons when an editable note is active. */
  isEditable: boolean;
  renderMode: 'live' | 'source';
  onToggleMode: () => void;
  metaOpen: boolean;
  onToggleMeta: () => void;
}

function run(viewRef: React.MutableRefObject<EditorView | null>, cmd: (v: EditorView) => boolean) {
  const view = viewRef.current;
  if (view) {
    cmd(view);
    view.focus();
  }
}

export function FormatToolbar({
  viewRef,
  isEditable,
  renderMode,
  onToggleMode,
  metaOpen,
  onToggleMeta,
}: FormatToolbarProps) {
  return (
    <div className="format-toolbar">
      {/* Centre: formatting groups — only shown for editable notes */}
      <div className="ftb-centre">
        {isEditable && (
          <>
            <div className="ftb-group">
              <button
                className="ftb-btn"
                title="Bold (Ctrl+B)"
                onClick={() => run(viewRef, boldCommand)}
              >
                {' '}
                <b>B</b>
              </button>
              <button
                className="ftb-btn"
                title="Italic (Ctrl+I)"
                onClick={() => run(viewRef, italicCommand)}
              >
                <i>I</i>
              </button>
              <button
                className="ftb-btn"
                title="Inline code (Ctrl+`)"
                onClick={() => run(viewRef, codeCommand)}
              >
                {' '}
                <code>`</code>
              </button>
              <button
                className="ftb-btn"
                title="Strikethrough (Ctrl+Shift+S)"
                onClick={() => run(viewRef, strikeCommand)}
              >
                <s>S</s>
              </button>
            </div>

            <div className="ftb-sep" />

            <div className="ftb-group">
              <button
                className="ftb-btn"
                title="Cycle heading"
                onClick={() => run(viewRef, headingCommand)}
              >
                {' '}
                #
              </button>
              <button
                className="ftb-btn"
                title="Bullet list"
                onClick={() => run(viewRef, bulletListCommand)}
              >
                {' '}
                −
              </button>
              <button
                className="ftb-btn"
                title="Ordered list"
                onClick={() => run(viewRef, orderedListCommand)}
              >
                {' '}
                1.
              </button>
              <button
                className="ftb-btn"
                title="Blockquote"
                onClick={() => run(viewRef, blockquoteCommand)}
              >
                {' '}
                ❝
              </button>
            </div>

            <div className="ftb-sep" />

            <div className="ftb-group">
              <button
                className="ftb-btn"
                title="Insert link"
                onClick={() => run(viewRef, insertLinkCommand)}
              >
                {' '}
                🔗
              </button>
              <button
                className="ftb-btn"
                title="Insert table"
                onClick={() => run(viewRef, insertTableCommand)}
              >
                {' '}
                ⊞
              </button>
              <button
                className="ftb-btn"
                title="Insert code block"
                onClick={() => run(viewRef, insertCodeBlockCommand)}
              >
                &lt;/&gt;
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right: meta toggle + live/source toggle */}
      <div className="ftb-right">
        {isEditable && (
          <button
            className={`ftb-btn${metaOpen ? ' is-active' : ''}`}
            title="Toggle metadata panel"
            onClick={onToggleMeta}
          >
            Meta
          </button>
        )}
        <div className="view-switcher">
          <button
            className={renderMode === 'source' ? 'is-active' : ''}
            title="Toggle editor mode"
            onClick={onToggleMode}
          >
            {renderMode === 'live' ? 'Live' : 'Source'}
          </button>
        </div>
      </div>
    </div>
  );
}
