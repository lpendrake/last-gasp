import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyToClipboard } from './clipboard';

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the given text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await copyToClipboard('hello world');

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith('hello world');
  });

  it('propagates clipboard write failures', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await expect(copyToClipboard('some text')).rejects.toThrow('permission denied');
  });
});
