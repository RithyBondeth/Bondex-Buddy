import { expect, it } from 'vitest';
import {
  awardCompletions,
  canEquip,
  decodeProgress,
  freshProgress,
} from './progress';
import { SpiritEngine, FOCUS_MS } from './spirit';
import { openProgressStore } from '../platform/progress-store';

it('unlocks permanent decor from completed focus sessions only', () => {
  const engine = new SpiritEngine();
  engine.toggleTimer(0);
  engine.resetTimer(1000);
  expect(
    canEquip(
      awardCompletions(
        freshProgress(),
        engine.read(FOCUS_MS).completedFocusSessions,
      ),
      'plant',
    ),
  ).toBe(false);
  engine.toggleTimer(FOCUS_MS);
  const progress = awardCompletions(
    freshProgress(),
    engine.read(FOCUS_MS * 2).completedFocusSessions,
  );
  expect(canEquip(progress, 'plant')).toBe(true);
  expect(canEquip(progress, 'lantern')).toBe(false);
  expect(canEquip(awardCompletions(progress, 2), 'lantern')).toBe(true);
});
it('round-trips progress, equipment, and preferences and strips unrelated fields', () => {
  const data = {
    ...freshProgress(),
    completedFocusSessions: 3,
    decor: 'lantern',
    lighting: 'day',
    activity: 'must not persist',
  };
  expect(decodeProgress(JSON.stringify(data))).toEqual({
    version: 1,
    completedFocusSessions: 3,
    decor: 'lantern',
    lighting: 'day',
  });
});
it('rejects corrupt/future data and clears locked equipment without losing progress', () => {
  expect(() => decodeProgress('{')).toThrow();
  expect(() =>
    decodeProgress(JSON.stringify({ ...freshProgress(), version: 2 })),
  ).toThrow();
  expect(() =>
    decodeProgress(
      JSON.stringify({ ...freshProgress(), completedFocusSessions: -1 }),
    ),
  ).toThrow();
  expect(
    decodeProgress(JSON.stringify({ ...freshProgress(), decor: 'lantern' }))
      .decor,
  ).toBe('none');
});
it('never overwrites a save that could not be decoded', async () => {
  let raw = '{"version":99}';
  const store = await openProgressStore({
    read: async () => raw,
    write: async (value) => {
      raw = value;
    },
  });
  expect(store.readOnly).toBe(true);
  await expect(store.save(freshProgress())).rejects.toThrow();
  expect(raw).toBe('{"version":99}');
});
it('serializes updates and retries after an earlier write fails', async () => {
  let attempts = 0;
  let raw: string | null = null;
  const backend = {
    read: async () => raw,
    write: async (value: string) => {
      if (++attempts === 1) throw new Error('Disk unavailable');
      raw = value;
    },
  };
  const store = await openProgressStore(backend);
  const first = store.save(freshProgress());
  const latest = {
    ...freshProgress(),
    completedFocusSessions: 3,
    decor: 'lantern' as const,
  };
  const second = store.save(latest);
  await expect(first).rejects.toThrow();
  await second;
  expect((await openProgressStore(backend)).data).toEqual(latest);
});
