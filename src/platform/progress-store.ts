import { invoke, isTauri } from '@tauri-apps/api/core';
import { decodeProgress, freshProgress } from '../engine/progress';
import type { Progress } from '../engine/progress';

export interface ProgressBackend {
  read(): Promise<string | null>;
  write(raw: string): Promise<void>;
}
const key = 'tiny-desk-spirit.preview.progress.v1';
const desktopBackend: ProgressBackend = {
  read: () => invoke('load_progress'),
  write: (data) => invoke('save_progress', { data }),
};
const previewBackend: ProgressBackend = {
  read: async () => localStorage.getItem(key),
  write: async (raw) => {
    localStorage.setItem(key, raw);
  },
};

export async function openProgressStore(
  backend = isTauri() ? desktopBackend : previewBackend,
) {
  let data: Progress;
  let readOnly = false;
  try {
    data = decodeProgress(await backend.read());
  } catch {
    data = freshProgress();
    readOnly = true;
  }
  let pending = Promise.resolve();
  return {
    data,
    readOnly,
    save(value: Progress): Promise<void> {
      if (readOnly)
        return Promise.reject(
          new Error('Existing progress has been preserved'),
        );
      // Capture at submission and serialize writes. A failed save does not poison retries.
      const raw = JSON.stringify(value);
      const write = pending.catch(() => {}).then(() => backend.write(raw));
      pending = write;
      return write;
    },
  };
}
