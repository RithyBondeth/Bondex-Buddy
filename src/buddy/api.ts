import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AgentKind, AgentSnapshot, ClipboardSnapshot } from './model';

const preview: ClipboardSnapshot = {
  enabled: false,
  entries: [],
  error: null,
  revision: 0,
};

export const native = isTauri();

export function readClipboard(): Promise<ClipboardSnapshot> {
  return native
    ? invoke('clipboard_snapshot')
    : Promise.resolve(structuredClone(preview));
}

export async function editClipboard(
  action: 'pin' | 'remove' | 'clear',
  id?: number,
): Promise<ClipboardSnapshot> {
  if (native) return invoke('clipboard_edit', { action, id });
  switch (action) {
    case 'clear':
      preview.entries = [];
      break;
    case 'remove':
      preview.entries = preview.entries.filter((entry) => entry.id !== id);
      break;
    case 'pin': {
      const entry = preview.entries.find((entry) => entry.id === id);
      if (entry) entry.pinned = !entry.pinned;
    }
  }
  preview.revision++;
  return structuredClone(preview);
}

export async function copyClip(id: number): Promise<void> {
  if (native) return invoke('clipboard_copy', { id });
  const entry = preview.entries.find((entry) => entry.id === id);
  if (!entry) throw new Error('Clip no longer exists');
  await navigator.clipboard.writeText(entry.text);
}

export function addPreviewClips(): void {
  const now = Date.now();
  preview.entries = [
    {
      id: 1,
      text: 'Small steps. Good things.',
      pinned: true,
      copiedAt: now - 300_000,
    },
    {
      id: 2,
      text: 'npm run desktop:dev',
      pinned: false,
      copiedAt: now - 30_000,
    },
    {
      id: 3,
      text: 'A little room for your next big idea.\nKeep it close with Ember.',
      pinned: false,
      copiedAt: now - 90_000,
    },
  ];
  preview.revision++;
}

export function readAgents(): Promise<AgentSnapshot> {
  return native
    ? invoke('agent_snapshot')
    : Promise.resolve({
        connections: [
          { agent: 'codex', installed: false, error: null },
          { agent: 'claude', installed: false, error: null },
        ],
        sessions: [],
        cue: null,
      });
}

export async function connectAgent(
  agent: AgentKind,
  connect: boolean,
): Promise<void> {
  if (!native)
    throw new Error('Agent connections are available in the desktop app.');
  await invoke('agent_connect', { agent, connect });
}
