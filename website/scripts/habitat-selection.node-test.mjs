import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHabitatSelection,
  reduceHabitatSelection,
} from '../src/lib/habitat-selection.ts';

const request = (index) => ({ type: 'request', index });
const loaded = (index, attempt = 0) => ({ type: 'loaded', index, attempt });
const failed = (index, attempt = 0) => ({ type: 'failed', index, attempt });

test('slow artwork keeps the current scene until the requested image is ready', () => {
  let state = reduceHabitatSelection(createHabitatSelection(3), loaded(0));
  state = reduceHabitatSelection(state, request(1));
  assert.equal(state.current, 0);
  assert.equal(state.requested, 1);
  state = reduceHabitatSelection(state, loaded(1));
  assert.equal(state.current, 1);
});

test('out-of-order loads cannot override the latest companion choice', () => {
  let state = createHabitatSelection(3);
  state = reduceHabitatSelection(state, request(1));
  state = reduceHabitatSelection(state, request(2));
  state = reduceHabitatSelection(state, loaded(1));
  assert.equal(state.current, 0);
  state = reduceHabitatSelection(state, loaded(2));
  assert.equal(state.current, 2);
  state = reduceHabitatSelection(state, loaded(0));
  assert.equal(state.current, 2);
});

test('a loaded habitat switches immediately without waiting for another load event', () => {
  let state = createHabitatSelection(3);
  for (let index = 0; index < 3; index++)
    state = reduceHabitatSelection(state, loaded(index));
  state = reduceHabitatSelection(state, request(2));
  assert.equal(state.current, 2);
  state = reduceHabitatSelection(state, request(1));
  assert.equal(state.current, 1);
});

test('failed scenery preserves the working habitat and can be retried', () => {
  let state = reduceHabitatSelection(createHabitatSelection(3), loaded(0));
  state = reduceHabitatSelection(state, request(1));
  state = reduceHabitatSelection(state, failed(1));
  assert.equal(state.current, 0);
  assert.equal(state.requested, 0);
  assert.equal(state.error, 1);
  state = reduceHabitatSelection(state, request(1));
  assert.equal(state.attempts[1], 1);
  const retrying = state;
  assert.equal(
    reduceHabitatSelection(state, loaded(1, 0)),
    retrying,
    'Ignore stale load callbacks',
  );
  assert.equal(
    reduceHabitatSelection(state, failed(1, 0)),
    retrying,
    'Ignore stale failures',
  );
  state = reduceHabitatSelection(state, loaded(1, 1));
  assert.equal(state.current, 1);
  assert.equal(state.error, null);
});

test('an unrelated preload failure does not cancel another pending selection', () => {
  let state = reduceHabitatSelection(createHabitatSelection(3), request(2));
  state = reduceHabitatSelection(state, failed(1));
  assert.equal(state.requested, 2);
  assert.equal(state.error, null);
  state = reduceHabitatSelection(state, loaded(2));
  assert.equal(state.current, 2);
});

test('invalid companion indices cannot corrupt the selection', () => {
  const state = createHabitatSelection(3);
  for (const index of [-1, 3, Infinity, NaN, 1.5])
    assert.equal(reduceHabitatSelection(state, request(index)), state);
});
