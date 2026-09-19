import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/header-nav-drag.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { attachHeaderNavDrag } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

function fixture(t) {
  const originalWindow = globalThis.window;
  globalThis.window = new EventTarget();
  class Rail extends EventTarget {
    attributes = new Map();
    capture = null;
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
    hasPointerCapture(id) { return this.capture === id; }
    setPointerCapture(id) { this.capture = id; }
    releasePointerCapture() { this.capture = null; }
  }
  const rail = new Rail();
  const steps = [];
  const cleanup = attachHeaderNavDrag(rail, direction => steps.push(direction));
  let position = { clientX: 200, clientY: 40 };
  t.after(() => { cleanup(); globalThis.window = originalWindow; });
  const dispatch = (type, properties = {}) => {
    const event = new Event(type, { cancelable: true });
    if (type === 'pointerdown') position = { clientX: 200, clientY: 40 };
    Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, detail: 1 }, position, properties);
    position = { clientX: event.clientX, clientY: event.clientY };
    rail.dispatchEvent(event);
    return event;
  };
  return { rail, dispatch, cleanup, steps };
}

for (const distance of [30, 200, 1200]) {
  test(`a ${distance}px drag moves exactly one item on release, in either direction`, t => {
    const { rail, dispatch, steps } = fixture(t);
    for (const direction of [1, -1]) {
      const before = steps.length;
      dispatch('pointerdown');
      for (let i = 1; i <= 10; i++) {
        dispatch('pointermove', { clientX: 200 - direction * distance * i / 10 });
        assert.equal(steps.length, before, 'movement does not repeatedly advance the window');
      }
      dispatch('pointerup');
      assert.equal(steps.length, before + 1);
      assert.equal(steps.at(-1), direction);
      assert.equal(rail.capture, null);
      assert.equal(rail.attributes.has('data-dragging'), false);
      assert.equal(dispatch('click').defaultPrevented, true);
      dispatch('pointerup');
      assert.equal(steps.length, before + 1, 'duplicate release cannot advance again');
    }
  });
}

test('short drags and a drag reversed back to its starting point do not step or click', t => {
  const { dispatch, steps } = fixture(t);
  for (const movement of [[190], [100, 196]]) {
    dispatch('pointerdown');
    for (const clientX of movement) dispatch('pointermove', { clientX });
    dispatch('pointerup');
    assert.deepEqual(steps, []);
    assert.equal(dispatch('click').defaultPrevented, true);
  }
});

test('small pointer jitter remains a click; a fresh click after a drag still works', t => {
  const { dispatch, steps } = fixture(t);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 197, clientY: 42 });
  dispatch('pointerup');
  assert.deepEqual(steps, []);
  assert.equal(dispatch('click').defaultPrevented, false);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 150 });
  dispatch('pointerup');
  dispatch('pointerdown');
  dispatch('pointerup');
  assert.equal(dispatch('click').defaultPrevented, false);
});

test('keyboard activation is not swallowed after dragging', t => {
  const { dispatch } = fixture(t);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 140 });
  dispatch('pointerup');
  assert.equal(dispatch('click', { detail: 0 }).defaultPrevented, false);
  assert.equal(dispatch('click').defaultPrevented, true);
});

test('vertical gestures and additional fingers remain available to the browser', t => {
  const { rail, dispatch, steps } = fixture(t);
  dispatch('pointerdown');
  assert.equal(dispatch('pointermove', { clientX: 198, clientY: 90 }).defaultPrevented, false);
  assert.deepEqual(steps, []);
  assert.equal(rail.capture, null);
  dispatch('pointerup');
  assert.equal(dispatch('click').defaultPrevented, true);
  dispatch('pointerdown');
  dispatch('pointerdown', { pointerId: 2, isPrimary: false });
  assert.equal(dispatch('pointermove', { clientX: 100 }).defaultPrevented, false);
  assert.deepEqual(steps, []);
});

test('cancellation, capture loss and blur end a drag', t => {
  const { rail, dispatch, steps } = fixture(t);
  for (const end of ['pointercancel', 'lostpointercapture', 'blur']) {
    dispatch('pointerdown');
    dispatch('pointermove', { clientX: 170 });
    if (end === 'blur') window.dispatchEvent(new Event('blur'));
    else dispatch(end);
    dispatch('pointermove', { clientX: 100 });
    dispatch('pointerup');
    assert.deepEqual(steps, []);
    assert.equal(rail.attributes.has('data-dragging'), false);
    assert.equal(rail.capture, null);
  }
});

test('transferring implicit touch capture from a link keeps the rail drag alive', t => {
  const { rail, dispatch, steps } = fixture(t);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 180 });
  const lostFromLink = new Event('lostpointercapture');
  Object.assign(lostFromLink, { pointerId: 1 });
  Object.defineProperty(lostFromLink, 'target', { value: new EventTarget() });
  rail.dispatchEvent(lostFromLink);
  dispatch('pointermove', { clientX: 100 });
  assert.deepEqual(steps, []);
  assert.equal(rail.attributes.get('data-dragging'), 'true');
  dispatch('pointerup');
  assert.deepEqual(steps, [1]);
  assert.equal(dispatch('click').defaultPrevented, true);
});

test('non-primary mouse buttons retain ordinary behavior', t => {
  const { dispatch, steps } = fixture(t);
  for (const button of [1, 2]) {
    dispatch('pointerdown', { button });
    assert.equal(dispatch('pointermove', { clientX: 100, button }).defaultPrevented, false);
    assert.deepEqual(steps, []);
  }
  assert.equal(dispatch('click').defaultPrevented, false);
});

test('cleanup removes listeners and the browser link drag is disabled while attached', t => {
  const { rail, dispatch, cleanup } = fixture(t);
  assert.equal(dispatch('dragstart').defaultPrevented, true);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 170 });
  cleanup();
  assert.equal(rail.capture, null);
  assert.equal(dispatch('click').defaultPrevented, false);
  assert.equal(dispatch('dragstart').defaultPrevented, false);
});
