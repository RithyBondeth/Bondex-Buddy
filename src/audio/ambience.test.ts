import { expect, it, vi } from 'vitest';
import { Ambience } from './ambience';

it('does not allocate audio or play sounds until explicitly enabled', async () => {
  const create = vi.fn<() => AudioContext>();
  const ambience = new Ambience(create);
  ambience.chime(true);
  ambience.setVisible(false);
  await ambience.setEnabled(false);
  expect(create).not.toHaveBeenCalled();
  expect(ambience.enabled).toBe(false);
  ambience.dispose();
});

it('cleans up an audio context even if disposed while a resume is pending', async () => {
  let resume: (() => void) | undefined;
  const context = {
    state: 'suspended',
    resume: () =>
      new Promise<void>((resolve) => {
        resume = resolve;
      }),
    close: vi.fn().mockResolvedValue(undefined),
    createBuffer: vi.fn(),
  };
  const ambience = new Ambience(() => context as unknown as AudioContext);
  const enabling = ambience.setEnabled(true);
  ambience.dispose();
  resume?.();
  expect(await enabling).toBe(false);
  expect(context.close).toHaveBeenCalledTimes(1);
  expect(context.createBuffer).not.toHaveBeenCalled();
});
