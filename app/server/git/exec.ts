import { execFile } from 'child_process';
import type { GitPort } from './port.ts';

/** execFile-backed GitPort. Runs `git` in cwd=repoRoot. */
export function makeExecGitPort(repoRoot: string): GitPort {
  function run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd: repoRoot }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
  }
  return {
    status: () => run(['status', '--short']),
    commit: async (message) => {
      await run(['add', '-A']);
      await run(['commit', '-m', message]);
    },
  };
}
