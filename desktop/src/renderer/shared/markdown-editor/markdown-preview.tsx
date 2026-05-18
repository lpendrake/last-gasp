import { MarkdownEditor } from './markdown-editor';
import type { WikiLinksHostConfig } from './markdown-editor';
import type { ImageDecorationsOptions } from './extensions/image-decorations';

export interface MarkdownPreviewProps {
  content: string;
  /** Image decoration options — supply resolveSrc to handle relative or non-notes-asset URLs. */
  images?: ImageDecorationsOptions;
  /** Optional wiki-link config — allows link-click navigation from preview surfaces. */
  wikiLinks?: WikiLinksHostConfig;
  className?: string;
  /** Sets data-base-dir on the wrapper div so the peek stack can resolve plain <a href> links. */
  baseDir?: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  images,
  wikiLinks,
  className,
  baseDir,
}) => (
  <div className={className} data-base-dir={baseDir}>
    <MarkdownEditor content={content} readOnly images={images} wikiLinks={wikiLinks} />
  </div>
);
