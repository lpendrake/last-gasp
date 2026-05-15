import { useCallback } from 'react';

interface MetaPanelProps {
  frontmatter: string;
  onChange: (value: string) => void;
}

/**
 * Editable panel for raw YAML frontmatter.
 * The editor never sees this content — it lives in FileState.frontmatter
 * and is recombined with the body only at save time.
 */
export function MetaPanel({ frontmatter, onChange }: MetaPanelProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
    [onChange],
  );

  return (
    <div className="meta-panel">
      <div className="meta-panel-label">Metadata</div>
      <textarea
        className="meta-panel-editor"
        value={frontmatter}
        onChange={handleChange}
        spellCheck={false}
        placeholder="title: My Note&#10;tags: []"
      />
    </div>
  );
}
