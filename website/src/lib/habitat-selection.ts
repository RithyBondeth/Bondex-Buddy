export interface HabitatSelection {
  current: number;
  requested: number;
  loaded: boolean[];
  failed: boolean[];
  attempts: number[];
  error: number | null;
}

export type HabitatAction =
  | { type: 'request'; index: number }
  | { type: 'loaded' | 'failed'; index: number; attempt: number };

export function createHabitatSelection(count: number): HabitatSelection {
  return {
    current: 0,
    requested: 0,
    loaded: Array(count).fill(false),
    failed: Array(count).fill(false),
    attempts: Array(count).fill(0),
    error: null,
  };
}

/** An unfinished or failed image must never replace a working scene. */
export function reduceHabitatSelection(
  state: HabitatSelection,
  action: HabitatAction,
): HabitatSelection {
  const { index } = action;
  if (!Number.isInteger(index) || index < 0 || index >= state.loaded.length)
    return state;
  if (action.type === 'request') {
    return {
      ...state,
      requested: index,
      error: null,
      current: state.loaded[index] ? index : state.current,
      attempts: state.attempts.map((attempt, i) =>
        i === index && state.failed[index] ? attempt + 1 : attempt,
      ),
      failed: state.failed.map((failed, i) => (i === index ? false : failed)),
    };
  }
  if (action.attempt !== state.attempts[index]) return state;
  if (action.type === 'loaded') {
    return {
      ...state,
      loaded: state.loaded.map((loaded, i) => i === index || loaded),
      failed: state.failed.map((failed, i) => (i === index ? false : failed)),
      current: state.requested === index ? index : state.current,
      error: state.requested === index ? null : state.error,
    };
  }
  return {
    ...state,
    loaded: state.loaded.map((loaded, i) => (i === index ? false : loaded)),
    failed: state.failed.map((failed, i) => i === index || failed),
    requested: state.requested === index ? state.current : state.requested,
    error: state.requested === index ? index : state.error,
  };
}
