import * as fs from 'node:fs';
import * as path from 'node:path';

export const TEMPLATES_DIR = 'templates';

export const DEFAULT_EVENT_TEMPLATE =
  '# <title>\n\n**Location/s**: \n**Relevant Characters**: \n**Relevant Note Files**: \n**Relevant Events**: \n\n## Event Notes\n';

export function ensureEventTemplate(campaignPath: string): void {
  const templatesDir = path.join(campaignPath, TEMPLATES_DIR);
  fs.mkdirSync(templatesDir, { recursive: true });
  const filePath = path.join(templatesDir, 'event.md');
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, DEFAULT_EVENT_TEMPLATE, 'utf-8');
  }
}

export function readTemplate(campaignPath: string, name: string): string | null {
  const filePath = path.join(campaignPath, TEMPLATES_DIR, `${name}.md`);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
