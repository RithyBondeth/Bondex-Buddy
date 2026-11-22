'use client';

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { MotionConfig } from 'motion/react';

const Preferences = createContext({
  paused: false,
  reduced: false,
  toggle: () => {},
});
const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const readReducedMotion = () => window.matchMedia(motionQuery).matches;
const serverReducedMotion = () => false;

export function MotionPreferences({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    serverReducedMotion,
  );
  return (
    <Preferences.Provider
      value={{ paused, reduced, toggle: () => setPaused((p) => !p) }}
    >
      <MotionConfig reducedMotion={paused || reduced ? 'always' : 'never'}>
        <div data-motion-paused={paused}>{children}</div>
      </MotionConfig>
    </Preferences.Provider>
  );
}

export function useCalmMotion() {
  const { paused, reduced } = useContext(Preferences);
  return paused || reduced;
}

export function MotionToggle() {
  const { paused, toggle } = useContext(Preferences);
  return (
    <button
      className="motion-toggle"
      type="button"
      onClick={toggle}
      aria-pressed={paused}
    >
      <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>{' '}
      {paused ? 'Resume motion' : 'Pause motion'}
    </button>
  );
}
