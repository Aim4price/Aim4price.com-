import assert from 'node:assert/strict';
import test from 'node:test';
import { attachHomeStorySwipe } from '../lib/home-story-swipe.ts';

class Target extends EventTarget { closest() { return null; } }
globalThis.Element = Target;
let dialogOpen = false;
globalThis.document = { querySelector: () => dialogOpen ? {} : null };
const point = (x, y, identifier = 1) => ({ clientX: x, clientY: y, identifier });
function setup() {
  dialogOpen = false;
  const element = new Target();
  const steps = [];
  const cleanup = attachHomeStorySwipe(element, (direction) => steps.push(direction));
  const send = (type, touches = [], changedTouches = [], detail = 1) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { touches, changedTouches, detail });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const swipe = (x, y) => {
    send('touchstart', [point(200, 200)]);
    const prevented = send('touchmove', [point(x, y)]);
    send('touchend', [], [point(x, y)]);
    return prevented;
  };
  return { element, steps, cleanup, send, swipe };
}

test('left advances once, right goes back, and a new tap still works', () => {
  const h = setup();
  assert.equal(h.swipe(90, 205), true);
  assert.deepEqual(h.steps, [1]);
  assert.equal(h.send('click'), true);
  assert.equal(h.send('click', [], [], 0), false); // keyboard activation
  h.swipe(310, 195);
  assert.deepEqual(h.steps, [1, -1]);
  h.send('touchstart', [point(200, 200)]);
  h.send('touchend', [], [point(200, 200)]);
  assert.equal(h.send('click'), false);
  h.cleanup();
});

test('up, down, diagonal scrolling and small drags do not advance cards', () => {
  const h = setup();
  assert.equal(h.swipe(205, 50), false);
  assert.equal(h.swipe(195, 350), false);
  assert.equal(h.swipe(280, 290), false);
  h.swipe(175, 202);
  assert.deepEqual(h.steps, []);
  h.cleanup();
});

test('a vertical gesture stays native even if the finger later moves sideways', () => {
  const h = setup();
  h.send('touchstart', [point(200, 200)]);
  assert.equal(h.send('touchmove', [point(200, 220)]), false);
  assert.equal(h.send('touchmove', [point(60, 220)]), false);
  h.send('touchend', [], [point(60, 220)]);
  assert.deepEqual(h.steps, []);
  h.cleanup();
});

test('pinch, cancelled touches, open dialogs and form controls do not navigate', () => {
  const h = setup();
  h.send('touchstart', [point(200, 200)]);
  assert.equal(h.send('touchmove', [point(100, 200), point(300, 200, 2)]), false);
  h.send('touchend', [], [point(100, 200)]);
  h.send('touchstart', [point(200, 200)]);
  h.send('touchmove', [point(100, 200)]);
  h.send('touchcancel');
  h.send('touchend', [], [point(100, 200)]);
  dialogOpen = true;
  assert.equal(h.swipe(100, 200), false);
  dialogOpen = false;
  h.element.closest = () => ({});
  assert.equal(h.swipe(100, 200), false);
  assert.deepEqual(h.steps, []);
  h.cleanup();
});

test('cleanup removes the gesture and click listeners', () => {
  const h = setup();
  h.swipe(100, 200);
  h.cleanup();
  assert.equal(h.send('click'), false);
  assert.equal(h.swipe(300, 200), false);
  assert.deepEqual(h.steps, [1]);
});
