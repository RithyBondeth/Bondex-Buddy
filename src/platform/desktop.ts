import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ActivityReading } from '../engine/spirit';

export const isDesktop = isTauri;

export async function beginDrag(): Promise<void> {
  if (isTauri()) await invoke('begin_drag');
}
export async function nudgeHabitat(dx: number, dy: number): Promise<void> {
  if (isTauri()) await invoke('nudge_habitat', { dx, dy });
}
export async function setGhostMode(enabled: boolean): Promise<void> {
  if (isTauri()) await invoke('set_ghost_mode', { enabled });
}
export async function setWorking(working: boolean): Promise<void> {
  if (isTauri()) await invoke('set_working', { working });
}
export async function observeGhost(
  callback: (ghost: boolean) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  return listen<boolean>('habitat-ghost', ({ payload }) => callback(payload));
}

export async function setDrawerVisible(visible: boolean): Promise<void> {
  if (isTauri()) await invoke('set_drawer_visible', { visible });
}

export async function observeVisibility(
  onVisible: (visible: boolean) => void,
): Promise<() => void> {
  if (!isTauri()) {
    const update = () => onVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    update();
    return () => document.removeEventListener('visibilitychange', update);
  }
  const unsubscribe = await listen<boolean>(
    'habitat-visibility',
    ({ payload }) => onVisible(payload),
  );
  try {
    onVisible(await invoke<boolean>('shell_visibility'));
  } catch (error) {
    unsubscribe();
    throw error;
  }
  return unsubscribe;
}

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
