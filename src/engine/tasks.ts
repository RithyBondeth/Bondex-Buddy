export const TASK_LIMIT = 40;
export const TASK_TITLE_LIMIT = 120;
export const SNOOZE_MS = 10 * 60_000;

export interface FocusTask {
  id: string;
  title: string;
  done: boolean;
  sessions: number;
  remindAt: number | null;
}

export function taskTitle(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function createTask(text: string): FocusTask {
  const title = taskTitle(text)
    .slice(0, TASK_TITLE_LIMIT)
    .replace(/\p{Surrogate}$/u, '')
    .trimEnd();
  const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return { id, title, done: false, sessions: 0, remindAt: null };
}

export function dueReminders(tasks: FocusTask[], now: number): FocusTask[] {
  return tasks
    .filter(
      ({ done, remindAt }) => !done && remindAt !== null && remindAt <= now,
    )
    .sort((a, b) => a.remindAt! - b.remindAt!);
}

export function decodeTasks(raw: unknown): FocusTask[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > TASK_LIMIT)
    throw new Error('Invalid tasks');
  const ids = new Set<string>();
  return (raw as unknown[]).map((value) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid task');
    const {
      id,
      title,
      done,
      sessions,
      remindAt = null,
    } = value as Partial<FocusTask>;
    if (
      typeof id !== 'string' ||
      !/^[a-f0-9]{24}$/.test(id) ||
      ids.has(id) ||
      typeof title !== 'string' ||
      !taskTitle(title) ||
      title.length > TASK_TITLE_LIMIT ||
      typeof done !== 'boolean' ||
      typeof sessions !== 'number' ||
      !Number.isSafeInteger(sessions) ||
      sessions < 0 ||
      sessions > 1_000_000 ||
      (remindAt !== null &&
        (!Number.isSafeInteger(remindAt) || remindAt < 0 || remindAt > 8.64e15))
    )
      throw new Error('Invalid task');
    ids.add(id);
    return {
      id,
      title: taskTitle(title),
      done,
      sessions,
      remindAt: done ? null : remindAt,
    };
  });
}

export function creditTask(
  tasks: FocusTask[],
  id: string | null,
  count: number,
): FocusTask[] {
  return id
    ? tasks.map((task) =>
        task.id === id
          ? { ...task, sessions: Math.min(1_000_000, task.sessions + count) }
          : task,
      )
    : tasks;
}
