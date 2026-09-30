import assert from 'node:assert/strict';
import test from 'node:test';
import { attachHomeStoryScroll } from '../lib/home-story-scroll.ts';
class Target extends EventTarget { clientHeight = 800; closest() { return null; } }
globalThis.Element = Target;
test('wheel threshold, momentum, cooldown, reversal and boundary exit', () => {
  const originalNow = Date.now;
  let now = 1000, index = 2;
  Date.now = () => now;
  const el = new Target();
  const steps = [];
  const cleanup = attachHomeStoryScroll(el, d => index + d >= 0 && index + d <= 4, d => { index += d; steps.push(index); });
  const wheel = (deltaY, extra = {}) => {
    const e = new Event('wheel', { cancelable: true });
    Object.assign(e, { deltaY, deltaX: 0, deltaMode: 0, ctrlKey: false, ...extra });
    el.dispatchEvent(e); return e.defaultPrevented;
  };
  try {
    wheel(30); assert.equal(index, 2);
    wheel(60); assert.equal(index, 3);
    for (let i = 0; i < 20; i++) { now += 100; wheel(300); }
    assert.equal(index, 3); // a long momentum tail is still one gesture
    now += 300; wheel(100); assert.equal(index, 4);
    now += 100; assert.equal(wheel(500), true); // swallow momentum at final card
    now += 1000; assert.equal(wheel(100), false); // a new gesture leaves the tour
    wheel(-100); assert.equal(index, 3);
    now += 300; wheel(-100); assert.equal(index, 3); // transition cooldown
    now += 1000; wheel(-100); assert.equal(index, 2);
    now += 1000; assert.equal(wheel(400, { ctrlKey: true }), false);
    assert.deepEqual(steps, [3, 4, 3, 2]);
    cleanup(); now += 1000; wheel(100); assert.equal(index, 2);
  } finally { cleanup(); Date.now = originalNow; }
});
test('deliberate vertical swipe steps once, while small movements and pinch do not', () => {
  const el = new Target(); const steps = [];
  const cleanup = attachHomeStoryScroll(el, () => true, d => steps.push(d));
  const point = (y, id = 1) => ({clientX: 100, clientY: y, identifier: id});
  const send = (type, touches, changedTouches = []) => {
    const e = new Event(type, { cancelable: true }); Object.assign(e, {touches, changedTouches});
    el.dispatchEvent(e); return e.defaultPrevented;
  };
  send('touchstart', [point(300)]); send('touchmove', [point(280)]); send('touchend', [], [point(280)]);
  assert.deepEqual(steps, []);
  send('touchstart', [point(300)]); assert.equal(send('touchmove', [point(180)]), true);
  send('touchend', [], [point(180)]); assert.deepEqual(steps, [1]);
  send('touchstart', [point(300)]); send('touchmove', [point(180), point(170, 2)]);
  send('touchend', [], [point(180)]); assert.deepEqual(steps, [1]);
  cleanup();
});
