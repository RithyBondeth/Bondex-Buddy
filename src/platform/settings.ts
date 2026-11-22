import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Progress } from '../engine/progress';

export interface HabitatSettings {
  progress: Omit<Progress, 'tasks'>;
  saveProblem: boolean;
  roaming: boolean;
  sound: boolean;
  error: string | null;
}

type Preferences = Pick<Progress, 'decor' | 'outfit' | 'lighting' | 'ghost'> & {
  roaming: boolean;
  sound: boolean;
};

export type HabitatChange = {
  [Key in keyof Preferences]: { setting: Key; value: Preferences[Key] };
}[keyof Preferences];

export async function publishHabitatSettings(snapshot: HabitatSettings) {
  if (isTauri()) await invoke('publish_habitat_settings', { snapshot });
}

export async function observeHabitatSettings(
  onChange: (change: HabitatChange) => void,
) {
  if (!isTauri()) return () => {};
  return listen<HabitatChange>('habitat-setting-changed', ({ payload }) =>
    onChange(payload),
  );
}
