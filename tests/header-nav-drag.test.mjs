import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/header-nav-drag.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { attachHeaderNavDrag, snapHeaderNav } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

function fixture(t, scale = 1) {
  const originalWindow = globalThis.window;
  globalThis.window = new EventTarget();
  window.matchMedia = () => ({ matches: false });
  class Rail extends EventTarget {
    offsetWidth = 593;
    clientWidth = 593;
    scrollWidth = 1493;
    scrollLeft = 300;
    children = Array.from({ length: 10 }, (_, i) => ({ offsetLeft: i * 150 }));
    attributes = new Map();
    capture = null;
    snaps = [];
    getBoundingClientRect() { return { width: this.offsetWidth * scale }; }
    scrollTo(options) { this.snaps.push(options); this.scrollLeft = options.left; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
    hasPointerCapture(id) { return this.capture === id; }
    setPointerCapture(id) { this.capture = id; }
    releasePointerCapture() { this.capture = null; }
  }
  const rail = new Rail();
  const cleanup = attachHeaderNavDrag(rail);
  let position = { clientX: 500, clientY: 40 };
  t.after(() => { cleanup(); globalThis.window = originalWindow; });
  const dispatch = (type, properties = {}) => {
    const event = new Event(type, { cancelable: true });
    if (type === 'pointerdown') position = { clientX: 500, clientY: 40 };
    Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, detail: 1 }, position, properties);
    position = { clientX: event.clientX, clientY: event.clientY };
    rail.dispatchEvent(event);
    return event;
  };
  return { rail, dispatch, cleanup };
}

for (const scale of [0.3, 0.5, 1, 1.5]) {
  test(`free dragging crosses multiple items and snaps only on release at scale ${scale}`, t => {
    const { rail, dispatch } = fixture(t, scale);
    dispatch('pointerdown');
    for (let i = 1; i <= 10; i++) {
      const distance = 39 * i;
      assert.equal(dispatch('pointermove', { clientX: 500 - distance * scale }).defaultPrevented, true);
      assert.ok(Math.abs(rail.scrollLeft - (300 + distance)) < .01, 'follows the pointer continuously');
      assert.equal(rail.snaps.length, 0, 'no snap while dragging');
    }
    dispatch('pointerup');
    assert.equal(rail.scrollLeft, 750, 'nearest stop, several items from the start');
    assert.equal(rail.capture, null);
    assert.equal(rail.attributes.has('data-dragging'), false);
    assert.equal(dispatch('click').defaultPrevented, true);
    dispatch('pointerdown');
    dispatch('pointermove', { clientX: 500 + 390 * scale });
    assert.ok(Math.abs(rail.scrollLeft - 360) < .01);
    dispatch('pointerup');
    assert.equal(rail.scrollLeft, 300, 'reverse dragging also snaps to the nearest item');
    assert.equal(dispatch('click').defaultPrevented, true);
  });
}

test('reversing a drag follows the pointer and can settle back on the starting item', t => {
  const { rail, dispatch } = fixture(t);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 280 });
  assert.equal(rail.scrollLeft, 520);
  dispatch('pointermove', { clientX: 485 });
  assert.equal(rail.scrollLeft, 315);
  dispatch('pointerup');
  assert.equal(rail.scrollLeft, 300);
  assert.equal(dispatch('click').defaultPrevented, true);
});

test('arrows move one stop and stay within the list boundaries', t => {
  const { rail } = fixture(t);
  snapHeaderNav(rail, 1); assert.equal(rail.scrollLeft, 450);
  snapHeaderNav(rail, -1); assert.equal(rail.scrollLeft, 300);
  rail.scrollLeft = 0;
  snapHeaderNav(rail, -1); assert.equal(rail.scrollLeft, 0);
  rail.scrollLeft = 900;
  snapHeaderNav(rail, 1); assert.equal(rail.scrollLeft, 900);
  window.matchMedia = () => ({ matches: true });
  snapHeaderNav(rail, -1);
  assert.equal(rail.snaps.at(-1).behavior, 'instant');
  rail.getBoundingClientRect = () => ({ width: rail.offsetWidth * .3 });
  rail.scrollWidth = 1495;
  rail.scrollLeft = 750;
  snapHeaderNav(rail, 1);
  assert.equal(rail.scrollLeft, 902, 'rounding at phone zoom does not create an extra tiny stop');
});

