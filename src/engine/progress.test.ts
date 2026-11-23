import { expect, it } from 'vitest';
import {
  awardCompletions,
  canEquip,
  decodeProgress,
  freshProgress,
} from './progress';
import { SpiritEngine, FOCUS_MS } from './spirit';
import { creditTask, dueReminders } from './tasks';
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
    companion: 'iron-man',
    completedFocusSessions: 3,
    decor: 'lantern',
    lighting: 'day',
    activity: 'must not persist',
  };
  expect(decodeProgress(JSON.stringify(data))).toEqual({
    version: 2,
    companion: 'iron-man',
    outfit: 'none',
    ghost: false,
    completedFocusSessions: 3,
    decor: 'lantern',
    lighting: 'day',
    tasks: [],
    waterMinutes: 0,
  });
});
it('defaults to Ember for older saves and unrecognized companions', () => {
  const legacy = { ...freshProgress(), companion: undefined };
  expect(decodeProgress(JSON.stringify(legacy)).companion).toBe('ember');
  expect(
    decodeProgress(JSON.stringify({ ...legacy, companion: 'unknown' }))
      .companion,
  ).toBe('ember');
});
it('loads old saves without tasks and preserves saved tasks and earned sessions', () => {
  expect(
    decodeProgress(
      '{"version":2,"outfit":"none","ghost":false,"completedFocusSessions":1,"decor":"plant","lighting":"day"}',
    ).tasks,
  ).toEqual([]);
  const first = {
    id: '1'.repeat(24),
    title: 'Review',
    done: false,
    sessions: 2,
    remindAt: 10,
  };
  const second = {
    id: '2'.repeat(24),
    title: 'Write',
    done: true,
    sessions: 0,
    remindAt: null,
  };
  const progress = {
    ...freshProgress(),
    tasks: creditTask([first, second], first.id, 1),
  };
  expect(decodeProgress(JSON.stringify(progress)).tasks).toEqual([
    { ...first, sessions: 3 },
    second,
  ]);
  expect(dueReminders(progress.tasks, 9)).toEqual([]);
  expect(dueReminders(progress.tasks, 10)).toEqual([{ ...first, sessions: 3 }]);
  expect(() =>
    decodeProgress(JSON.stringify({ ...progress, tasks: [first, first] })),
  ).toThrow();
});
it('rejects corrupt/future data and clears locked equipment without losing progress', () => {
  expect(() => decodeProgress('{')).toThrow();
  expect(() =>
    decodeProgress(JSON.stringify({ ...freshProgress(), version: 3 })),
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

it('migrates version 1 without losing earned progress or equipped decor', () => {
  expect(
    decodeProgress(
      JSON.stringify({
        version: 1,
        completedFocusSessions: 5,
        decor: 'lantern',
        lighting: 'day',
      }),
    ),
  ).toEqual({
    ...freshProgress(),
    completedFocusSessions: 5,
    decor: 'lantern',
    lighting: 'day',
  });
});
it('clears locked outfits and retains unlocked wardrobe choices', () => {
  expect(
    decodeProgress(JSON.stringify({ ...freshProgress(), outfit: 'beanie' }))
      .outfit,
  ).toBe('none');
  expect(
    decodeProgress(
      JSON.stringify({
        ...freshProgress(),
        completedFocusSessions: 5,
        outfit: 'scarf',
        ghost: true,
      }),
    ),
  ).toMatchObject({ outfit: 'scarf', ghost: true });
});
