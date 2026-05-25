import type { WebContents } from 'electron';

export type LoadingTask = (onProgress: (completed: number, total: number) => void) => Promise<void>;

export interface NamedTask {
  name: string;
  task: LoadingTask;
}

export class CampaignLoader {
  constructor(private readonly tasks: NamedTask[]) {}

  async run(webContents: WebContents): Promise<void> {
    const progress = this.tasks.map(() => ({ completed: 0, total: 0 }));

    const sendProgress = (taskName: string) => {
      const totalCompleted = progress.reduce((sum, p) => sum + p.completed, 0);
      const totalCount = progress.reduce((sum, p) => sum + p.total, 0);
      const percentage = totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0;
      webContents.send('campaign:loadProgress', { percentage, taskName });
    };

    try {
      for (let i = 0; i < this.tasks.length; i++) {
        const { name, task } = this.tasks[i];
        await task((completed, total) => {
          progress[i] = { completed, total };
          sendProgress(name);
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      webContents.send('campaign:loadError', { message });
      throw err;
    }

    webContents.send('campaign:loadComplete');
  }
}
