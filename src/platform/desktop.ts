import { invoke, isTauri } from '@tauri-apps/api/core';

/** Register the rendered alpha mask before revealing the native window. */
export async function revealHabitat(mask: number[]): Promise<void> {
  if (isTauri()) await invoke('show_shell', { mask });
}

export async function revealStartupError(): Promise<void> {
  if (isTauri()) await invoke('show_shell_error');
}
