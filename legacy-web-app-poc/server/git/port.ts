/** Port for git operations. Domain functions depend on this; the
 * filesystem implementation in `exec.ts` shells out to `git`. */
export interface GitPort {
  /** Run `git status --short`; returns stdout. */
  status(): Promise<string>;
  /** Run `git add -A && git commit -m <message>`. */
  commit(message: string): Promise<void>;
}
