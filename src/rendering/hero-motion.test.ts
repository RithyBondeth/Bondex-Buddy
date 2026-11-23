import { expect, it } from 'vitest';
import {
  heroNames,
  heroPose,
  isHero,
  type HeroAction,
} from '../../website/shared/hero-motion';

import {
  ABILITY_MS,
  abilityTime,
  abilityPose,
} from '../../website/shared/abilities';
import { armAngles } from '../../website/shared/hero-rig';
import { companionNames, isCompanion } from '../engine/companions';

const ids = Object.keys(heroNames).filter(isHero);

it('returns each hero to a grounded pose after its own greeting', () => {
  const greetings = new Set<string>();
  for (const id of ids) {
    const samples = [0, 100, 300, 500, 700, 900, 1000].map((time) =>
      heroPose(id, 'greet', time),
    );
    expect(samples.some((pose) => pose.lift > 0)).toBe(true);
    expect(samples.at(-1)).toEqual(samples[0]);
    greetings.add(JSON.stringify(samples));
  }
  expect(greetings.size).toBe(ids.length);
});

it('animates feet in both directions and keeps reduced-motion poses still', () => {
  const actions: HeroAction[] = [
    'idle',
    'working',
    'rest',
    'break',
    'greet',
    'walk',
    'run',
    'crouch',
  ];
  for (const id of ids) {
    for (const action of actions)
      expect(heroPose(id, action, 550, true, 1)).toEqual(
        heroPose(id, action, 0, true, -1),
      );
    expect(heroPose(id, 'walk', 220).step).toBeGreaterThan(0);
    expect(heroPose(id, 'walk', 660).step).toBeLessThan(0);
    expect(heroPose(id, 'run', 140).lift).toBeGreaterThan(0);
  }
});

it('plays every companion ability once and returns every joint to rest', () => {
  const neutral = { x: 0, lift: 0, tilt: 0, stretch: 1 };
  const performances = new Set<string>();
  for (const id of Object.keys(companionNames).filter(isCompanion)) {
    expect(abilityPose(id, 0)).toEqual(neutral);
    expect(abilityPose(id, 1)).toEqual(neutral);
    const samples = Array.from({ length: 41 }, (_, frame) =>
      abilityPose(id, frame / 40),
    );
    expect(samples.every((p) => Object.values(p).every(Number.isFinite))).toBe(
      true,
    );
    performances.add(JSON.stringify(samples));
    if (isHero(id)) {
      for (const angle of Object.values(armAngles(id, 1)))
        expect(Math.abs(angle)).toBeLessThan(0.001);
    }
  }
  expect(performances.size).toBe(Object.keys(companionNames).length);
});

it('gives replays priority and leaves focus and reduced motion quiet', () => {
  expect(abilityTime(1800, Infinity, true, false)).toBe(100 / ABILITY_MS);
  expect(abilityTime(1800, Infinity, false, false)).toBeNull();
  expect(abilityTime(1800, 200, false, false)).toBe(200 / ABILITY_MS);
  expect(abilityTime(1800, ABILITY_MS, true, false)).toBeNull();
  expect(abilityTime(1800, 200, true, true)).toBeNull();
});
