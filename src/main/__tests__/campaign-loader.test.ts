import { describe, it, expect, vi } from 'vitest';
import { CampaignLoader } from '../campaign-loader.js';
import type { NamedTask } from '../campaign-loader.js';

function makeWebContents() {
  return { send: vi.fn() };
}

describe('CampaignLoader', () => {
  it('sends loadComplete after all tasks finish', async () => {
    const wc = makeWebContents();
    const loader = new CampaignLoader([{ name: 'task-a', task: async () => {} }]);

    await loader.run(wc as never);

    expect(wc.send).toHaveBeenCalledWith('campaign:loadComplete');
  });

  it('sends loadProgress with correct percentage for a single task', async () => {
    const wc = makeWebContents();
    const task: NamedTask = {
      name: 'index',
      task: async (onProgress) => {
        onProgress(1, 4);
        onProgress(4, 4);
      },
    };

    await loader(wc, [task]);

    const progressCalls = wc.send.mock.calls.filter(([ch]) => ch === 'campaign:loadProgress');
    expect(progressCalls[0]).toEqual([
      'campaign:loadProgress',
      { percentage: 25, taskName: 'index' },
    ]);
    expect(progressCalls[1]).toEqual([
      'campaign:loadProgress',
      { percentage: 100, taskName: 'index' },
    ]);
  });

  it('aggregates progress across multiple tasks', async () => {
    const wc = makeWebContents();

    const taskA: NamedTask = {
      name: 'a',
      task: async (onProgress) => {
        onProgress(2, 4);
      },
    };
    const taskB: NamedTask = {
      name: 'b',
      task: async () => {},
    };

    await loader(wc, [taskA, taskB]);

    // After task A: 2/4 = 50%. Task B resolved without progress (0/0 doesn't add).
    const progressCalls = wc.send.mock.calls.filter(([ch]) => ch === 'campaign:loadProgress');
    expect(progressCalls[0]).toEqual(['campaign:loadProgress', { percentage: 50, taskName: 'a' }]);
  });

  it('correctly aggregates when both tasks report progress', async () => {
    const wc = makeWebContents();
    const snapshots: Array<{ percentage: number; taskName: string }> = [];
    wc.send.mockImplementation((channel: string, data: unknown) => {
      if (channel === 'campaign:loadProgress') {
        snapshots.push(data as { percentage: number; taskName: string });
      }
    });

    const taskA: NamedTask = {
      name: 'a',
      task: async (onProgress) => {
        onProgress(1, 2);
        onProgress(2, 2);
      },
    };
    const taskB: NamedTask = {
      name: 'b',
      task: async (onProgress) => {
        onProgress(1, 2);
        onProgress(2, 2);
      },
    };

    await new CampaignLoader([taskA, taskB]).run(wc as never);

    // After taskA runs: 1/2=50%, 2/2=100%
    // After taskB starts: taskA still 2/2; taskB 1/2 → 3/4=75%, then 4/4=100%
    expect(snapshots.map((s) => s.percentage)).toEqual([50, 100, 75, 100]);
  });

  it('sends percentage 0 when total is 0', async () => {
    const wc = makeWebContents();
    const task: NamedTask = {
      name: 'empty',
      task: async (onProgress) => {
        onProgress(0, 0);
      },
    };

    await new CampaignLoader([task]).run(wc as never);

    const progressCalls = wc.send.mock.calls.filter(([ch]) => ch === 'campaign:loadProgress');
    expect(progressCalls[0][1].percentage).toBe(0);
  });

  it('sends loadError and rethrows when a task throws', async () => {
    const wc = makeWebContents();
    const boom = new Error('disk full');
    const loader = new CampaignLoader([
      {
        name: 'failing-task',
        task: async () => {
          throw boom;
        },
      },
    ]);

    await expect(loader.run(wc as never)).rejects.toThrow('disk full');
    expect(wc.send).toHaveBeenCalledWith('campaign:loadError', { message: 'disk full' });
    expect(wc.send).not.toHaveBeenCalledWith('campaign:loadComplete');
  });

  it('runs tasks sequentially, not concurrently', async () => {
    const wc = makeWebContents();
    const order: string[] = [];

    const tasks: NamedTask[] = ['first', 'second', 'third'].map((name) => ({
      name,
      task: async () => {
        order.push(`start:${name}`);
        await Promise.resolve();
        order.push(`end:${name}`);
      },
    }));

    await new CampaignLoader(tasks).run(wc as never);

    expect(order).toEqual([
      'start:first',
      'end:first',
      'start:second',
      'end:second',
      'start:third',
      'end:third',
    ]);
  });
});

function loader(wc: ReturnType<typeof makeWebContents>, tasks: NamedTask[]): Promise<void> {
  return new CampaignLoader(tasks).run(wc as never);
}
