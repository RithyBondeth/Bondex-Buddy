export type Decor = 'none' | 'plant' | 'lantern';
export interface Progress {
  version: 1;
  completedFocusSessions: number;
  decor: Decor;
  lighting: 'auto' | 'day';
}
export const freshProgress = (): Progress => ({
  version: 1,
  completedFocusSessions: 0,
  decor: 'none',
  lighting: 'auto',
});
export const unlockAt: Record<Decor, number> = {
  none: 0,
  plant: 1,
  lantern: 3,
};
export function canEquip(progress: Progress, decor: Decor): boolean {
  return progress.completedFocusSessions >= unlockAt[decor];
}
export function decodeProgress(raw: string | null): Progress {
  if (raw === null) return freshProgress();
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('Invalid progress');
  const p = data as Record<string, unknown>;
  if (
    p.version !== 1 ||
    !Number.isSafeInteger(p.completedFocusSessions) ||
    (p.completedFocusSessions as number) < 0 ||
    (p.completedFocusSessions as number) > 1_000_000 ||
    typeof p.decor !== 'string' ||
    !['none', 'plant', 'lantern'].includes(p.decor) ||
    typeof p.lighting !== 'string' ||
    !['auto', 'day'].includes(p.lighting)
  )
    throw new Error('Unsupported or invalid progress');
  const result: Progress = {
    version: 1,
    completedFocusSessions: p.completedFocusSessions as number,
    decor: p.decor as Decor,
    lighting: p.lighting as Progress['lighting'],
  };
  if (!canEquip(result, result.decor)) result.decor = 'none';
  return result;
}
export function awardCompletions(progress: Progress, count: number): Progress {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error('Invalid completion count');
  return {
    ...progress,
    completedFocusSessions: Math.min(
      1_000_000,
      progress.completedFocusSessions + count,
    ),
  };
}