test('small pointer jitter remains a click; a fresh click after dragging still works', t => {
  const { rail, dispatch } = fixture(t);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 497, clientY: 42 });
  dispatch('pointerup');
  assert.equal(rail.scrollLeft, 300);
  assert.equal(rail.snaps.length, 0);
  assert.equal(dispatch('click').defaultPrevented, false);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 280 });
  dispatch('pointerup');
  dispatch('pointerdown');
  dispatch('pointerup');
  assert.equal(dispatch('click').defaultPrevented, false);
});

test('keyboard activation is not swallowed after dragging', t => {
  const { dispatch } = fixture(t);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 280 });
  dispatch('pointerup');
  assert.equal(dispatch('click', { detail: 0 }).defaultPrevented, false);
  assert.equal(dispatch('click').defaultPrevented, true);
});

test('vertical gestures and additional fingers remain available to the browser', t => {
  const { rail, dispatch } = fixture(t);
  dispatch('pointerdown');
  assert.equal(dispatch('pointermove', { clientX: 498, clientY: 90 }).defaultPrevented, false);
  assert.equal(rail.scrollLeft, 300);
  assert.equal(rail.capture, null);
  dispatch('pointerup');
  assert.equal(dispatch('click').defaultPrevented, true);
  dispatch('pointerdown');
  dispatch('pointerdown', { pointerId: 2, isPrimary: false });
  assert.equal(dispatch('pointermove', { clientX: 200 }).defaultPrevented, false);
  assert.equal(rail.scrollLeft, 300);
  assert.equal(rail.snaps.length, 0);
});

test('cancellation, capture loss and blur also leave the menu on a complete item', t => {
  const { rail, dispatch } = fixture(t);
  for (const end of ['pointercancel', 'lostpointercapture', 'blur']) {
    rail.scrollLeft = 300;
    dispatch('pointerdown');
    dispatch('pointermove', { clientX: 280 });
    if (end === 'blur') window.dispatchEvent(new Event('blur'));
    else dispatch(end);
    dispatch('pointermove', { clientX: 100 });
    dispatch('pointerup');
    assert.equal(rail.scrollLeft, 450);
    assert.equal(rail.attributes.has('data-dragging'), false);
    assert.equal(rail.capture, null);
  }
});

test('transferring implicit touch capture from a link keeps the rail drag alive', t => {
  const { rail, dispatch } = fixture(t);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 480 });
  const lostFromLink = new Event('lostpointercapture');
  Object.assign(lostFromLink, { pointerId: 1 });
  Object.defineProperty(lostFromLink, 'target', { value: new EventTarget() });
  rail.dispatchEvent(lostFromLink);
  dispatch('pointermove', { clientX: 280 });
  assert.equal(rail.scrollLeft, 520);
  assert.equal(rail.attributes.get('data-dragging'), 'true');
  dispatch('pointerup');
  assert.equal(rail.scrollLeft, 450);
  assert.equal(dispatch('click').defaultPrevented, true);
});

test('non-primary buttons and menus without overflow retain ordinary behavior', t => {
  const { rail, dispatch } = fixture(t);
  for (const button of [1, 2]) {
    dispatch('pointerdown', { button });
    assert.equal(dispatch('pointermove', { clientX: 100, button }).defaultPrevented, false);
    assert.equal(rail.scrollLeft, 300);
  }
  rail.scrollWidth = rail.clientWidth;
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 100 });
  assert.equal(rail.scrollLeft, 300);
  assert.equal(dispatch('click').defaultPrevented, false);
});

test('cleanup removes listeners and the browser link drag is disabled while attached', t => {
  const { rail, dispatch, cleanup } = fixture(t);
  assert.equal(dispatch('dragstart').defaultPrevented, true);
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 280 });
  cleanup();
  assert.equal(rail.capture, null);
  assert.equal(dispatch('click').defaultPrevented, false);
  assert.equal(dispatch('dragstart').defaultPrevented, false);
});
