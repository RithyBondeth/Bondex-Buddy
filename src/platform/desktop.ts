import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ActivityReading } from '../engine/spirit';

export const isDesktop = isTauri;

/** Register the rendered alpha mask before revealing the native window. */
export async function revealHabitat(mask: number[]): Promise<void> {
  if (isTauri()) await invoke('show_shell', { mask });
}

export async function revealStartupError(): Promise<void> {
  if (isTauri()) await invoke('show_shell_error');
}

export async function updateHitMask(mask: number[]): Promise<void> {
  if (isTauri()) await invoke('update_shell_mask', { mask });
}

export async function setControlsVisible(visible: boolean): Promise<void> {
  if (isTauri()) await invoke('set_controls_visible', { visible });
}

export async function observeHover(
  onHover: (inside: boolean) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  return listen<boolean>('habitat-hover', ({ payload }) => onHover(payload));
}

export async function observeActivity(
  onReading: (reading: ActivityReading) => void,
): Promise<() => void> {
  if (!isTauri()) {
    onReading({ idleSeconds: null, sampledAtMs: Date.now() });
    return () => {};
  }
  const unsubscribe = await listen<ActivityReading>(
    'activity-sample',
    ({ payload }) => onReading(payload),
  );
  try {
    onReading(await invoke<ActivityReading>('activity_snapshot'));
  } catch {
    onReading({ idleSeconds: null, sampledAtMs: Date.now() });
  }
  return unsubscribe;
}
