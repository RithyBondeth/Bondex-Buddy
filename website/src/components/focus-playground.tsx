'use client';

import { LivingPet } from '@/components/ui/living-pet';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useCalmMotion } from '@/components/motion-preferences';
import { easeOut } from '@/lib/motion';

const modes = [
  {
    id: 'focus',
    title: 'Shall we focus?',
    label: 'Focus',
    image: '/pets/working.png',
    duration: 25 * 60,
  },
  {
    id: 'break',
    title: 'Time for a break?',
    label: 'Break',
    image: '/pets/tea-break.png',
    duration: 5 * 60,
  },
  {
    id: 'rest',
    title: 'A little quiet time.',
    label: 'Rest',
    image: '/pets/sleeping.png',
    duration: 0,
  },
] as const;

export function FocusPlayground() {
  const [mode, setMode] = useState(0);
  const [petMessage, setPetMessage] = useState<{
    mode: string;
    text: string;
  } | null>(null);
  const [remaining, setRemaining] = useState<number>(modes[0].duration);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const deadline = useRef(0);
  const reduce = useCalmMotion();
  const current = modes[mode];

  useEffect(() => {
    if (!running) return;
    deadline.current = Date.now() + remaining * 1000;
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        setCompleted(true);
      }
    };
    const timer = window.setInterval(tick, 250);
    return () => clearInterval(timer);
    // Remaining time is captured when a run starts, not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const reset = () => {
    setRunning(false);
    setRemaining(current.duration);
    setCompleted(false);
  };
  return (
    <div className="ritual-playground">
      <div className="ritual-thought">
        <div
          className="ritual-tabs"
          role="group"
          aria-label="Explore a daily ritual"
        >
          {modes.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === i}
              onClick={() => {
                setMode(i);
                setPetMessage(null);
                setRunning(false);
                setRemaining(item.duration);
                setCompleted(false);
              }}
            >
              {mode === i && (
                <motion.span
                  className="ritual-indicator"
                  layoutId="ritual-indicator"
                  transition={{ duration: reduce ? 0 : 0.3, ease: easeOut }}
                />
              )}
              {item.label}
            </button>
          ))}
        </div>
        <div className="ritual-thought-body">
          <p className="ritual-prompt" role="status">
            {completed
              ? 'All done. Take a moment for yourself.'
              : (petMessage?.mode === current.id && petMessage.text) ||
                current.title}
          </p>
          {current.duration > 0 ? (
            <>
              <output className="demo-clock" aria-label="Time remaining">
                {Math.floor(remaining / 60)
                  .toString()
                  .padStart(2, '0')}
                <span>:</span>
                {(remaining % 60).toString().padStart(2, '0')}
              </output>
              <div className="demo-controls">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => {
                    if (remaining === 0) setRemaining(current.duration);
                    setCompleted(false);
                    setRunning(!running);
                  }}
                >
                  {running
                    ? 'Pause'
                    : remaining < current.duration && remaining > 0
                      ? 'Resume'
                      : mode === 0
                        ? 'Start focus'
                        : 'Start break'}
                </button>
                <button className="reset-timer" type="button" onClick={reset}>
                  Reset
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div className="ritual-art">
        <motion.div
          key={current.id}
          className="ritual-sprite"
          initial={reduce ? false : { opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduce ? 0 : 0.42, ease: easeOut }}
        >
          <LivingPet
            kind="ember"
            name="Ember"
            onMessage={(text) => setPetMessage({ mode: current.id, text })}
            image={current.image}
            mood={
              current.id === 'focus'
                ? 'working'
                : current.id === 'break'
                  ? 'break'
                  : 'sleeping'
            }
          />
        </motion.div>
      </div>
      <p className="browser-demo">Browser demo · progress isn’t saved</p>
    </div>
  );
}
