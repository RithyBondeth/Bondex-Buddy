import assert from 'node:assert/strict';
import test from 'node:test';
import { petPose, REACTION_MS } from '../src/lib/pet-animation.ts';

const grounded = ['ember', 'moon', 'moss'];
const kinds = [...grounded, 'blue-jelly'];

test('paused and reduced-motion pets stay still, including during interaction', () => {
  for (const kind of kinds) {
    const resting = petPose({ kind, elapsed: 0, reduced: true });
    for (const elapsed of [50, 900, 4400, 60_000]) {
      assert.deepEqual(
        petPose({
          kind,
          elapsed,
          reduced: true,
          curious: true,
          look: 1,
          reactionAge: 200,
        }),
        resting,
      );
    }
  }
});

test('each companion breathes and briefly closes and reopens its eyes', () => {
  for (const kind of kinds) {
    const samples = Array.from({ length: 700 }, (_, i) =>
      petPose({ kind, elapsed: i * 10 }),
    );
    assert.ok(
      samples.some((p) => p.inhale > 0),
      `${kind} never inhales`,
    );
    assert.ok(
      samples.some((p) => p.inhale === 0),
      `${kind} never exhales`,
    );
    assert.ok(
      samples.some((p) => p.eyes === 0),
      `${kind} never closes its eyes`,
    );
    assert.ok(
      samples.filter((p) => p.eyes === 1).length > samples.length * 0.8,
      `${kind} spends too long blinking`,
    );
    assert.ok(
      kind === 'blue-jelly'
        ? samples.some((p) => p.lift > 0)
        : samples.every((p) => p.lift === 0),
      `${kind} has the wrong idle movement`,
    );
  }
});

test('head pats play once and settle back into the same idle pose', () => {
  for (const kind of kinds) {
    const idle = petPose({ kind, elapsed: 1000 });
    assert.notDeepEqual(
      petPose({ kind, elapsed: 1000, reactionAge: 220 }),
      idle,
    );
    assert.deepEqual(
      petPose({ kind, elapsed: 1000, reactionAge: REACTION_MS }),
      idle,
    );
    assert.deepEqual(
      petPose({ kind, elapsed: 1000, reactionAge: REACTION_MS * 4 }),
      idle,
    );
  }
});

test('Moon gives a slow blink while Moss has a second, smaller hop', () => {
  assert.equal(petPose({ kind: 'moon', elapsed: 0, reactionAge: 500 }).eyes, 0);
  assert.equal(
    petPose({ kind: 'moon', elapsed: 0, reactionAge: 1400 }).eyes,
    1,
  );
  const firstHop = petPose({ kind: 'moss', elapsed: 0, reactionAge: 210 }).lift;
  const secondHop = petPose({
    kind: 'moss',
    elapsed: 0,
    reactionAge: 600,
  }).lift;
  assert.ok(firstHop > secondHop && secondHop > 0);
  assert.equal(petPose({ kind: 'moss', elapsed: 0, reactionAge: 800 }).lift, 0);
});

test('Blue Jelly drifts gently while idle and stays in place during focus', () => {
  const kind = 'blue-jelly';
  assert.equal(petPose({ kind, elapsed: 0 }).lift, 0);
  assert.equal(petPose({ kind, elapsed: 1800 }).lift, 8);
  assert.equal(petPose({ kind, elapsed: 3600 }).lift, 0);
  assert.equal(petPose({ kind, elapsed: 1800, mood: 'working' }).lift, 0);
});

test('sleeping pets keep resting even when hovered or patted', () => {
  for (const kind of kinds) {
    const pose = petPose({
      kind,
      elapsed: 1000,
      mood: 'sleeping',
      reactionAge: 210,
      curious: true,
    });
    assert.equal(pose.lift, 0);
    assert.equal(pose.lean, 0);
    assert.equal(pose.happy, false);
    assert.equal(pose.eyes, 0);
    assert.ok(pose.inhale > 0, 'Sleeping still has gentle breathing');
  }
});

test('pointer movement is bounded and does not affect an unengaged pet', () => {
  for (const kind of kinds) {
    assert.equal(
      petPose({ kind, elapsed: 0, curious: true, look: -100 }).look,
      -1,
    );
    assert.equal(
      petPose({ kind, elapsed: 0, curious: true, look: 100 }).look,
      1,
    );
    assert.equal(petPose({ kind, elapsed: 0, look: 1 }).look, 0);
  }
});

test('a pose depends on elapsed time rather than how many frames were rendered', () => {
  for (const kind of kinds) {
    const target = petPose({ kind, elapsed: 4400 });
    for (let time = 0; time < 4400; time += 1000 / 60)
      petPose({ kind, elapsed: time });
    assert.deepEqual(petPose({ kind, elapsed: 4400 }), target);
    assert.deepEqual(
      petPose({ kind, elapsed: -100 }),
      petPose({ kind, elapsed: 0 }),
    );
    assert.deepEqual(
      petPose({ kind, elapsed: Infinity }),
      petPose({ kind, elapsed: 0 }),
    );
  }
});

test('hover curiosity preserves each companion’s idle movement', () => {
  for (const kind of kinds) {
    for (const elapsed of [0, 700, 4300]) {
      const idle = petPose({ kind, elapsed });
      const hovering = petPose({ kind, elapsed, curious: true });
      assert.equal(hovering.lift, idle.lift);
      assert.equal(hovering.lean, idle.lean);
      assert.equal(hovering.inhale, idle.inhale);
    }
  }
});
