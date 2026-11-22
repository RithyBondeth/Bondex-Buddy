export type PetKind = 'ember' | 'moon' | 'moss';
export type PetMood = 'idle' | 'working' | 'break' | 'sleeping';

export interface PetPose {
  inhale: number;
  lift: number;
  lean: number;
  eyes: number;
  happy: boolean;
  look: number;
}

export const REACTION_MS = 1600;

const rhythms = {
  ember: { breath: 4200, blink: 4700 },
  moon: { breath: 5200, blink: 6100 },
  moss: { breath: 3800, blink: 4100 },
};

/** A brief close, hold, and reopen. No blink outside this small window. */
function eyelid(time: number): number {
  if (time < 0 || time >= 240) return 1;
  if (time < 70) return 1 - time / 70;
  if (time < 150) return 0;
  return (time - 150) / 90;
}

/** Pure, elapsed-time animation: refresh rate cannot change a pet's rhythm. */
export function petPose({
  kind,
  elapsed,
  reactionAge = Infinity,
  curious = false,
  look = 0,
  reduced = false,
  mood = 'idle',
}: {
  kind: PetKind;
  elapsed: number;
  reactionAge?: number;
  curious?: boolean;
  look?: number;
  reduced?: boolean;
  mood?: PetMood;
}): PetPose {
  const neutral = {
    inhale: 0,
    lift: 0,
    lean: 0,
    eyes: 1,
    happy: false,
    look: 0,
  };
  if (reduced) return neutral;
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const rhythm = rhythms[kind];
  const cycle = mood === 'sleeping' ? 6200 : rhythm.breath;
  const phase = (time % cycle) / cycle;
  // A one-pixel inhale keeps the feet planted and the original silhouette intact.
  const inhale = Math.sin(phase * Math.PI * 2) > 0.25 ? 1 : 0;
  const blinkTime = (time % rhythm.blink) - rhythm.blink + 550;
  // An occasional second blink, rather than a metronomic repeated blink.
  const doubleBlink = Math.floor(time / rhythm.blink) % 3 === 2;
  let eyes = Math.min(
    eyelid(blinkTime),
    doubleBlink ? eyelid(blinkTime - 310) : 1,
  );
  let lift = 0;
  let lean = 0;
  const reacting = reactionAge >= 0 && reactionAge < REACTION_MS;
  let happy = reacting && kind !== 'moon';
  if (reacting) {
    const t = Math.min(1, reactionAge / 850);
    if (kind === 'moon') {
      lean = Math.round(-Math.sin(t * Math.PI) * 2);
      eyes =
        reactionAge < 1000
          ? Math.max(0, 1 - reactionAge / 160)
          : Math.min(1, (reactionAge - 1000) / 300);
    } else if (kind === 'moss') {
      const hop =
        reactionAge < 420 ? reactionAge / 420 : (reactionAge - 420) / 360;
      lift +=
        reactionAge < 780
          ? Math.round(
              Math.sin(Math.min(1, hop) * Math.PI) *
                (reactionAge < 420 ? 5 : 3),
            )
          : 0;
    } else {
      lift += Math.round(Math.sin(t * Math.PI) * 4);
    }
  }
  if (mood === 'sleeping') {
    eyes = 0;
    happy = false;
    lift = 0;
    lean = 0;
  }
  return {
    inhale,
    lift,
    lean,
    eyes,
    happy,
    look: curious ? Math.round(Math.max(-1, Math.min(1, look))) : 0,
  };
}
