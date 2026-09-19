import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/header-nav-drag.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { attachHeaderNavDrag } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

function fixture(t, scale = 1, overflow = true) {
  const originalWindow = globalThis.window;
  globalThis.window = new EventTarget();
  class Rail extends EventTarget {
    offsetWidth = 500;
    clientWidth = 500;
    scrollWidth = overflow ? 1500 : 500;
    scrollLeft = 200;
    attributes = new Map();
    capture = null;
    getBoundingClientRect() { return { width: this.offsetWidth * scale }; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
    hasPointerCapture(id) { return this.capture === id; }
    setPointerCapture(id) { this.capture = id; }
    releasePointerCapture() { this.capture = null; }
  }
  const rail = new Rail();
  const cleanup = attachHeaderNavDrag(rail);
  t.after(() => { cleanup(); globalThis.window = originalWindow; });
  const dispatch = (type, properties = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX: 200, clientY: 40, detail: 1 }, properties);
    rail.dispatchEvent(event);
    return event;
  };
  return { rail, dispatch, cleanup };
}

for (const scale of [0.3, 0.5, 1, 1.5]) {
  test(`drag follows the pointer in both directions at scale ${scale}`, t => {
    const { rail, dispatch } = fixture(t, scale);
    dispatch('pointerdown');
    assert.equal(dispatch('pointermove', { clientX: 140 }).defaultPrevented, true);
    assert.equal(rail.scrollLeft, 200 + 60 / scale);
    dispatch('pointermove', { clientX: 230 });
    assert.equal(rail.scrollLeft, 200 - 30 / scale);
    dispatch('pointerup');
    assert.equal(rail.capture, null);
    assert.equal(rail.attributes.has('data-dragging'), false);
    assert.equal(dispatch('click').defaultPrevented, true);
  });
}

test('small pointer jitter remains a click; a fresh click after a drag still works', t => {
  const { rail, dispatch } = fixture(t);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 197, clientY: 42 });
  dispatch('pointerup');
  assert.equal(rail.scrollLeft, 200);
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
  const { rail, dispatch } = fixture(t);
  dispatch('pointerdown');
  assert.equal(dispatch('pointermove', { clientX: 198, clientY: 90 }).defaultPrevented, false);
  assert.equal(rail.scrollLeft, 200);
  assert.equal(rail.capture, null);
  dispatch('pointerup');
  assert.equal(dispatch('click').defaultPrevented, true);
  dispatch('pointerdown');
  dispatch('pointerdown', { pointerId: 2, isPrimary: false });
  assert.equal(dispatch('pointermove', { clientX: 100 }).defaultPrevented, false);
  assert.equal(rail.scrollLeft, 200);
});

test('cancellation, capture loss and blur end a drag', t => {
  const { rail, dispatch } = fixture(t);
  for (const end of ['pointercancel', 'lostpointercapture', 'blur']) {
    dispatch('pointerdown');
    dispatch('pointermove', { clientX: 170 });
    if (end === 'blur') window.dispatchEvent(new Event('blur'));
    else dispatch(end);
    const left = rail.scrollLeft;
    dispatch('pointermove', { clientX: 100 });
    assert.equal(rail.scrollLeft, left);
    assert.equal(rail.attributes.has('data-dragging'), false);
    assert.equal(rail.capture, null);
  }
});

test('transferring implicit touch capture from a link keeps the rail drag alive', t => {
  const { rail, dispatch } = fixture(t);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 180 });
  const lostFromLink = new Event('lostpointercapture');
  Object.assign(lostFromLink, { pointerId: 1 });
  Object.defineProperty(lostFromLink, 'target', { value: new EventTarget() });
  rail.dispatchEvent(lostFromLink);
  dispatch('pointermove', { clientX: 100 });
  assert.equal(rail.scrollLeft, 300);
  assert.equal(rail.attributes.get('data-dragging'), 'true');
  dispatch('pointerup');
  assert.equal(dispatch('click').defaultPrevented, true);
});

test('non-primary mouse buttons and a rail without overflow retain ordinary behavior', t => {
  const { rail, dispatch } = fixture(t);
  for (const button of [1, 2]) {
    dispatch('pointerdown', { button });
    assert.equal(dispatch('pointermove', { clientX: 100, button }).defaultPrevented, false);
    assert.equal(rail.scrollLeft, 200);
  }
  rail.scrollWidth = rail.clientWidth;
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 100 });
  assert.equal(rail.scrollLeft, 200);
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
