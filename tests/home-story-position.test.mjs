import assert from 'node:assert/strict';
import test from 'node:test';
import { homeStoryPositionCorrection as correction, homeStoryScrollTravel } from '../lib/home-story-position.ts';

test('healthy sticky needs no correction at any canvas scale', () => {
  for (const scale of [0.3, 0.6, 1, 1.2, 2]) {
    assert.equal(correction(-800, 3000, 92 * scale, 92 * scale, 0, scale), 0);
  }
});

test('a stage scrolling offscreen is pinned without accumulating translation', () => {
  for (const scale of [0.3, 0.6, 1, 1.2, 2]) {
    const top = 92 * scale;
    const first = correction(-800, 3000, top, -800, 0, scale);
    assert.ok(Math.abs(-800 + first * scale - top) < 1e-9);
    assert.equal(correction(-800, 3000, top, top, first, scale), first);
    assert.equal(correction(120, 3000, top, 120 + first * scale, first, scale), Math.max(0, top - 120) / scale);
  }
});

test('the fallback releases the stage at the end of the story', () => {
  assert.equal(correction(-3500, 3000, 92, -3500, 0, 1), 3000);
  assert.equal(correction(-3500, 3000, 92, -500, 0, 1), 0);
});


test('short zoomed documents keep the final story step reachable', () => {
  globalThis.document = { documentElement: { scrollHeight: 1500 } };
  globalThis.window = { innerHeight: 900 };
  try {
    assert.equal(homeStoryScrollTravel(1000, 20), 580);
    assert.equal(homeStoryScrollTravel(400, 20), 400);
  } finally { delete globalThis.document; delete globalThis.window; }
});
