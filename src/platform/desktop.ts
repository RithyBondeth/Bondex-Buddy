import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ActivityReading } from '../engine/spirit';
import { restingPlay, type PetPlay } from '../rendering/playful';

export const isDesktop = isTauri;

export async function openBuddyPanel(
  tab: 'clipboard' | 'agents' = 'clipboard',
): Promise<void> {
  window.dispatchEvent(new CustomEvent('buddy-open', { detail: tab }));
}

export async function setCompanionOpen(
  open: boolean,
): Promise<{ width: number; height: number }> {
  if (isTauri()) return invoke('set_companion_open', { open });
  return open
    ? {
        width: Math.max(220, Math.min(400, innerWidth)),
        height: Math.max(200, Math.min(600, innerHeight)),
      }
    : { width: 220, height: 200 };
}

export async function observeBuddyOpen(
  callback: (tab: string) => void,
): Promise<() => void> {
  const local = (event: Event) =>
    callback((event as CustomEvent<string>).detail);
  window.addEventListener('buddy-open', local);
  const native = isTauri()
    ? await listen<string>('buddy-tab', ({ payload }) => callback(payload))
    : () => {};
  return () => {
    window.removeEventListener('buddy-open', local);
    native();
  };
}

export async function readAgentCue(): Promise<string> {
  return isTauri() ? invoke<string>('agent_cue') : 'idle';
}

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

export async function setPlayContext(
  quiet: boolean,
  reduced: boolean,
): Promise<void> {
  if (isTauri()) await invoke('set_play_context', { quiet, reduced });
}
export async function setPlayfulRoaming(enabled: boolean): Promise<void> {
  if (isTauri()) await invoke('set_playful_roaming', { enabled });
}
export async function observePlay(
  callback: (play: PetPlay) => void,
): Promise<() => void> {
  if (!isTauri()) {
    callback({ ...restingPlay(), enabled: false });
    return () => {};
  }
  const unsubscribe = await listen<PetPlay>('habitat-play', ({ payload }) =>
    callback(payload),
  );
  try {
    callback(await invoke<PetPlay>('play_snapshot'));
  } catch (error) {
    unsubscribe();
    throw error;
  }
  return unsubscribe;
}

export async function observeFocus(
  callback: (focused: boolean) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const unsubscribe = await listen<boolean>('habitat-focus', ({ payload }) =>
    callback(payload),
  );
  try {
    callback(await invoke<boolean>('shell_focused'));
  } catch (error) {
    unsubscribe();
    throw error;
  }
  return unsubscribe;
}
